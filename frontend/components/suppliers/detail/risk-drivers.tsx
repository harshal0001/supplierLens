"use client";

import { useState } from "react";
import { ChevronDown, CircleCheck, CircleQuestionMark, ExternalLink, FileText, Globe } from "lucide-react";
import type { Category, RiskAssessment, RiskIndicator } from "@/lib/types";
import { formatWhen } from "@/lib/format";
import { cn } from "@/lib/utils";
import { API_BASE, BAND_TEXT, BASIS, band, CATEGORIES, CATEGORY_ICON, CATEGORY_LABEL, domainOf, riskVar } from "./shared";

export function CategoryCards({
  risk,
  selected,
  onSelect,
}: {
  risk: RiskAssessment | null;
  selected: Category | null;
  onSelect: (category: Category | null) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {CATEGORIES.map((category, i) => {
        const cs = risk?.categories[category];
        const notAssessed = !cs || cs.score == null;
        const Icon = CATEGORY_ICON[category];
        const active = selected === category;
        return (
          <button
            key={category}
            type="button"
            aria-pressed={active}
            /* explicit name: the visible "no evidence" text must not make this match the "Evidence" buttons */
            aria-label={`${CATEGORY_LABEL[category]}: ${notAssessed ? "not assessed" : `score ${cs.score!.toFixed(0)}`}. Filter risk drivers`}
            onClick={() => onSelect(active ? null : category)}
            className={cn(
              "group flex min-w-0 animate-in flex-col gap-2 rounded-xl bg-card p-3 text-left ring-1 ring-foreground/10 transition-all fade-in slide-in-from-bottom-2 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              notAssessed && "bg-slate-50 ring-0 outline-1 outline-dashed outline-slate-300",
              active && "ring-2 ring-primary",
            )}
            style={{ animationDelay: `${i * 70}ms`, animationFillMode: "both" }}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Icon className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{CATEGORY_LABEL[category]}</span>
              </span>
              {cs?.indicator_count ? (
                <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground tabular-nums">
                  {cs.indicator_count}
                </span>
              ) : null}
            </span>
            {notAssessed ? (
              <>
                <span className="text-base font-semibold text-slate-500">Not assessed</span>
                <span className="h-1.5 rounded-full border border-dashed border-slate-300" aria-hidden />
                <span className="text-[11px] leading-tight text-slate-500">
                  {cs?.indicator_count ? "Not assessed. AI interpretation only" : "Not assessed, no evidence"}
                </span>
              </>
            ) : (
              <>
                <span className={cn("text-2xl font-semibold tabular-nums", BAND_TEXT[band(cs.score!)])}>{cs.score!.toFixed(0)}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span
                    className="block h-full animate-in rounded-full duration-1000 slide-in-from-left-full"
                    style={{ width: `${cs.score}%`, backgroundColor: riskVar(cs.score) }}
                  />
                </span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  Weight {Math.round(cs.weight * 100)}% · conf. {Math.round(cs.confidence * 100)}%
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

function BasisChip({ indicator }: { indicator: RiskIndicator }) {
  const { label, icon: Icon } = BASIS[indicator.basis];
  const signal = indicator.basis === "external_signal";
  // confirmed signals score with confidence 0.75 (risk_engine CONF), unverified with 0.5
  const confirmed = signal && indicator.confidence >= 0.75;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        indicator.basis === "document_fact" && "border-sky-200 bg-sky-50 text-sky-900",
        indicator.basis === "reference_data" && "border-slate-200 bg-slate-50 text-slate-700",
        indicator.basis === "ai_interpretation" && "border-dashed border-violet-300 bg-violet-50 text-violet-800",
        signal && (confirmed ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"),
      )}
    >
      <Icon className="size-3" aria-hidden />
      {label}
      {signal ? (
        confirmed ? (
          <>
            <CircleCheck className="size-3" aria-hidden /> confirmed
          </>
        ) : (
          <>
            <CircleQuestionMark className="size-3" aria-hidden /> unverified
          </>
        )
      ) : null}
    </span>
  );
}

function IndicatorRow({ indicator, open, onToggle }: { indicator: RiskIndicator; open: boolean; onToggle: () => void }) {
  const tone = band(indicator.severity);
  return (
    <li className="rounded-xl bg-card ring-1 ring-foreground/10 transition-shadow hover:shadow-sm">
      <div className="flex gap-3 p-3">
        <span className="w-1 shrink-0 rounded-full" style={{ backgroundColor: riskVar(indicator.severity) }} aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="min-w-0 font-medium break-words">{indicator.label}</p>
            <BasisChip indicator={indicator} />
          </div>
          <div className="flex items-center gap-3">
            {indicator.value ? (
              <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-sm font-semibold tabular-nums">{indicator.value}</span>
            ) : null}
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span
                className="block h-full animate-in rounded-full duration-700 slide-in-from-left-full"
                style={{ width: `${indicator.severity}%`, backgroundColor: riskVar(indicator.severity) }}
              />
            </span>
            <span className={cn("w-20 shrink-0 text-right text-xs font-semibold tabular-nums", BAND_TEXT[tone])}>
              Severity {indicator.severity.toFixed(0)}
            </span>
          </div>
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-1 rounded-md text-sm font-medium text-sky-800 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            aria-expanded={open}
            onClick={onToggle}
          >
            Evidence
            <ChevronDown className={cn("size-4 transition-transform duration-300", open && "rotate-180")} aria-hidden />
          </button>
          {open ? (
            <ul className="animate-in space-y-2 fade-in slide-in-from-top-1 duration-300">
              {indicator.evidence.map((item) => (
                <li key={item.id} className="rounded-lg border-l-4 border-sky-700 bg-sky-50/60 p-3 text-sm">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    {item.source_type === "external" ? (
                      <Globe className="size-3.5" aria-hidden />
                    ) : (
                      <FileText className="size-3.5" aria-hidden />
                    )}
                    <span className="truncate">{item.title}</span>
                  </p>
                  <blockquote className="mt-1.5 leading-6 text-slate-800">
                    “<mark className="rounded bg-amber-200/70 px-0.5 text-slate-900">{item.excerpt}</mark>”
                  </blockquote>
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {item.document_id != null && item.page_number != null ? (
                      <a
                        className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 font-medium text-sky-800 ring-1 ring-sky-200 hover:bg-sky-100"
                        href={`${API_BASE}/api/documents/${item.document_id}/file#page=${item.page_number}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FileText className="size-3" aria-hidden />
                        Page {item.page_number}
                      </a>
                    ) : null}
                    {item.url ? (
                      <a
                        className="inline-flex items-center gap-1 font-medium text-sky-800 underline"
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {domainOf(item.url)}
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    ) : null}
                    {item.source_date ? <span>{formatWhen(item.source_date)}</span> : null}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function IndicatorList({ risk, selected }: { risk: RiskAssessment; selected: Category | null }) {
  const [open, setOpen] = useState<number | null>(null);
  const shown = CATEGORIES.filter((category) => selected == null || selected === category);
  const groups = shown
    .map((category) => ({ category, items: risk.indicators.filter((indicator) => indicator.category === category) }))
    .filter((group) => group.items.length > 0);

  if (groups.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
        No indicators{selected ? ` in ${CATEGORY_LABEL[selected]}` : ""}. Missing evidence is shown as not assessed, never as low risk.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(({ category, items }) => {
        const Icon = CATEGORY_ICON[category];
        return (
          <div key={category} className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
              <Icon className="size-4" aria-hidden />
              {CATEGORY_LABEL[category]}
            </h3>
            <ul className="space-y-2">
              {items.map((indicator) => (
                <IndicatorRow
                  key={indicator.id}
                  indicator={indicator}
                  open={open === indicator.id}
                  onToggle={() => setOpen(open === indicator.id ? null : indicator.id)}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
