"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Building2, Check, ClipboardList, FileWarning, Plus, ShieldAlert, X } from "lucide-react";
import { api, asApiFailure } from "@/lib/api";
import { formatWhen } from "@/lib/format";
import type { ActionItem, Category, Dashboard, RiskAssessment, SupplierSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  CountUp,
  RISK_KEYS,
  RISK_META,
  RingGauge,
  ScoreBar,
  SyntheticBadge,
  bandFor,
  riskKey,
  useMounted,
  type RiskKey,
} from "@/components/dashboard/viz";

const CATEGORIES: { key: Category; label: string; short: string }[] = [
  { key: "financial", label: "Financial", short: "Fin" },
  { key: "operational", label: "Operational", short: "Ops" },
  { key: "delivery", label: "Delivery", short: "Del" },
  { key: "compliance", label: "Compliance", short: "Comp" },
  { key: "external", label: "External", short: "Ext" },
];

type RiskMap = Record<number, RiskAssessment | null>; // null = never analysed (404)

export function DashboardView() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierSummary[] | null>(null);
  const [risks, setRisks] = useState<RiskMap>({});
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [filter, setFilter] = useState<RiskKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api<Dashboard>("/api/dashboard"), api<SupplierSummary[]>("/api/suppliers")])
      .then(([dashboard, list]) => {
        if (cancelled) return;
        setData(dashboard);
        setSuppliers(list);
        // shortcut: one request per supplier, fine for ≤ 50; add categories to /api/dashboard when it grows
        for (const supplier of list) {
          if (supplier.classification == null) {
            setRisks((current) => ({ ...current, [supplier.id]: null }));
            continue;
          }
          api<RiskAssessment>(`/api/suppliers/${supplier.id}/risk`)
            .then((risk) => !cancelled && setRisks((current) => ({ ...current, [supplier.id]: risk })))
            .catch(() => !cancelled && setRisks((current) => ({ ...current, [supplier.id]: null })));
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(asApiFailure(cause).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function updateAction(action: ActionItem, status: "approved" | "rejected") {
    setPendingId(action.id);
    try {
      const updated = await api<ActionItem>(`/api/actions/${action.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setData((current) => {
        if (!current) return current;
        const open = current.open_actions
          .map((item) => (item.id === updated.id ? updated : item))
          .filter((item) => item.status === "proposed" || item.status === "approved");
        return { ...current, open_actions: open };
      });
      toast.success(status === "approved" ? "Action approved" : "Action rejected");
    } catch (cause) {
      toast.error(asApiFailure(cause).message);
    } finally {
      setPendingId(null);
    }
  }

  // Scroll instead of href="#…": a native hash link adds a history entry the Next router can't restore on Back.
  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function focusMatrix(next: RiskKey | null) {
    setFilter(next);
    scrollTo("risk-matrix");
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dashboard unavailable</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!data || !suppliers) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-80" />
          <Skeleton className="h-80 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (data.totals.suppliers === 0) {
    return (
      <Card className="items-start">
        <CardHeader>
          <CardTitle>No suppliers yet</CardTitle>
          <CardDescription>Add a supplier to start an evidence-backed risk review.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button nativeButton={false} render={<Link href="/suppliers" />}>
            <Plus className="size-4" aria-hidden />
            Add supplier
          </Button>
        </CardContent>
      </Card>
    );
  }

  const expired = data.certifications.filter((certificate) => certificate.days_left < 0).length;
  const highPriority = data.open_actions.filter((action) => action.priority === "high").length;

  return (
    <TooltipProvider>
      <div className="space-y-5">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Key figures">
          <KpiTile
            icon={Building2}
            label="Suppliers"
            value={data.totals.suppliers}
            caption={`${data.totals.suppliers - data.totals.not_assessed} assessed`}
            accent="var(--primary)"
            onClick={() => focusMatrix(null)}
            delay={0}
          />
          <KpiTile
            icon={ShieldAlert}
            label="High risk"
            value={data.totals.high}
            caption={`${data.totals.medium} medium · ${data.totals.low} low`}
            accent="var(--risk-high)"
            onClick={() => focusMatrix("high")}
            delay={75}
          />
          <KpiTile
            icon={FileWarning}
            label="Certificates due"
            value={data.certifications.length}
            caption={expired ? `${expired} already expired` : "Within 90 days"}
            accent="var(--risk-medium)"
            onClick={() => scrollTo("certificates")}
            delay={150}
          />
          <KpiTile
            icon={ClipboardList}
            label="Open actions"
            value={data.open_actions.length}
            caption={`${highPriority} high priority`}
            accent="var(--ring)"
            onClick={() => scrollTo("actions")}
            delay={225}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <RiskDonut totals={data.totals} active={filter} onSelect={setFilter} />
          <RiskMatrix
            suppliers={suppliers}
            risks={risks}
            filter={filter}
            onClearFilter={() => setFilter(null)}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-5">
          <CertificateCountdown certifications={data.certifications} suppliers={suppliers} />
          <OpenActions actions={data.open_actions} pendingId={pendingId} onUpdate={updateAction} />
        </section>
      </div>
    </TooltipProvider>
  );
}

function KpiTile({
  icon: Icon,
  label,
  value,
  caption,
  accent,
  onClick,
  delay,
}: {
  icon: typeof Building2;
  label: string;
  value: number;
  caption: string;
  accent: string;
  onClick: () => void;
  delay: number;
}) {
  const body = (
    <>
      <span
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: accent }}
        aria-hidden
      />
      <span className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
        <span
          className="grid size-9 shrink-0 place-items-center rounded-lg transition-transform duration-300 group-hover:scale-110"
          style={{ backgroundColor: `color-mix(in oklch, ${accent} 14%, transparent)`, color: accent }}
          aria-hidden
        >
          <Icon className="size-4.5" />
        </span>
      </span>
      <CountUp value={value} className="text-3xl font-semibold tracking-tight sm:text-4xl" />
      <span className="truncate text-xs text-muted-foreground">{caption}</span>
    </>
  );
  const className = cn(
    "group relative flex flex-col gap-1 overflow-hidden rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10 transition-all duration-300",
    "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
    "animate-in fill-mode-both fade-in slide-in-from-bottom-2 duration-500",
  );
  const style = { animationDelay: `${delay}ms` };
  return (
    <button type="button" onClick={onClick} className={className} style={style}>
      {body}
    </button>
  );
}

function RiskDonut({
  totals,
  active,
  onSelect,
}: {
  totals: Dashboard["totals"];
  active: RiskKey | null;
  onSelect: (key: RiskKey | null) => void;
}) {
  const mounted = useMounted();
  const [hover, setHover] = useState<RiskKey | null>(null);
  const size = 200;
  const stroke = 26;
  const r = (size - stroke - 10) / 2; // leaves room for the hovered segment to grow
  const c = 2 * Math.PI * r;
  const total = totals.suppliers;
  const slices = RISK_KEYS.map((key, index) => ({
    key,
    value: totals[key],
    start: (RISK_KEYS.slice(0, index).reduce((sum, previous) => sum + totals[previous], 0) / total) * c,
  }));
  const gap = slices.filter((slice) => slice.value > 0).length > 1 ? 4 : 0;
  const focus = hover ?? active;

  return (
    <Card className="animate-in fill-mode-both fade-in duration-700">
      <CardHeader>
        <CardTitle>Risk distribution</CardTitle>
        <CardDescription>Click a segment to filter the matrix.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-5">
        <div className="relative" style={{ width: size, height: size }}>
          <svg
            width={size}
            height={size}
            className="-rotate-90"
            role="group"
            aria-label={`Risk distribution: ${slices.map((s) => `${RISK_META[s.key].label} ${s.value}`).join(", ")}`}
          >
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
            {slices.map((slice) => {
              if (slice.value === 0) return null;
              const length = (slice.value / total) * c;
              const dash = Math.max(0, length - gap);
              const meta = RISK_META[slice.key];
              const dim = focus != null && focus !== slice.key;
              return (
                <circle
                  key={slice.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={meta.color}
                  strokeWidth={focus === slice.key ? stroke + 8 : stroke}
                  strokeDasharray={`${mounted ? dash : 0} ${c}`}
                  strokeDashoffset={-slice.start}
                  className="cursor-pointer outline-none transition-all duration-700 ease-out"
                  style={{ opacity: dim ? 0.25 : 1 }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${meta.label}: ${slice.value} supplier${slice.value === 1 ? "" : "s"}`}
                  aria-pressed={active === slice.key}
                  onMouseEnter={() => setHover(slice.key)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(slice.key)}
                  onBlur={() => setHover(null)}
                  onClick={() => onSelect(active === slice.key ? null : slice.key)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(active === slice.key ? null : slice.key);
                    }
                  }}
                />
              );
            })}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {focus ? (
              <>
                <span className={cn("text-4xl font-semibold tabular-nums", RISK_META[focus].text)}>{totals[focus]}</span>
                <span className="text-xs text-muted-foreground">{RISK_META[focus].label}</span>
              </>
            ) : (
              <>
                <CountUp value={total} className="text-4xl font-semibold" />
                <span className="text-xs text-muted-foreground">suppliers</span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {slices.map((slice) => {
            const meta = RISK_META[slice.key];
            const pressed = active === slice.key;
            return (
              <button
                key={slice.key}
                type="button"
                disabled={slice.value === 0}
                aria-pressed={pressed}
                onClick={() => onSelect(pressed ? null : slice.key)}
                onMouseEnter={() => setHover(slice.key)}
                onMouseLeave={() => setHover(null)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-40",
                  pressed ? "border-foreground/30 bg-foreground text-background" : "border-border hover:bg-muted",
                )}
              >
                <span
                  className={cn("size-2.5 rounded-full", meta.dashed && "border border-dashed border-risk-unknown")}
                  style={{ backgroundColor: meta.dashed ? "transparent" : meta.color }}
                  aria-hidden
                />
                {meta.label}
                <span className="font-semibold tabular-nums">{slice.value}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function RiskMatrix({
  suppliers,
  risks,
  filter,
  onClearFilter,
}: {
  suppliers: SupplierSummary[];
  risks: RiskMap;
  filter: RiskKey | null;
  onClearFilter: () => void;
}) {
  const rows = useMemo(
    () => suppliers.filter((supplier) => filter == null || riskKey(supplier.classification) === filter),
    [suppliers, filter],
  );

  return (
    <Card id="risk-matrix" className="scroll-mt-6 animate-in fill-mode-both fade-in duration-700 lg:col-span-2">
      <CardHeader className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>Risk matrix</CardTitle>
          <CardDescription>Overall score and the five risk categories. Click any cell to open the supplier.</CardDescription>
        </div>
        {filter ? (
          <button
            type="button"
            onClick={onClearFilter}
            className="inline-flex items-center gap-1 rounded-full bg-foreground px-2.5 py-1 text-xs text-background animate-in fade-in zoom-in-95"
          >
            {RISK_META[filter].label}
            <X className="size-3" aria-hidden />
            <span className="sr-only">Clear filter</span>
          </button>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] border-separate border-spacing-1 text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="sticky left-0 z-20 bg-card px-1 text-left font-medium">Supplier</th>
                <th className="w-32 px-1 text-left font-medium sm:w-40">Overall</th>
                {CATEGORIES.map((category) => (
                  <th key={category.key} className="w-14 px-0 text-center font-medium" title={category.label}>
                    <span className="hidden xl:inline">{category.label}</span>
                    <span className="xl:hidden">{category.short}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((supplier, index) => {
                const risk = risks[supplier.id];
                const href = `/suppliers/${supplier.id}`;
                return (
                  <tr
                    key={supplier.id}
                    className="animate-in fill-mode-both fade-in slide-in-from-left-2 duration-500"
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <td className="sticky left-0 z-20 max-w-40 bg-card px-1 py-1 align-middle sm:max-w-56">
                      <Link href={href} className="font-medium hover:underline">
                        {supplier.name}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                        <span>{supplier.country}</span>
                        {supplier.is_synthetic ? <SyntheticBadge /> : null}
                      </div>
                    </td>
                    <td className="px-1 align-middle">
                      <ScoreBar score={supplier.overall_score} classification={supplier.classification} />
                    </td>
                    {CATEGORIES.map((category) => (
                      <td key={category.key} className="p-0 align-middle">
                        <HeatCell
                          href={href}
                          supplier={supplier.name}
                          category={category.label}
                          loading={risk === undefined}
                          score={risk ? risk.categories[category.key].score : null}
                          indicators={risk ? risk.categories[category.key].indicator_count : 0}
                          confidence={risk ? risk.categories[category.key].confidence : 0}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {(["low", "medium", "high"] as const).map((key) => (
            <span key={key} className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ backgroundColor: RISK_META[key].color }} aria-hidden />
              {RISK_META[key].label} {key === "low" ? "≤ 30" : key === "medium" ? "31–60" : "> 60"}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm border border-dashed border-risk-unknown" aria-hidden />
            Not assessed
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function HeatCell({
  href,
  supplier,
  category,
  loading,
  score,
  indicators,
  confidence,
}: {
  href: string;
  supplier: string;
  category: string;
  loading: boolean;
  score: number | null;
  indicators: number;
  confidence: number;
}) {
  if (loading) return <div className="h-10 animate-pulse rounded-md bg-muted" aria-hidden />;
  const band = bandFor(score);
  const meta = RISK_META[band];
  // Heat intensity grows with the score inside its band colour; unassessed stays a dashed grey outline.
  const background =
    score == null ? "transparent" : `color-mix(in oklch, ${meta.color} ${Math.round(22 + score * 0.6)}%, white)`;
  const label =
    score == null ? `${supplier}, ${category}: not assessed` : `${supplier}, ${category}: ${score.toFixed(0)} (${meta.label})`;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={href}
            aria-label={label}
            className={cn(
              "flex h-10 items-center justify-center rounded-md text-xs font-semibold tabular-nums transition-transform duration-200 hover:z-10 hover:scale-110 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              score == null ? "border border-dashed border-risk-unknown text-slate-500" : "text-slate-900",
            )}
            style={{ background }}
          />
        }
      >
        {score == null ? "—" : score.toFixed(0)}
      </TooltipTrigger>
      <TooltipContent>
        {score == null
          ? `${category} · Not assessed`
          : `${category} · ${score.toFixed(0)} ${meta.label} · ${indicators} indicator${indicators === 1 ? "" : "s"} · ${Math.round(confidence * 100)}% confidence`}
      </TooltipContent>
    </Tooltip>
  );
}

function CertificateCountdown({
  certifications,
  suppliers,
}: {
  certifications: Dashboard["certifications"];
  suppliers: SupplierSummary[];
}) {
  const synthetic = new Set(suppliers.filter((supplier) => supplier.is_synthetic).map((supplier) => supplier.id));
  const sorted = [...certifications].sort((a, b) => a.days_left - b.days_left);
  return (
    <Card id="certificates" className="scroll-mt-6 lg:col-span-2">
      <CardHeader>
        <CardTitle>Certificate countdown</CardTitle>
        <CardDescription>Expired or due within 90 days.</CardDescription>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground">
            <Check className="size-4 text-emerald-700" aria-hidden />
            No certificates are expired or due soon.
          </div>
        ) : (
          <ul className="grid gap-3">
            {sorted.map((certificate, index) => {
              const expired = certificate.days_left < 0;
              const color = expired ? "var(--risk-high)" : "var(--risk-medium)";
              const days = Math.abs(certificate.days_left);
              return (
                <li
                  key={`${certificate.supplier_id}-${certificate.standard}`}
                  className="animate-in fill-mode-both fade-in zoom-in-95 duration-500"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <Link
                    href={`/suppliers/${certificate.supplier_id}`}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3 transition-all hover:-translate-y-0.5 hover:shadow-md",
                      expired ? "border-risk-high/30 bg-risk-high/5" : "border-risk-medium/30 bg-risk-medium/5",
                    )}
                  >
                    <RingGauge
                      fraction={expired ? 1 : 1 - certificate.days_left / 90}
                      color={color}
                      label={expired ? `Expired ${days} days ago` : `${days} days left`}
                    >
                      <span className={cn("text-lg font-semibold tabular-nums", expired ? "text-red-700" : "text-amber-800")}>
                        {days}
                      </span>
                      <span className="mt-0.5 text-[8px] text-muted-foreground uppercase">{expired ? "ago" : "left"}</span>
                    </RingGauge>
                    <div className="min-w-0 space-y-0.5">
                      <p
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-semibold uppercase",
                          expired ? "bg-risk-high text-white" : "bg-risk-medium/20 text-amber-900",
                        )}
                      >
                        {expired ? (
                          <span className="relative flex size-1.5">
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
                            <span className="relative inline-flex size-1.5 rounded-full bg-white" />
                          </span>
                        ) : null}
                        {expired ? "Expired" : "Expiring"}
                      </p>
                      <p className="truncate font-medium">{certificate.supplier_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {certificate.standard} · {formatWhen(certificate.expires_on)}
                      </p>
                      {synthetic.has(certificate.supplier_id) ? <SyntheticBadge /> : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const PRIORITY_COLOR = { high: "var(--risk-high)", medium: "var(--risk-medium)", low: "var(--risk-low)" };

function OpenActions({
  actions,
  pendingId,
  onUpdate,
}: {
  actions: ActionItem[];
  pendingId: number | null;
  onUpdate: (action: ActionItem, status: "approved" | "rejected") => void;
}) {
  return (
    <Card id="actions" className="scroll-mt-6 lg:col-span-3">
      <CardHeader>
        <CardTitle>Open actions</CardTitle>
        <CardDescription>Proposed and approved follow-ups, high priority first.</CardDescription>
      </CardHeader>
      <CardContent>
        {actions.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground">
            <Check className="size-4 text-emerald-700" aria-hidden />
            No open actions.
          </div>
        ) : (
          <ul className="space-y-2">
            {actions.map((action, index) => (
              <li
                key={action.id}
                className="group relative flex items-center gap-3 overflow-hidden rounded-lg border border-border bg-card py-2.5 pr-2 pl-4 transition-shadow animate-in fill-mode-both fade-in slide-in-from-right-2 duration-500 hover:shadow-md"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <span
                  className="absolute inset-y-0 left-0 w-1"
                  style={{ backgroundColor: PRIORITY_COLOR[action.priority] }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium sm:truncate" title={action.title}>
                    {action.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground" title={action.rationale}>
                    <Link href={`/suppliers/${action.supplier_id}`} className="font-medium text-sky-800 hover:underline">
                      {action.supplier_name}
                    </Link>
                    <span> · {action.priority} priority</span>
                  </p>
                </div>
                {action.status === "approved" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-risk-low/15 px-2 py-0.5 text-xs font-medium text-emerald-800">
                    <Check className="size-3" aria-hidden />
                    Approved
                  </span>
                ) : (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon-sm"
                      variant="outline"
                      aria-label="Approve"
                      title="Approve"
                      disabled={pendingId === action.id}
                      onClick={() => onUpdate(action, "approved")}
                      className="hover:border-risk-low hover:bg-risk-low/10 hover:text-emerald-800"
                    >
                      <Check aria-hidden />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Reject"
                      title="Reject"
                      disabled={pendingId === action.id}
                      onClick={() => onUpdate(action, "rejected")}
                      className="hover:bg-risk-high/10 hover:text-red-700"
                    >
                      <X aria-hidden />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
