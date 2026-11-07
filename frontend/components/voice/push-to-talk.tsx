"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { api, asApiFailure } from "@/lib/api";
import { cn } from "@/lib/utils";

const MAX_SECONDS = 60;

function pickMime() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

export interface VoiceState {
  phase: "idle" | "listening" | "transcribing";
  analyser: AnalyserNode | null; // live microphone level while listening
  secondsLeft: number;
}

/** Click to start, click again to stop (auto-stops after 60 s, Esc cancels). Sends the recording for transcription. */
export function PushToTalk({
  disabled,
  onTranscript,
  onStatus,
  onVoiceState,
  className,
}: {
  disabled?: boolean;
  onTranscript: (text: string) => void;
  onStatus: (status: string) => void;
  onVoiceState?: (state: VoiceState) => void;
  className?: string;
}) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const meter = useRef<AudioContext | null>(null); // feeds only the level meter, never the recording
  const cancelled = useRef(false);
  const starting = useRef(false); // a 2nd click during the permission prompt would start a 2nd mic stream

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        cancelled.current = true;
        recorder.current?.stop();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearInterval(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [recording]);

  useEffect(() => {
    if (recording && seconds >= MAX_SECONDS) recorder.current?.stop();
  }, [recording, seconds]);

  useEffect(() => {
    onVoiceState?.({
      phase: recording ? "listening" : transcribing ? "transcribing" : "idle",
      analyser,
      secondsLeft: MAX_SECONDS - seconds,
    });
  }, [onVoiceState, recording, transcribing, analyser, seconds]);

  useEffect(
    () => () => {
      cancelled.current = true; // left the page: don't send (or ask) a recording that ends after unmount
      recorder.current?.stream.getTracks().forEach((track) => track.stop());
      void meter.current?.close();
    },
    [],
  );

  function openMeter(stream: MediaStream) {
    try {
      const context = new AudioContext();
      const node = context.createAnalyser();
      node.fftSize = 256;
      node.smoothingTimeConstant = 0.7;
      context.createMediaStreamSource(stream).connect(node); // not connected to the speakers: no echo
      meter.current = context;
      setAnalyser(node);
    } catch {
      // the meter is decoration; recording works without it
    }
  }

  function closeMeter() {
    void meter.current?.close();
    meter.current = null;
    setAnalyser(null);
  }

  async function start() {
    if (starting.current) return;
    starting.current = true;
    try {
      await begin();
    } finally {
      starting.current = false;
    }
  }

  async function begin() {
    const mime = pickMime();
    if (mime == null || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Voice input isn't supported in this browser. Type your question instead.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error("Microphone access was denied. Type your question instead.");
      return;
    }
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    rec.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    rec.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      closeMeter();
      setRecording(false);
      if (cancelled.current || chunks.length === 0) {
        onStatus("");
        return;
      }
      void transcribe(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
    };
    recorder.current = rec;
    cancelled.current = false;
    setSeconds(0);
    rec.start();
    openMeter(stream);
    setRecording(true);
    onStatus("Listening…");
  }

  async function transcribe(blob: Blob) {
    setTranscribing(true);
    onStatus("Transcribing…");
    try {
      const body = new FormData();
      body.append("audio", blob, blob.type.includes("mp4") ? "question.mp4" : "question.webm");
      const { text } = await api<{ text: string }>("/api/voice/transcribe", { method: "POST", body });
      if (cancelled.current) return;
      if (text) onTranscript(text);
      else {
        toast.error("I didn't catch that. Try again or type your question.");
        onStatus("");
      }
    } catch (cause) {
      toast.error(asApiFailure(cause).message);
      onStatus("");
    } finally {
      setTranscribing(false);
    }
  }

  return (
    <button
      type="button"
      disabled={(disabled && !recording) || transcribing}
      aria-pressed={recording}
      aria-label={recording ? "Stop recording" : "Ask by voice"}
      onClick={() => (recording ? recorder.current?.stop() : void start())}
      className={cn(
        "relative grid place-items-center rounded-full outline-none transition-all duration-300 focus-visible:ring-4 focus-visible:ring-sky-300/70 disabled:cursor-not-allowed",
        recording
          ? "bg-risk-high text-white shadow-[0_0_0_10px_rgb(239_68_68/0.2)] hover:brightness-110"
          : "bg-white text-primary shadow-[0_12px_40px_-8px_rgb(56_189_248/0.6)] hover:scale-105 disabled:opacity-70 disabled:hover:scale-100",
        className,
      )}
    >
      {recording ? (
        <Square className="size-[34%] fill-current" aria-hidden />
      ) : transcribing ? (
        <Loader2 className="size-[40%] animate-spin" aria-hidden />
      ) : (
        <Mic className="size-[40%]" aria-hidden />
      )}
    </button>
  );
}
