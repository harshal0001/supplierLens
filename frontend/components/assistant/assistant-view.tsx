"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Square } from "lucide-react";
import { toast } from "sonner";
import { api, asApiFailure } from "@/lib/api";
import type { ActionItem, AssistantAnswer, ChatTurn, Citation, SupplierSummary } from "@/lib/types";
import { PushToTalk } from "@/components/voice/push-to-talk";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const AUTOPLAY_KEY = "supplierlens.autoplay";

const SUGGESTIONS = [
  "Which supplier has the highest risk, and why?",
  "What evidence supports this assessment?",
  "Which supplier documents are missing?",
  "Welcher Lieferant hat das höchste Risiko?",
];

interface Message extends ChatTurn {
  citations?: Citation[];
  actions?: ActionItem[];
}

function readAutoplay() {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(AUTOPLAY_KEY) !== "0";
  } catch {
    return true;
  }
}

export function AssistantView({ initialSupplierId }: { initialSupplierId: number | null }) {
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [supplierId, setSupplierId] = useState<number | null>(initialSupplierId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("");
  const [thinking, setThinking] = useState(false);
  const [autoplay, setAutoplay] = useState(readAutoplay);
  const [speaking, setSpeaking] = useState(false);
  const [openCitation, setOpenCitation] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const bottom = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    api<SupplierSummary[]>("/api/suppliers")
      .then(setSuppliers)
      .catch((cause: unknown) => toast.error(asApiFailure(cause).message));
    return () => audio.current?.pause();
  }, []);

  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [messages]);

  function stopSpeaking() {
    audio.current?.pause();
    audio.current = null;
    setSpeaking(false);
    setStatus("");
  }

  async function speak(text: string) {
    stopSpeaking();
    try {
      setStatus("Preparing voice…");
      const blob = await api<Blob>("/api/voice/speak", { method: "POST", body: JSON.stringify({ text }) });
      const url = URL.createObjectURL(blob);
      const player = new Audio(url);
      audio.current = player;
      player.onended = () => {
        URL.revokeObjectURL(url);
        if (audio.current === player) stopSpeaking();
      };
      setSpeaking(true);
      setStatus("Speaking…");
      await player.play();
    } catch (cause) {
      stopSpeaking();
      toast.error(asApiFailure(cause).message, { id: "speak" });
    }
  }

  async function ask(question: string) {
    const text = question.trim();
    if (!text || thinking) return;
    stopSpeaking();
    const history: ChatTurn[] = messages.slice(-6).map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, { role: "user", content: text }]);
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

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-sky-800">Assistant</p>
          <h1 className="text-2xl font-semibold tracking-tight">Ask SupplierLens</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Ask in text or by voice. Answers come only from your supplier data and link to their evidence.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">Supplier</span>
            <select
              className="h-8 rounded-lg border border-input bg-background px-2"
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
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
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
            Read answers aloud
          </label>
        </div>
      </header>

      <Card>
        <CardContent className="space-y-4">
          {messages.length === 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Try one of these:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <Button key={s} size="sm" variant="secondary" disabled={thinking} onClick={() => void ask(s)}>
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          <ol className="space-y-3" aria-label="Conversation">
            {messages.map((m, index) => (
              <li key={index} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground"
                      : "max-w-[85%] space-y-2 rounded-xl bg-muted px-3 py-2 text-sm"
                  }
                >
                  <p className="whitespace-pre-line leading-6">{m.content}</p>
                  {m.role === "assistant" ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">AI-generated</Badge>
                        {m.citations?.map((c, i) => (
                          <button
                            key={c.evidence_id}
                            type="button"
                            className="cursor-pointer rounded-full border border-sky-200 bg-background px-2 py-0.5 text-xs text-sky-800"
                            aria-expanded={openCitation === `${index}:${c.evidence_id}`}
                            onClick={() =>
                              setOpenCitation(openCitation === `${index}:${c.evidence_id}` ? null : `${index}:${c.evidence_id}`)
                            }
                          >
                            [{i + 1}] {c.title}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="cursor-pointer text-xs text-sky-800 underline"
                          onClick={() => void speak(m.content)}
                        >
                          Play
                        </button>
                      </div>
                      {m.citations
                        ?.filter((c) => openCitation === `${index}:${c.evidence_id}`)
                        .map((c) => (
                          <div key={c.evidence_id} className="rounded-lg border border-border bg-background p-2 text-xs">
                            <p className="text-slate-700">“{c.excerpt}”</p>
                            <p className="mt-1 flex flex-wrap gap-3 text-muted-foreground">
                              {c.document_id != null && c.page_number != null ? (
                                <a
                                  className="text-sky-800 underline"
                                  href={`${API_BASE}/api/documents/${c.document_id}/file#page=${c.page_number}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Open page {c.page_number}
                                </a>
                              ) : null}
                              {c.url ? (
                                <a className="text-sky-800 underline" href={c.url} target="_blank" rel="noreferrer">
                                  Open source
                                </a>
                              ) : null}
                              <Link className="text-sky-800 underline" href={`/suppliers/${c.supplier_id}`}>
                                Supplier page
                              </Link>
                            </p>
                          </div>
                        ))}
                      {m.actions?.map((a) => (
                        <div key={a.id} className="rounded-lg border border-border bg-background p-2">
                          <p className="font-medium">{a.title}</p>
                          <p className="text-xs text-muted-foreground">{a.rationale}</p>
                          <div className="mt-2 flex items-center gap-2">
                            {a.status === "proposed" ? (
                              <>
                                <Button size="xs" onClick={() => void decide(a, "approved")}>
                                  Approve
                                </Button>
                                <Button size="xs" variant="ghost" onClick={() => void decide(a, "rejected")}>
                                  Reject
                                </Button>
                              </>
                            ) : (
                              <span className="text-xs capitalize text-muted-foreground">{a.status}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
          <div ref={bottom} />

          <p className="min-h-5 text-sm text-muted-foreground" aria-live="polite">
            {status}
          </p>

          <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={input}
              maxLength={1000}
              placeholder="Ask about your suppliers…"
              aria-label="Question"
              disabled={thinking}
              onChange={(event) => setInput(event.target.value)}
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={thinking || !input.trim()}>
                Ask
              </Button>
              <PushToTalk disabled={thinking} onStatus={setStatus} onTranscript={(text) => void ask(text)} />
              {speaking ? (
                <Button type="button" variant="ghost" onClick={stopSpeaking} aria-label="Stop speaking">
                  <Square className="size-4" aria-hidden /> Stop
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
