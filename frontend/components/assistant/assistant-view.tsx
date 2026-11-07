"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  FileSearch,
  FileWarning,
  Languages,
  Mic,
  SendHorizontal,
  Sparkles,
  Square,
  TrendingUp,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { api, asApiFailure } from "@/lib/api";
import type { ActionItem, AssistantAnswer, ChatTurn, Citation, SupplierSummary } from "@/lib/types";
import { PushToTalk, type VoiceState } from "@/components/voice/push-to-talk";
import { Waveform } from "@/components/voice/waveform";
import { ActionCard, SourceCard, SupplierRiskChip, Typewriter } from "@/components/assistant/answer-parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const AUTOPLAY_KEY = "supplierlens.autoplay";

const SUGGESTIONS = [
  { text: "Which supplier has the highest risk, and why?", hint: "Risk ranking", icon: TrendingUp },
  { text: "What evidence supports this assessment?", hint: "Evidence", icon: FileSearch },
  { text: "Which supplier documents are missing?", hint: "Coverage gaps", icon: FileWarning },
  { text: "Welcher Lieferant hat das höchste Risiko?", hint: "Auf Deutsch", icon: Languages },
];

interface Message extends ChatTurn {
  citations?: Citation[];
  actions?: ActionItem[];
  voice?: boolean; // asked by voice: the transcript types itself in
}

function readAutoplay() {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(AUTOPLAY_KEY) !== "0";
  } catch {
    return true;
  }
}

const IDLE_VOICE: VoiceState = { phase: "idle", analyser: null, secondsLeft: 60 };

export function AssistantView({ initialSupplierId }: { initialSupplierId: number | null }) {
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [supplierId, setSupplierId] = useState<number | null>(initialSupplierId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("");
  const [thinking, setThinking] = useState(false);
  const [autoplay, setAutoplay] = useState(readAutoplay);
  const [speaking, setSpeaking] = useState(false);
  const [speakingText, setSpeakingText] = useState<string | null>(null); // answer being voiced (also while preparing)
  const [speakAnalyser, setSpeakAnalyser] = useState<AnalyserNode | null>(null);
  const [voice, setVoice] = useState<VoiceState>(IDLE_VOICE);
  const [openCitation, setOpenCitation] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef<string | null>(null);
  const speakCtx = useRef<AudioContext | null>(null); // drives the answer equaliser
  const speakSeq = useRef(0); // bumped by stopSpeaking: a TTS reply that arrives after it is stale and must not play
  const bottom = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    api<SupplierSummary[]>("/api/suppliers")
      .then(setSuppliers)
      .catch((cause: unknown) => toast.error(asApiFailure(cause).message));
    return () => {
      speakSeq.current += 1;
      audio.current?.pause();
      void speakCtx.current?.close();
    };
  }, []);

  useEffect(() => {
    // Braces matter: newer Chromium returns a Promise from scrollIntoView, and React would call it as a cleanup.
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking]);

  function stopSpeaking() {
    speakSeq.current += 1;
    audio.current?.pause();
    audio.current = null;
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = null;
    void speakCtx.current?.close();
    speakCtx.current = null;
    setSpeakAnalyser(null);
    setSpeaking(false);
    setSpeakingText(null);
    setStatus("");
  }

  /** Routes the answer audio through an analyser for the equaliser, only if the AudioContext may run (else silence). */
  async function attachMeter(player: HTMLAudioElement) {
    try {
      const context = new AudioContext();
      speakCtx.current = context;
      const running = () => context.state === "running";
      if (!running()) await Promise.race([context.resume(), new Promise((r) => setTimeout(r, 300))]);
      if (!running() || speakCtx.current !== context) {
        if (speakCtx.current === context) speakCtx.current = null;
        void context.close();
        return;
      }
      const node = context.createAnalyser();
      node.fftSize = 256;
      node.smoothingTimeConstant = 0.75;
      node.connect(context.destination);
      context.createMediaElementSource(player).connect(node);
      setSpeakAnalyser(node);
    } catch {
      // the equaliser is decoration; the audio still plays directly
    }
  }

  async function speak(text: string) {
    stopSpeaking();
    const seq = speakSeq.current;
    setSpeakingText(text);
    try {
      setStatus("Preparing voice…");
      const blob = await api<Blob>("/api/voice/speak", { method: "POST", body: JSON.stringify({ text }) });
      if (seq !== speakSeq.current) return; // a newer question, Play or Stop came in meanwhile
      const url = URL.createObjectURL(blob);
      const player = new Audio(url);
      audio.current = player;
      audioUrl.current = url;
      player.onended = () => {
        if (audio.current === player) stopSpeaking();
      };
      await attachMeter(player);
      if (seq !== speakSeq.current) return;
      setSpeaking(true);
      setStatus("Speaking…");
      await player.play();
    } catch (cause) {
      if (seq !== speakSeq.current) return;
      stopSpeaking();
      // Safari blocks audio that starts after a network wait; the user can press Play instead.
      const blocked = cause instanceof DOMException && cause.name === "NotAllowedError";
      toast.error(blocked ? "Press Play to hear the answer." : asApiFailure(cause).message, { id: "speak" });
    }
  }

  async function ask(question: string, viaVoice = false) {
    const text = question.trim();
    if (!text || thinking) return;
    stopSpeaking();
    const history: ChatTurn[] = messages.slice(-6).map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, { role: "user", content: text, voice: viaVoice }]);
    setInput("");
    setThinking(true);
    setStatus("Thinking…");
    try {
      const answer = await api<AssistantAnswer>("/api/assistant/query", {
        method: "POST",
        body: JSON.stringify({ question: text, supplier_id: supplierId ?? undefined, history }),
      });
      setMessages((current) => [
        ...current,
        { role: "assistant", content: answer.answer, citations: answer.citations, actions: answer.proposed_actions },
      ]);
      setStatus("");
      if (autoplay) void speak(answer.answer);
    } catch (cause) {
      setStatus("");
      toast.error(asApiFailure(cause).message);
    } finally {
      setThinking(false);
    }
  }

  async function decide(action: ActionItem, decision: "approved" | "rejected") {
    try {
      const updated = await api<ActionItem>(`/api/actions/${action.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: decision }),
      });
      setMessages((current) =>
        current.map((m) => ({ ...m, actions: m.actions?.map((a) => (a.id === updated.id ? updated : a)) })),
      );
    } catch (cause) {
      toast.error(asApiFailure(cause).message);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void ask(input);
  }

  const stage =
    voice.phase !== "idle"
      ? voice.phase
      : thinking
        ? "thinking"
        : speaking
          ? "speaking"
          : speakingText != null
            ? "preparing"
            : "idle";
  const busy = stage === "transcribing" || stage === "thinking" || stage === "preparing";
  const HINT: Record<typeof stage, string> = {
    idle: "Tap the mic and ask in English or German",
    listening: `Tap to stop · Esc cancels · ${voice.secondsLeft}s left`,
    transcribing: "Turning your question into text",
    thinking: "Searching documents, web signals and scores",
    preparing: "Getting the answer ready to read aloud",
    speaking: "Reading the cited answer aloud",
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-sky-800">Assistant</p>
          <h1 className="text-2xl font-semibold tracking-tight">Ask SupplierLens</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Ask in text or by voice. Answers come only from your supplier data and link to their evidence.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Supplier</span>
          <select
            className="h-9 min-w-0 max-w-[16rem] rounded-lg border border-input bg-background px-2 shadow-xs"
            value={supplierId ?? ""}
            onChange={(event) => setSupplierId(event.target.value ? Number(event.target.value) : null)}
          >
            <option value="">All suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
        {/* Voice stage: sticky bar on phones; on desktop as tall as the chat card's 560px minimum, so both columns line up */}
        <section
          aria-label="Voice"
          className="sticky top-0 z-10 overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-xl shadow-primary/20 lg:top-6 lg:flex lg:min-h-[560px] lg:flex-col"
        >
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 transition-opacity duration-700",
              "bg-[radial-gradient(ellipse_at_50%_0%,rgb(56_189_248/0.28),transparent_65%)]",
              stage === "listening" && "bg-[radial-gradient(ellipse_at_50%_0%,rgb(239_68_68/0.3),transparent_65%)]",
            )}
          />
          <div className="relative flex items-center gap-4 p-4 lg:flex-1 lg:flex-col lg:justify-between lg:gap-5 lg:p-7">
            <div className="hidden w-full items-center justify-between text-xs lg:flex">
              <span className="inline-flex items-center gap-2 font-medium tracking-[0.14em] text-primary-foreground/70 uppercase">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    stage === "listening" ? "animate-pulse bg-red-400" : stage === "idle" ? "bg-sky-300/60" : "animate-pulse bg-sky-300",
                  )}
                />
                Voice assistant
              </span>
              <span className="text-primary-foreground/60">ElevenLabs voice</span>
            </div>

            <div className="relative grid size-24 shrink-0 place-items-center lg:size-44">
              {stage === "listening" ? (
                <>
                  <span className="absolute inset-1 animate-ping rounded-full bg-red-500/25 [animation-duration:1.6s] lg:inset-4" />
                  <span className="absolute inset-3 animate-ping rounded-full bg-red-400/20 [animation-delay:0.5s] [animation-duration:1.6s] lg:inset-8" />
                </>
              ) : stage === "speaking" ? (
                <span className="absolute inset-2 animate-ping rounded-full bg-sky-400/20 [animation-duration:2.2s] lg:inset-5" />
              ) : busy ? (
                <span className="absolute inset-0 animate-spin rounded-full border-2 border-white/10 border-t-sky-300 [animation-duration:1.1s] lg:inset-2" />
              ) : (
                <>
                  <span className="absolute inset-0 rounded-full border border-white/10" />
                  <span className="absolute inset-3 rounded-full border border-white/15 lg:inset-6" />
                </>
              )}
              <PushToTalk
                disabled={thinking}
                onStatus={setStatus}
                onVoiceState={setVoice}
                onTranscript={(text) => void ask(text, true)}
                className="size-16 lg:size-24"
              />
            </div>

            <div className="min-w-0 flex-1 space-y-1 lg:w-full lg:flex-none lg:text-center">
              <p aria-live="polite" className="min-h-6 text-lg font-semibold tracking-tight lg:text-xl">
                {status || <span aria-hidden>Tap to ask</span>}
              </p>
              <p className="text-xs text-primary-foreground/70 lg:text-sm">{HINT[stage]}</p>
              <Waveform
                analyser={voice.analyser ?? speakAnalyser}
                busy={busy}
                className={cn(
                  "mt-2 h-8 lg:mt-4 lg:h-16",
                  stage === "listening" ? "text-red-200" : stage === "speaking" ? "text-sky-300" : "text-white/70",
                )}
              />
            </div>

            <div className="hidden w-full flex-wrap items-center justify-center gap-3 lg:flex">
              <AutoplayToggle autoplay={autoplay} setAutoplay={setAutoplay} />
            </div>
            {speaking ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={stopSpeaking}
                aria-label="Stop speaking"
                className="shrink-0 animate-in fade-in zoom-in-95"
              >
                <Square className="fill-current" aria-hidden /> Stop
              </Button>
            ) : null}
          </div>
        </section>

        <Card className="min-w-0 lg:min-h-[560px]">
          <CardContent className="flex h-full flex-col gap-4">
            <div className="lg:hidden">
              <AutoplayToggle autoplay={autoplay} setAutoplay={setAutoplay} light />
            </div>

            {messages.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center animate-in fade-in duration-500 sm:py-8">
                <span className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
                  <Sparkles className="size-6" aria-hidden />
                </span>
                <h2 className="mt-4 text-xl font-semibold tracking-tight">Ask about your suppliers</h2>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Tap the microphone or type a question. Every answer is grounded in your documents and web sources,
                  with numbered citations you can open.
                </p>
                <div className="mt-6 grid w-full gap-3 sm:grid-cols-2">
                  {SUGGESTIONS.map(({ text, hint, icon: Icon }) => (
                    <button
                      key={text}
                      type="button"
                      disabled={thinking}
                      onClick={() => void ask(text)}
                      className="group flex min-w-0 cursor-pointer items-center gap-3 rounded-xl border border-border bg-background p-3.5 text-left transition-all duration-200 outline-none hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-sky-300 disabled:opacity-60"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-800 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                          {hint}
                        </span>
                        <span className="block text-sm font-medium">{text}</span>
                      </span>
                      <ArrowRight
                        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <ol className="space-y-5" aria-label="Conversation">
              {messages.map((m, index) =>
                m.role === "user" ? (
                  <li key={index} className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="max-w-[85%] space-y-1 rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm">
                      {m.voice ? (
                        <p className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-foreground/70">
                          <Mic className="size-3" aria-hidden /> Asked by voice
                        </p>
                      ) : null}
                      <p className="leading-6 whitespace-pre-line">{m.voice ? <Typewriter text={m.content} /> : m.content}</p>
                    </div>
                  </li>
                ) : (
                  <li key={index} className="flex gap-3 animate-in fade-in slide-in-from-bottom-3 duration-500">
                    <span className="mt-1 hidden size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground sm:grid">
                      <Sparkles className="size-4" aria-hidden />
                    </span>
                    <AnswerBubble
                      message={m}
                      index={index}
                      suppliers={suppliers}
                      openCitation={openCitation}
                      setOpenCitation={setOpenCitation}
                      speakingHere={speakingText === m.content}
                      speakAnalyser={speakAnalyser}
                      onPlay={() => void speak(m.content)}
                      onDecide={(a, d) => void decide(a, d)}
                    />
                  </li>
                ),
              )}
            </ol>
            {thinking ? (
              <div className="flex gap-3 animate-in fade-in duration-300" aria-hidden>
                <span className="hidden size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground sm:grid">
                  <Sparkles className="size-4 animate-pulse" />
                </span>
                <div className="flex items-center gap-3 rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3 shadow-sm">
                  <span className="flex gap-1">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="size-2 animate-bounce rounded-full bg-sky-700"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </span>
                  <span className="text-sm text-muted-foreground">Checking supplier evidence…</span>
                </div>
              </div>
            ) : null}
            <div ref={bottom} />

            <form onSubmit={onSubmit} className="mt-auto flex gap-2 rounded-xl border border-border bg-muted/40 p-1.5">
              <Input
                value={input}
                maxLength={1000}
                placeholder="Ask about your suppliers…"
                aria-label="Question"
                disabled={thinking}
                className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                onChange={(event) => setInput(event.target.value)}
              />
              <Button type="submit" disabled={thinking || !input.trim()}>
                <SendHorizontal aria-hidden /> Ask
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AutoplayToggle({
  autoplay,
  setAutoplay,
  light = false,
}: {
  autoplay: boolean;
  setAutoplay: (value: boolean) => void;
  light?: boolean;
}) {
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 text-xs font-medium",
        light ? "text-muted-foreground" : "text-primary-foreground/80",
      )}
    >
      <input
        type="checkbox"
        className="size-3.5 accent-sky-400"
        checked={autoplay}
        suppressHydrationWarning // saved per-browser preference; the server render can't know it
        onChange={(event) => {
          setAutoplay(event.target.checked);
          try {
            localStorage.setItem(AUTOPLAY_KEY, event.target.checked ? "1" : "0");
          } catch {
            // per-viewer convenience only
          }
        }}
      />
      <Volume2 className="size-3.5" aria-hidden /> Read answers aloud
    </label>
  );
}

function AnswerBubble({
  message: m,
  index,
  suppliers,
  openCitation,
  setOpenCitation,
  speakingHere,
  speakAnalyser,
  onPlay,
  onDecide,
}: {
  message: Message;
  index: number;
  suppliers: SupplierSummary[];
  openCitation: string | null;
  setOpenCitation: (key: string | null) => void;
  speakingHere: boolean;
  speakAnalyser: AnalyserNode | null;
  onPlay: () => void;
  onDecide: (action: ActionItem, decision: "approved" | "rejected") => void;
}) {
  const cited = [...new Set(m.citations?.map((c) => c.supplier_id))]
    .map((id) => suppliers.find((s) => s.id === id))
    .filter((s): s is SupplierSummary => s != null);
  return (
    <div className="min-w-0 flex-1 space-y-3 rounded-2xl rounded-tl-sm border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">SupplierLens</span>
        <Badge variant="outline" className="border-sky-200 text-sky-900">
          <Sparkles aria-hidden />
          AI-generated
        </Badge>
        {speakingHere ? (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-900">
            <Waveform analyser={speakAnalyser} busy bars={5} className="h-3.5 w-6 text-sky-700" />
            Speaking
          </span>
        ) : (
          <button
            type="button"
            className="ml-auto inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-sky-800 transition-colors hover:bg-sky-50"
            onClick={onPlay}
          >
            <Volume2 className="size-3.5" aria-hidden /> Play
          </button>
        )}
      </div>
      <p className="text-sm leading-6 whitespace-pre-line">{m.content}</p>

      {cited.length ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Suppliers in this answer</p>
          <div className="flex flex-wrap gap-2">
            {cited.map((s) => (
              <SupplierRiskChip key={s.id} supplier={s} />
            ))}
          </div>
        </div>
      ) : null}

      {m.citations?.length ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Sources · {m.citations.length}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {m.citations.map((c, i) => {
              const key = `${index}:${c.evidence_id}`;
              return (
                <SourceCard
                  key={c.evidence_id}
                  citation={c}
                  number={i + 1}
                  open={openCitation === key}
                  onToggle={() => setOpenCitation(openCitation === key ? null : key)}
                />
              );
            })}
          </div>
        </div>
      ) : null}

      {m.actions?.length ? (
        <div className="space-y-2">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Proposed actions</p>
          {m.actions.map((a) => (
            <ActionCard key={a.id} action={a} onDecide={(d) => onDecide(a, d)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
