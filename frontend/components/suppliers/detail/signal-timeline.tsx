"use client";

import { Ban, CircleCheck, CircleQuestionMark, ExternalLink } from "lucide-react";
import type { ExternalSignal } from "@/lib/types";
import { formatWhen } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BAND_TEXT, band, CATEGORY_LABEL, domainOf, riskVar } from "./shared";

export function SignalTimeline({ signals }: { signals: ExternalSignal[] }) {
  if (signals.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-muted-foreground">No web signals stored.</p>
    );
  }
  return (
    <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[6rem] before:w-px before:bg-border sm:before:left-[7rem]">
      {signals.map((signal, i) => {
        const confirmed = signal.verification_status === "source_confirmed";
        const rejected = signal.verification_status === "rejected";
        const Icon = confirmed ? CircleCheck : rejected ? Ban : CircleQuestionMark;
        return (
          <li
            key={signal.id}
            className="relative flex animate-in gap-3 fade-in slide-in-from-left-2 fill-mode-both"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <time
              dateTime={signal.published_at ?? undefined}
              className="w-[4.5rem] shrink-0 pt-2.5 text-right text-[11px] leading-tight font-medium text-muted-foreground sm:w-[5.5rem] sm:text-xs"
            >
              {signal.published_at ? formatWhen(signal.published_at) : "Undated"}
            </time>
            <span
              className={cn(
                "relative z-10 mt-2 grid size-6 shrink-0 place-items-center rounded-full ring-4 ring-background",
                confirmed && "bg-emerald-600 text-white",
                rejected && "bg-slate-300 text-slate-600",
                !confirmed && !rejected && "border border-dashed border-amber-500 bg-amber-50 text-amber-700",
              )}
              aria-hidden
            >
              <Icon className="size-3.5" />
            </span>
            <a
              href={signal.url}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "group min-w-0 flex-1 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-sky-300",
                rejected && "opacity-60",
              )}
            >
              <span className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-semibold",
                    confirmed ? "bg-emerald-50 text-emerald-800" : rejected ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-900",
                  )}
                >
                  {signal.verification_status.replaceAll("_", " ")}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{signal.signal_type.replaceAll("_", " ")}</span>
                {signal.severity != null ? (
                  <span className={cn("inline-flex items-center gap-1 font-semibold", BAND_TEXT[band(signal.severity)])}>
                    <span className="size-2 rounded-full" style={{ backgroundColor: riskVar(signal.severity) }} aria-hidden />
                    Severity {signal.severity}
                    {signal.category ? ` · ${CATEGORY_LABEL[signal.category]}` : ""}
                  </span>
                ) : null}
              </span>
              <span className="mt-1.5 block font-medium break-words group-hover:underline">{signal.title}</span>
              <span className="mt-1 line-clamp-2 block text-sm text-slate-600">{signal.claim}</span>
              <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-sky-800">
                {domainOf(signal.url)}
                <ExternalLink className="size-3" aria-hidden />
              </span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}
