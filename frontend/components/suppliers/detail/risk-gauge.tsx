"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { Classification } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CLASS_LABEL, riskVar, useAnimatedNumber } from "./shared";

// Semicircle from (20,120) to (220,120), radius 100, centre (120,120).
const ARC = "M 20 120 A 100 100 0 0 1 220 120";

function point(value: number, radius: number) {
  const angle = Math.PI * (1 - value / 100);
  return { x: 120 + radius * Math.cos(angle), y: 120 - radius * Math.sin(angle) };
}

function zone(from: number, to: number) {
  const a = point(from, 112);
  const b = point(to, 112);
  return `M ${a.x} ${a.y} A 112 112 0 0 1 ${b.x} ${b.y}`;
}

export function RiskGauge({ score, classification }: { score: number | null; classification: Classification | null }) {
  // Score when the page opened: a new assessment in this session animates from it and shows the delta.
  const [baseline] = useState(() => ({ score, classification }));
  const shown = useAnimatedNumber(score);
  const unknown = classification == null || classification === "insufficient_data";
  const value = shown == null ? 0 : Math.max(0, Math.min(100, shown));
  const color = unknown ? "var(--risk-unknown)" : riskVar(value);
  const needle = point(value, 82);
  const changed = baseline.score != null && score != null && score !== baseline.score;
  const delta = changed ? score - baseline.score! : 0;
  const isNew = baseline.score == null && score != null;
  const label = classification == null ? "Not assessed" : CLASS_LABEL[classification];

  return (
    <div className="relative flex w-full max-w-[280px] flex-col items-center">
      <svg
        viewBox="0 0 240 140"
        className="w-full overflow-visible"
        role="img"
        aria-label={score == null ? "Overall risk score: not assessed" : `Overall risk score ${score.toFixed(1)} of 100, ${label}`}
      >
        {/* risk scale: low ≤ 30, medium ≤ 60, high */}
        <path d={zone(0, 29.5)} stroke="var(--risk-low)" strokeWidth="3" fill="none" opacity="0.7" strokeLinecap="round" />
        <path d={zone(30.5, 59.5)} stroke="var(--risk-medium)" strokeWidth="3" fill="none" opacity="0.7" strokeLinecap="round" />
        <path d={zone(60.5, 100)} stroke="var(--risk-high)" strokeWidth="3" fill="none" opacity="0.7" strokeLinecap="round" />
        <path
          d={ARC}
          stroke="currentColor"
          className="text-white/12"
          strokeWidth="16"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={unknown ? "4 5" : undefined}
        />
        {score != null ? (
          <path
            d={ARC}
            pathLength={100}
            stroke={color}
            strokeWidth="16"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${value} 100`}
            style={{ filter: unknown ? undefined : `drop-shadow(0 0 6px ${color})` }}
          />
        ) : null}
        {score != null ? (
          <>
            <line x1="120" y1="120" x2={needle.x} y2={needle.y} stroke="white" strokeWidth="3" strokeLinecap="round" />
            <circle cx="120" cy="120" r="7" fill="white" />
            <circle cx="120" cy="120" r="3" fill={color} />
          </>
        ) : null}
        <text x="20" y="138" textAnchor="middle" className="fill-white/50 text-[9px]">0</text>
        <text x="220" y="138" textAnchor="middle" className="fill-white/50 text-[9px]">100</text>
      </svg>
      <div className="-mt-2 flex flex-col items-center gap-1.5">
        <span className="text-5xl font-semibold tracking-tight tabular-nums text-white" aria-hidden>
          {shown == null ? "—" : shown.toFixed(1)}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-sm font-medium text-white",
            unknown && "border border-dashed border-white/50 text-white/80",
          )}
          style={unknown ? undefined : { backgroundColor: color }}
        >
          {classification == null || classification === "insufficient_data" ? label : `${label} risk`}
        </span>
      </div>
      {changed ? (
        <span
          key={score}
          role="status"
          className="absolute -top-2 right-0 inline-flex animate-in items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-primary shadow-lg zoom-in-50 fade-in duration-500 sm:-right-6"
        >
          {delta >= 0 ? (
            <ArrowUp className="size-3.5 text-red-600" aria-hidden />
          ) : (
            <ArrowDown className="size-3.5 text-emerald-700" aria-hidden />
          )}
          {delta >= 0 ? "+" : "−"}
          {Math.abs(delta).toFixed(1)}
          {baseline.classification !== classification && baseline.classification && classification
            ? ` · ${CLASS_LABEL[baseline.classification]} → ${CLASS_LABEL[classification]}`
            : null}
        </span>
      ) : isNew ? (
        <span
          role="status"
          className="absolute -top-2 right-0 animate-in rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-primary shadow-lg zoom-in-50 fade-in duration-500"
        >
          New assessment
        </span>
      ) : null}
      {changed ? (
        <span
          key={`ring-${score}`}
          aria-hidden
          className="pointer-events-none absolute inset-x-20 top-10 hidden aspect-square rounded-full border-4 motion-safe:block motion-safe:animate-[ping_1.4s_ease-out_2_forwards]"
          style={{ borderColor: color }}
        />
      ) : null}
    </div>
  );
}
