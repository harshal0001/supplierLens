"use client";

import { Area, AreaChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RiskHistoryPoint } from "@/lib/types";
import { formatWhen } from "@/lib/format";
import { CLASS_LABEL, useReducedMotion } from "./shared";

function classColor(classification: RiskHistoryPoint["classification"]) {
  return classification === "insufficient_data" ? "var(--risk-unknown)" : `var(--risk-${classification})`;
}

export function ScoreHistory({ history }: { history: RiskHistoryPoint[] }) {
  const reduced = useReducedMotion();
  const data = history.map((point, i) => ({ ...point, n: i + 1, when: formatWhen(point.created_at, true) }));
  const first = history[0];
  const last = history.at(-1);
  const delta = first && last && first.overall_score != null && last.overall_score != null ? last.overall_score - first.overall_score : null;

  if (history.length === 0) {
    return (
      <div className="grid h-[200px] place-items-center rounded-lg border border-dashed border-slate-300 text-sm text-muted-foreground">
        No assessments yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="text-xs text-muted-foreground">
          {history.length} {history.length === 1 ? "assessment" : "assessments"}
        </span>
        {delta != null && history.length > 1 ? (
          <span className={delta > 0 ? "text-xs font-semibold text-red-700" : "text-xs font-semibold text-emerald-800"}>
            {delta > 0 ? "▲ +" : delta < 0 ? "▼ −" : "± "}
            {Math.abs(delta).toFixed(1)} since first
          </span>
        ) : null}
      </div>
      <div className="h-[180px]" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: -24 }}>
            <defs>
              <linearGradient id="history-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <ReferenceArea y1={0} y2={30} fill="var(--risk-low)" fillOpacity={0.06} />
            <ReferenceArea y1={30} y2={60} fill="var(--risk-medium)" fillOpacity={0.07} />
            <ReferenceArea y1={60} y2={100} fill="var(--risk-high)" fillOpacity={0.06} />
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="n" tickFormatter={(n: number) => `#${n}`} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" padding={{ left: 16, right: 16 }} />
            <YAxis domain={[0, 100]} ticks={[0, 30, 60, 100]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
            <Tooltip
              formatter={(value) => [typeof value === "number" ? value.toFixed(1) : "—", "Score"]}
              labelFormatter={(_, payload) => {
                const point = payload?.[0]?.payload as (typeof data)[number] | undefined;
                return point ? `${point.when} · ${CLASS_LABEL[point.classification]}` : "";
              }}
            />
            <Area
              type="monotone"
              dataKey="overall_score"
              stroke="var(--primary)"
              strokeWidth={2.5}
              fill="url(#history-fill)"
              isAnimationActive={!reduced}
              animationDuration={1200}
              dot={(props: { cx?: number; cy?: number; index?: number; payload?: RiskHistoryPoint }) => (
                <circle
                  key={props.index}
                  cx={props.cx}
                  cy={props.cy}
                  r={props.index === data.length - 1 ? 6 : 4}
                  fill={props.payload ? classColor(props.payload.classification) : "var(--primary)"}
                  stroke="white"
                  strokeWidth={2}
                />
              )}
              activeDot={{ r: 7 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <ol className="sr-only">
        {history.map((point) => (
          <li key={point.id}>
            {formatWhen(point.created_at, true)}: {point.overall_score == null ? "not assessed" : point.overall_score.toFixed(1)},{" "}
            {CLASS_LABEL[point.classification]}
          </li>
        ))}
      </ol>
    </div>
  );
}
