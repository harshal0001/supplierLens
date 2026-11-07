"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  ExternalLink,
  FileText,
  Globe,
  X,
} from "lucide-react";
import type { ActionItem, Citation, SupplierSummary } from "@/lib/types";
import { RiskBadge } from "@/components/risk/risk-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Web source";
  }
}

/** Numbered source card: document page, web article, or a data check. Clicking the header expands the excerpt. */
export function SourceCard({
  citation: c,
  number,
  open,
  onToggle,
}: {
  citation: Citation;
  number: number;
  open: boolean;
  onToggle: () => void;
}) {
  const isDoc = c.document_id != null;
  const Icon = isDoc ? FileText : c.url ? Globe : ClipboardCheck;
  const kind = isDoc
    ? `Document${c.page_number != null ? ` · page ${c.page_number}` : ""}`
    : c.url
      ? host(c.url)
      : "Data check";
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border bg-background p-3 transition-all duration-200",
        open ? "border-sky-300 shadow-md ring-2 ring-sky-100" : "border-border hover:border-sky-200 hover:shadow-sm",
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full min-w-0 cursor-pointer items-start gap-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-sky-300 rounded-md"
      >
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg",
            isDoc ? "bg-primary text-primary-foreground" : "bg-sky-50 text-sky-800",
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <span className="rounded bg-sky-100 px-1 font-semibold text-sky-900 tabular-nums">[{number}]</span>
            <span className="truncate">{kind}</span>
          </span>
          <span className="mt-0.5 line-clamp-2 text-xs font-medium leading-snug text-foreground">{c.title}</span>
        </span>
        <ChevronDown
          className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      <p
        className={cn(
          "mt-2 border-l-2 border-sky-200 pl-2 text-xs leading-relaxed text-slate-600",
          !open && "line-clamp-2",
        )}
      >
        “{c.excerpt}”
      </p>
      {open ? (
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium animate-in fade-in duration-300">
          {c.document_id != null && c.page_number != null ? (
            <a
              className="inline-flex items-center gap-1 text-sky-800 hover:underline"
              href={`${API_BASE}/api/documents/${c.document_id}/file#page=${c.page_number}`}
              target="_blank"
              rel="noreferrer"
            >
              <FileText className="size-3" aria-hidden /> Open page {c.page_number}
            </a>
          ) : null}
          {c.url ? (
            <a
              className="inline-flex items-center gap-1 text-sky-800 hover:underline"
              href={c.url}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="size-3" aria-hidden /> Open source
            </a>
          ) : null}
          <Link className="inline-flex items-center gap-1 text-sky-800 hover:underline" href={`/suppliers/${c.supplier_id}`}>
            <ArrowUpRight className="size-3" aria-hidden /> Supplier page
          </Link>
        </p>
      ) : null}
    </div>
  );
}

const RISK_VAR = { high: "var(--risk-high)", medium: "var(--risk-medium)", low: "var(--risk-low)" } as const;

/** Score ring + name + risk label, linking to the supplier. Not assessed = grey dashed ring, never green. */
export function SupplierRiskChip({ supplier: s }: { supplier: SupplierSummary }) {
  const assessed = s.overall_score != null && s.classification != null && s.classification !== "insufficient_data";
  const r = 15;
  const circumference = 2 * Math.PI * r;
  const stroke = assessed ? RISK_VAR[s.classification as keyof typeof RISK_VAR] : "var(--risk-unknown)";
  return (
    <Link
      href={`/suppliers/${s.id}`}
      className="group inline-flex max-w-full min-w-0 items-center gap-2.5 rounded-full border border-border bg-background py-1 pr-3 pl-1 transition-all hover:border-sky-300 hover:shadow-sm"
    >
      <span className="relative grid size-9 shrink-0 place-items-center">
        <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="18" cy="18" r={r} fill="none" stroke="var(--border)" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={assessed ? `${(circumference * (s.overall_score ?? 0)) / 100} ${circumference}` : "3 3"}
          />
        </svg>
        <span className="text-[11px] font-semibold tabular-nums">
          {s.overall_score != null ? Math.round(s.overall_score) : "–"}
        </span>
      </span>
      <span className="min-w-0 truncate text-xs font-medium">{s.name}</span>
      <RiskBadge classification={s.classification} />
      <ArrowUpRight
        className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        aria-hidden
      />
    </Link>
  );
}

const PRIORITY = {
  high: "border-risk-high/30 bg-risk-high/10 text-red-800",
  medium: "border-risk-medium/40 bg-risk-medium/15 text-amber-900",
  low: "border-border bg-muted text-slate-700",
} as const;

/** A proposed follow-up action the user approves or rejects. */
export function ActionCard({
  action: a,
  onDecide,
}: {
  action: ActionItem;
  onDecide: (decision: "approved" | "rejected") => void;
}) {
  return (
    <div className="flex min-w-0 gap-3 rounded-xl border border-sky-200 bg-sky-50/60 p-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
        <ClipboardList className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{a.title}</p>
          <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", PRIORITY[a.priority])}>
            {a.priority} priority
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{a.rationale}</p>
        <div className="mt-2 flex items-center gap-2">
          {a.status === "proposed" ? (
            <>
              <Button size="sm" onClick={() => onDecide("approved")}>
                <Check aria-hidden /> Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => onDecide("rejected")}>
                <X aria-hidden /> Reject
              </Button>
            </>
          ) : (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium capitalize animate-in fade-in zoom-in-95",
                a.status === "rejected" ? "text-muted-foreground" : "text-sky-800",
              )}
            >
              {a.status === "rejected" ? <X className="size-3.5" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
              {a.status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Reveals text letter by letter (instantly with reduced motion); screen readers get the full text at once. */
export function Typewriter({ text }: { text: string }) {
  // Only rendered after a question was asked, so window exists.
  const [shown, setShown] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ? text.length : 0,
  );
  useEffect(() => {
    if (shown >= text.length) return;
    const timer = setTimeout(() => setShown((n) => n + Math.max(1, Math.ceil(text.length / 40))), 18); // ~0.7 s total
    return () => clearTimeout(timer);
  }, [shown, text]);
  return (
    <>
      <span aria-hidden>{text.slice(0, shown)}</span>
      <span className="sr-only">{text}</span>
    </>
  );
}
