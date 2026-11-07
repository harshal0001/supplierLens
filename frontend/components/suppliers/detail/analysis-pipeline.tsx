"use client";

import { useEffect, useState } from "react";
import { Calculator, Check, FileText, Globe, ListChecks, LoaderCircle, TriangleExclamationPoint, X } from "lucide-react";
import type { AnalysisRun, AnalysisStep } from "@/lib/types";
import { formatWhen } from "@/lib/format";
import { cn } from "@/lib/utils";

const STEPS: Record<AnalysisStep["name"], { label: string; icon: typeof FileText }> = {
  process_documents: { label: "Process documents", icon: FileText },
  external_research: { label: "Web research", icon: Globe },
  score: { label: "Score", icon: Calculator },
  recommend: { label: "Recommend", icon: ListChecks },
};

function useElapsed(since: string, active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  const seconds = Math.max(0, Math.round((now - new Date(since).getTime()) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function Node({ step, index }: { step: AnalysisStep; index: number }) {
  const { icon: Icon } = STEPS[step.name];
  // External research failing is not fatal (the run continues on documents only), so it is a warning, not an error.
  const warn = step.status === "failed" && step.name === "external_research";
  return (
    <div className="relative grid size-11 place-items-center">
      {step.status === "running" ? (
        <span aria-hidden className="absolute inset-0 rounded-full bg-sky-500/40 motion-safe:animate-ping" />
      ) : null}
      <span
        className={cn(
          "relative grid size-11 place-items-center rounded-full border-2 transition-colors duration-500",
          step.status === "pending" && "border-dashed border-slate-300 bg-white text-slate-400",
          step.status === "running" && "border-sky-600 bg-primary text-white shadow-lg shadow-sky-900/30",
          step.status === "succeeded" && "border-emerald-600 bg-emerald-600 text-white",
          warn && "border-amber-500 bg-amber-500 text-white",
          step.status === "failed" && !warn && "border-red-600 bg-red-600 text-white",
        )}
      >
        {step.status === "running" ? (
          <LoaderCircle className="size-5 animate-spin" aria-hidden />
        ) : step.status === "succeeded" ? (
          <Check key={`ok-${index}`} className="size-5 animate-in zoom-in-0 duration-500" strokeWidth={3} aria-hidden />
        ) : warn ? (
          <TriangleExclamationPoint className="size-5" aria-hidden />
        ) : step.status === "failed" ? (
          <X className="size-5" aria-hidden />
        ) : (
          <Icon className="size-5" aria-hidden />
        )}
      </span>
    </div>
  );
}

export function AnalysisPipeline({ run }: { run: AnalysisRun }) {
  const active = run.status === "queued" || run.status === "running";
  const elapsed = useElapsed(run.created_at, active);
  const done = run.steps.filter((step) => step.status === "succeeded" || step.status === "failed").length;
  const running = run.steps.some((step) => step.status === "running");
  // Fill of the track between the first and last node: reaches node k when k steps are done, halfway on while running.
  const progress =
    run.status === "succeeded" || run.status === "failed"
      ? 100
      : Math.max(0, ((done - 1 + (running ? 0.5 : 0)) / (run.steps.length - 1)) * 100);
  const current = run.steps.findIndex((step) => step.status === "running");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
              active && "bg-sky-100 text-sky-900",
              run.status === "succeeded" && "bg-emerald-50 text-emerald-800",
              run.status === "failed" && "bg-red-50 text-red-700",
            )}
          >
            {active ? <span aria-hidden className="size-1.5 rounded-full bg-sky-600 motion-safe:animate-pulse" /> : null}
            {run.status}
          </span>
          {active ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {current >= 0 ? `Step ${current + 1} of ${run.steps.length} · ` : ""}
              {elapsed}
            </span>
          ) : null}
        </div>
        {!active && run.finished_at ? (
          <span className="text-xs text-muted-foreground">{formatWhen(run.finished_at, true)}</span>
        ) : null}
      </div>

      <ol className="relative grid grid-cols-4" aria-label="Analysis steps">
        {/* track behind the nodes, from the first to the last node centre */}
        <div aria-hidden className="absolute top-[22px] right-[12.5%] left-[12.5%] h-1 rounded-full bg-slate-200">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-1000 ease-out",
              run.status === "failed" ? "bg-red-500" : "bg-gradient-to-r from-sky-600 to-emerald-500",
              active && "motion-safe:animate-pulse",
            )}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
        {run.steps.map((step, index) => (
          <li key={step.name} className="relative flex flex-col items-center gap-2 text-center">
            <Node step={step} index={index} />
            <span
              className={cn(
                "text-xs leading-tight font-medium",
                step.status === "pending" ? "text-slate-400" : "text-foreground",
              )}
            >
              {STEPS[step.name].label}
              <span className="sr-only"> {step.status}</span>
            </span>
            {step.error ? (
              <span
                title={step.error}
                className={cn(
                  "line-clamp-2 px-1 text-[11px] leading-tight",
                  step.status === "failed" && step.name !== "external_research" ? "text-red-700" : "text-muted-foreground",
                )}
              >
                {step.error}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      {run.status === "failed" && run.error ? <p className="text-sm text-red-700">{run.error}</p> : null}
    </div>
  );
}
