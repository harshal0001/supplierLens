"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { api, asApiFailure } from "@/lib/api";
import { Button } from "@/components/ui/button";

const MAX_SECONDS = 60;

function pickMime() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

/** Click to start, click again to stop (auto-stops after 60 s, Esc cancels). Sends the recording for transcription. */
export function PushToTalk({
  disabled,
  onTranscript,
  onStatus,
}: {
  disabled?: boolean;
  onTranscript: (text: string) => void;
  onStatus: (status: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const cancelled = useRef(false);

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

  useEffect(() => () => recorder.current?.stream.getTracks().forEach((track) => track.stop()), []);

  async function start() {
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
    <Button
      type="button"
      variant={recording ? "destructive" : "outline"}
      disabled={disabled || transcribing}
      aria-pressed={recording}
      aria-label={recording ? "Stop recording" : "Ask by voice"}
      onClick={() => (recording ? recorder.current?.stop() : void start())}
    >
      {recording ? <Square className="size-4" aria-hidden /> : <Mic className="size-4" aria-hidden />}
      {recording ? `Stop (${MAX_SECONDS - seconds}s)` : transcribing ? "Transcribing…" : "Ask by voice"}
    </Button>
  );
}
