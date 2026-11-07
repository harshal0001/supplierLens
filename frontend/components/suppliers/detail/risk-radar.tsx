"use client";

import type { Category, RiskAssessment } from "@/lib/types";
import { CATEGORIES, CATEGORY_LABEL, riskVar } from "./shared";

const C = 150; // centre of the 300×280 viewBox
const R = 92;

function at(index: number, value: number) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / CATEGORIES.length;
  const r = (value / 100) * R;
  return { x: C + r * Math.cos(angle), y: 140 + r * Math.sin(angle) };
}

function ring(value: number) {
  return CATEGORIES.map((_, i) => at(i, value))
    .map((p) => `${p.x},${p.y}`)
    .join(" ");
}

/**
 * Category profile. Only assessed categories are plotted; a not-assessed axis is dashed grey with a hollow marker,
 * never drawn as a low value.
 */
export function RiskRadar({
  risk,
  selected,
  onSelect,
}: {
  risk: RiskAssessment | null;
  selected: Category | null;
  onSelect: (category: Category | null) => void;
}) {
  const scores = CATEGORIES.map((category) => risk?.categories[category]?.score ?? null);
  const plotted = scores.flatMap((score, i) => (score == null ? [] : [{ i, score, ...at(i, score) }]));
  const description = CATEGORIES.map(
    (category, i) => `${CATEGORY_LABEL[category]} ${scores[i] == null ? "not assessed" : scores[i]!.toFixed(0)}`,
  ).join(", ");

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 300 280" className="w-full max-w-[340px]" role="img" aria-label={`Risk by category: ${description}`}>
        {[100, 60, 30].map((v) => (
          <polygon
            key={v}
            points={ring(v)}
            fill={v === 100 ? "var(--risk-high)" : v === 60 ? "var(--risk-medium)" : "var(--risk-low)"}
            fillOpacity={0.06}
            stroke="var(--border)"
            strokeWidth={1}
          />
        ))}
        {CATEGORIES.map((category, i) => {
          const end = at(i, 100);
          const label = at(i, 128);
          const assessed = scores[i] != null;
          const active = selected === category;
          return (
            <g
              key={category}
              className="cursor-pointer"
              onClick={() => onSelect(active ? null : category)}
              aria-hidden
            >
              <line
                x1={C}
                y1={140}
                x2={end.x}
                y2={end.y}
                stroke={assessed ? "var(--border)" : "var(--risk-unknown)"}
                strokeDasharray={assessed ? undefined : "3 4"}
                strokeWidth={assessed ? 1 : 1.5}
              />
              {!assessed ? (
                <circle cx={end.x} cy={end.y} r={6} fill="white" stroke="var(--risk-unknown)" strokeDasharray="2 2" strokeWidth={1.5} />
              ) : null}
              <text
                x={label.x}
                y={label.y - (assessed ? 0 : 5)}
                textAnchor="middle"
                dominantBaseline="middle"
                className={active ? "fill-primary text-[12px] font-bold" : assessed ? "fill-slate-700 text-[11px] font-medium" : "fill-slate-400 text-[11px]"}
              >
                {CATEGORY_LABEL[category]}
              </text>
              <text
                x={label.x}
                y={label.y + (assessed ? 13 : 8)}
                textAnchor="middle"
                dominantBaseline="middle"
                className={assessed ? "text-[11px] font-semibold" : "fill-slate-400 text-[9px] italic"}
                style={assessed ? { fill: riskVar(scores[i]) } : undefined}
              >
                {assessed ? scores[i]!.toFixed(0) : "not assessed"}
              </text>
            </g>
          );
        })}
        {plotted.length > 0 ? (
          <g className="origin-[150px_140px] animate-in zoom-in-0 fade-in duration-1000">
            {plotted.length > 1 ? (
              <polygon
                points={plotted.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="var(--primary)"
                fillOpacity={0.14}
                stroke="var(--primary)"
                strokeWidth={2}
                strokeLinejoin="round"
              />
            ) : null}
            {plotted.map((p) => (
              <circle key={p.i} cx={p.x} cy={p.y} r={5} fill={riskVar(p.score)} stroke="white" strokeWidth={2} />
            ))}
          </g>
        ) : null}
      </svg>
      <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-primary" aria-hidden /> Scored
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border border-dashed border-risk-unknown" aria-hidden /> Not assessed (not plotted)
        </span>
      </p>
    </div>
  );
}
