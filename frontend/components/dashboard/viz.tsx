"use client";

import { useEffect, useState } from "react";
import type { Classification } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Classification key used across the visuals; null (never analysed) becomes "not_assessed". */
export type RiskKey = Classification | "not_assessed";

export const RISK_KEYS: RiskKey[] = ["high", "medium", "low", "insufficient_data", "not_assessed"];

export const RISK_META: Record<RiskKey, { label: string; color: string; text: string; dashed: boolean }> = {
  high: { label: "High", color: "var(--risk-high)", text: "text-red-700", dashed: false },
  medium: { label: "Medium", color: "var(--risk-medium)", text: "text-amber-800", dashed: false },
  low: { label: "Low", color: "var(--risk-low)", text: "text-emerald-800", dashed: false },
  insufficient_data: { label: "Insufficient data", color: "var(--risk-unknown)", text: "text-slate-600", dashed: true },
  not_assessed: { label: "Not assessed", color: "var(--chart-5)", text: "text-slate-600", dashed: true },
};

export function riskKey(classification: Classification | null): RiskKey {
  return classification ?? "not_assessed";
}

/** Same bands as the risk engine: low ≤ 30 < medium ≤ 60 < high. */
export function bandFor(score: number | null): RiskKey {
  if (score == null) return "not_assessed";
  return score <= 30 ? "low" : score <= 60 ? "medium" : "high";
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** True one frame after mount, so CSS transitions can animate from their zero state. */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return mounted;
}

/** Counts from 0 to `target` with an ease-out curve; jumps straight there under reduced motion. */
export function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const reduce = prefersReducedMotion();
    const tick = (now: number) => {
      const t = reduce ? 1 : Math.min(1, (now - start) / duration);
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

export function CountUp({ value, decimals = 0, className }: { value: number; decimals?: number; className?: string }) {
  const shown = useCountUp(value);
  return <span className={cn("tabular-nums", className)}>{shown.toFixed(decimals)}</span>;
}

/** Horizontal 0–100 score bar. Unassessed or insufficient data is a dashed grey track, never a coloured bar. */
export function ScoreBar({
  score,
  classification,
  className,
}: {
  score: number | null;
  classification: Classification | null;
  className?: string;
}) {
  const mounted = useMounted();
  const key = riskKey(classification);
  const meta = RISK_META[key];
  const width = score == null ? 0 : Math.max(2, Math.min(100, score));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "relative h-2 flex-1 overflow-hidden rounded-full bg-muted",
          meta.dashed && "border border-dashed border-risk-unknown bg-transparent",
        )}
        role="img"
        aria-label={score == null ? meta.label : `Score ${score.toFixed(1)} of 100, ${meta.label}`}
      >
        {score != null ? (
          <div
            className={cn("h-full rounded-full transition-[width] duration-1000 ease-out", meta.dashed && "opacity-40")}
            style={{ width: mounted ? `${width}%` : "0%", backgroundColor: meta.color }}
          />
        ) : null}
      </div>
      <span className={cn("w-9 text-right text-xs font-semibold tabular-nums", meta.text)}>
        {score == null ? "—" : score.toFixed(1)}
      </span>
    </div>
  );
}

/** Circular gauge: `fraction` (0–1) of the ring is filled. Text in the centre is supplied by the caller. */
export function RingGauge({
  fraction,
  color,
  dashed = false,
  size = 64,
  stroke = 7,
  label,
  children,
}: {
  fraction: number;
  color: string;
  dashed?: boolean;
  size?: number;
  stroke?: number;
  label: string;
  children?: React.ReactNode;
}) {
  const mounted = useMounted();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, fraction)) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={dashed ? "var(--risk-unknown)" : "var(--muted)"}
          strokeWidth={dashed ? 1.5 : stroke}
          strokeDasharray={dashed ? "4 4" : undefined}
        />
        {fraction > 0 && !dashed ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${mounted ? filled : 0} ${c}`}
            className="transition-[stroke-dasharray] duration-1000 ease-out"
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">{children}</div>
    </div>
  );
}

export function SyntheticBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-dashed border-slate-300 px-1.5 py-px text-[10px] font-medium whitespace-nowrap text-slate-500",
        className,
      )}
    >
      Synthetic demo data
    </span>
  );
}
