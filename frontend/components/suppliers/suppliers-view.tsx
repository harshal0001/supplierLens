"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { FileText, LayoutGrid, List, Plus, Search } from "lucide-react";
import { api, asApiFailure } from "@/lib/api";
import { formatWhen } from "@/lib/format";
import type { SupplierDetail, SupplierSummary } from "@/lib/types";
import { RiskBadge } from "@/components/risk/risk-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RISK_KEYS, RISK_META, RingGauge, ScoreBar, SyntheticBadge, riskKey, useMounted, type RiskKey } from "@/components/dashboard/viz";
import { cn } from "@/lib/utils";

type Criticality = "low" | "medium" | "high";

const EMPTY_FORM = {
  name: "",
  country: "",
  website: "",
  category: "",
  criticality: "medium" as Criticality,
};

function formatScore(score: number | null) {
  return score == null ? "—" : score.toFixed(1);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function CriticalityMeter({ level }: { level: Criticality }) {
  const filled = level === "high" ? 3 : level === "medium" ? 2 : 1;
  return (
    <span className="inline-flex items-center gap-1.5 capitalize">
      <span className="inline-flex items-end gap-0.5" aria-hidden>
        {[1, 2, 3].map((step) => (
          <span
            key={step}
            className={cn("w-1 rounded-sm", step <= filled ? "bg-primary" : "bg-muted-foreground/25")}
            style={{ height: 4 + step * 3 }}
          />
        ))}
      </span>
      {level}
    </span>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] tracking-wide text-muted-foreground uppercase">{label}</p>
      {children}
    </div>
  );
}

function FilterChip({
  pressed,
  disabled,
  onClick,
  label,
  count,
  color,
  dashed,
}: {
  pressed: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  count: number;
  color?: string;
  dashed?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-40",
        pressed ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted",
      )}
    >
      {color ? (
        <span
          className={cn("size-2.5 rounded-full", dashed && "border border-dashed border-risk-unknown")}
          style={{ backgroundColor: dashed ? "transparent" : color }}
          aria-hidden
        />
      ) : null}
      {label}
      <span className="font-semibold tabular-nums">{count}</span>
    </button>
  );
}

export function SuppliersView() {
  const [suppliers, setSuppliers] = useState<SupplierSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [nameError, setNameError] = useState<string | null>(null);
  const [countryError, setCountryError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<"table" | "cards">("table");
  const [risk, setRisk] = useState<RiskKey | null>(null);
  const mounted = useMounted();

  useEffect(() => {
    let cancelled = false;
    api<SupplierSummary[]>("/api/suppliers")
      .then((list) => {
        if (!cancelled) setSuppliers(list);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(asApiFailure(cause).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!suppliers) return [];
    return suppliers.filter(
      (supplier) =>
        (risk == null || riskKey(supplier.classification) === risk) &&
        [supplier.name, supplier.country, supplier.category ?? ""].join(" ").toLowerCase().includes(needle),
    );
  }, [query, suppliers, risk]);

  // Every close path (Esc, overlay, Cancel) clears stale validation errors.
  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) {
      setNameError(null);
      setCountryError(null);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setNameError(null);
    setCountryError(null);
    const country = form.country.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) {
      setCountryError("Country must be a two-letter ISO code.");
      return;
    }
    setSaving(true);
    try {
      await api<SupplierDetail>("/api/suppliers", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          country,
          website: form.website.trim() || undefined,
          category: form.category.trim() || undefined,
          criticality: form.criticality,
        }),
      });
      setSuppliers(await api<SupplierSummary[]>("/api/suppliers"));
      setForm(EMPTY_FORM);
      setOpen(false);
    } catch (cause) {
      const failure = asApiFailure(cause);
      if (failure.status === 409) {
        setNameError(failure.message);
      } else if (failure.status === 422) {
        const leftover: string[] = [];
        for (const part of failure.message.split("; ")) {
          if (/^name\b/i.test(part)) setNameError(part.replace(/^name:\s*/i, ""));
          else if (/^country\b/i.test(part)) setCountryError(part.replace(/^country:\s*/i, ""));
          else leftover.push(part);
        }
        if (leftover.length > 0) toast.error(leftover.join("; "));
      } else {
        toast.error(failure.message);
      }
    } finally {
      setSaving(false);
    }
  }

  const counts = useMemo(() => {
    const result: Record<RiskKey, number> = { high: 0, medium: 0, low: 0, insufficient_data: 0, not_assessed: 0 };
    for (const supplier of suppliers ?? []) result[riskKey(supplier.classification)] += 1;
    return result;
  }, [suppliers]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, country, or category"
            aria-label="Search suppliers"
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg bg-muted p-0.5" role="group" aria-label="View">
            {(
              [
                ["table", List, "Table view"],
                ["cards", LayoutGrid, "Card view"],
              ] as const
            ).map(([value, Icon, label]) => (
              <button
                key={value}
                type="button"
                aria-label={label}
                title={label}
                aria-pressed={view === value}
                onClick={() => setView(value)}
                className={cn(
                  "grid size-8 place-items-center rounded-md text-muted-foreground transition-colors",
                  view === value && "bg-card text-foreground shadow-sm",
                )}
              >
                <Icon className="size-4" aria-hidden />
              </button>
            ))}
          </div>
          <Button onClick={() => setOpen(true)} className="flex-1 sm:flex-none">
            <Plus className="size-4" aria-hidden />
            Add supplier
          </Button>
        </div>
      </div>

      {suppliers && suppliers.length > 0 ? (
        <div className="space-y-2.5 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <div
            className="flex h-2.5 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`Risk mix: ${RISK_KEYS.map((key) => `${RISK_META[key].label} ${counts[key]}`).join(", ")}`}
          >
            {RISK_KEYS.map((key) =>
              counts[key] > 0 ? (
                <div
                  key={key}
                  className={cn(
                    "h-full border-r-2 border-card transition-all duration-700 last:border-r-0",
                    risk != null && risk !== key && "opacity-25",
                  )}
                  style={{
                    width: mounted ? `${(counts[key] / suppliers.length) * 100}%` : "0%",
                    background: RISK_META[key].dashed
                      ? `repeating-linear-gradient(135deg, ${RISK_META[key].color} 0 3px, transparent 3px 6px)`
                      : RISK_META[key].color,
                  }}
                />
              ) : null,
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip pressed={risk == null} onClick={() => setRisk(null)} label="All" count={suppliers.length} />
            {RISK_KEYS.map((key) => (
              <FilterChip
                key={key}
                pressed={risk === key}
                disabled={counts[key] === 0}
                onClick={() => setRisk(risk === key ? null : key)}
                label={RISK_META[key].label}
                count={counts[key]}
                color={RISK_META[key].color}
                dashed={RISK_META[key].dashed}
              />
            ))}
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {!suppliers ? (
        <Skeleton className="h-64" />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-card px-6 py-10 text-center ring-1 ring-foreground/10">
          <p className="font-medium">{suppliers.length === 0 ? "No suppliers yet" : "No suppliers match that search"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {suppliers.length === 0 ? "Add a supplier to start a risk review." : "Try a different name, country, category, or risk filter."}
          </p>
          {suppliers.length === 0 ? (
            <Button className="mt-4" onClick={() => setOpen(true)}>
              Add supplier
            </Button>
          ) : null}
        </div>
      ) : view === "cards" ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((supplier, index) => {
            const meta = RISK_META[riskKey(supplier.classification)];
            return (
              <li
                key={supplier.id}
                className="group relative flex flex-col gap-3 overflow-hidden rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-all duration-300 animate-in fill-mode-both fade-in zoom-in-95 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/5"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <span
                  className="absolute inset-x-0 top-0 h-1"
                  style={{
                    background: meta.dashed
                      ? `repeating-linear-gradient(90deg, ${meta.color} 0 6px, transparent 6px 10px)`
                      : meta.color,
                  }}
                  aria-hidden
                />
                <div className="flex items-start gap-3">
                  <RingGauge
                    fraction={supplier.overall_score == null ? 0 : supplier.overall_score / 100}
                    color={meta.color}
                    dashed={meta.dashed}
                    size={68}
                    label={supplier.overall_score == null ? meta.label : `Score ${formatScore(supplier.overall_score)}, ${meta.label}`}
                  >
                    <span className={cn("text-base font-semibold tabular-nums", meta.text)}>{formatScore(supplier.overall_score)}</span>
                  </RingGauge>
                  <div className="min-w-0 flex-1 space-y-1">
                    {/* The link's ::after covers the card, so the whole card is one click target named after the supplier. */}
                    <Link
                      href={`/suppliers/${supplier.id}`}
                      className="block font-medium after:absolute after:inset-0 group-hover:underline"
                    >
                      {supplier.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {supplier.country} · {supplier.category ?? "—"}
                    </p>
                    <div className="flex flex-wrap items-center gap-1">
                      <RiskBadge classification={supplier.classification} />
                      {supplier.is_synthetic ? <SyntheticBadge /> : null}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs">
                  <Stat label="Criticality">
                    <CriticalityMeter level={supplier.criticality} />
                  </Stat>
                  <Stat label="Confidence">
                    <span className="font-semibold tabular-nums">
                      {supplier.confidence == null ? "—" : `${Math.round(supplier.confidence * 100)}%`}
                    </span>
                  </Stat>
                  <Stat label="Documents">
                    <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
                      <FileText className="size-3.5 text-muted-foreground" aria-hidden />
                      {supplier.document_count}
                    </span>
                  </Stat>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Criticality</TableHead>
                <TableHead className="min-w-60">Risk score</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead className="text-right">Docs</TableHead>
                <TableHead>Last assessed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((supplier, index) => {
                const meta = RISK_META[riskKey(supplier.classification)];
                return (
                  <TableRow
                    key={supplier.id}
                    className="animate-in fill-mode-both fade-in slide-in-from-bottom-1 duration-500"
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <TableCell className="min-w-60 whitespace-normal">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold",
                            meta.dashed && "border border-dashed border-risk-unknown",
                            meta.text,
                          )}
                          style={{ backgroundColor: meta.dashed ? undefined : `color-mix(in oklch, ${meta.color} 15%, transparent)` }}
                          aria-hidden
                        >
                          {initials(supplier.name)}
                        </span>
                        <div className="min-w-0">
                          <Link href={`/suppliers/${supplier.id}`} className="cursor-pointer font-medium hover:underline">
                            {supplier.name}
                          </Link>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                            <span className="rounded bg-muted px-1 font-medium">{supplier.country}</span>
                            {supplier.is_synthetic ? <SyntheticBadge /> : null}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-normal text-muted-foreground">{supplier.category ?? "—"}</TableCell>
                    <TableCell>
                      <CriticalityMeter level={supplier.criticality} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <RiskBadge classification={supplier.classification} className="w-28 justify-center" />
                        <ScoreBar score={supplier.overall_score} classification={supplier.classification} className="flex-1" />
                      </div>
                    </TableCell>
                    <TableCell className="min-w-28">
                      {supplier.confidence == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Progress value={Math.round(supplier.confidence * 100)} aria-label="Confidence">
                          <span className="w-10 text-xs text-muted-foreground tabular-nums">
                            {Math.round(supplier.confidence * 100)}%
                          </span>
                        </Progress>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <FileText className="size-3.5 text-muted-foreground" aria-hidden />
                        {supplier.document_count}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatWhen(supplier.last_assessed_at, true)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add supplier</DialogTitle>
            <DialogDescription>Name and country are required. Country is an ISO-2 code such as DE.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={onSubmit}>
            <div className="grid gap-1.5">
              <label className="grid gap-1.5 text-sm font-medium" htmlFor="supplier-name">
                Name
                <Input
                  id="supplier-name"
                  required
                  value={form.name}
                  aria-invalid={nameError ? true : undefined}
                  aria-describedby={nameError ? "supplier-name-error" : undefined}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </label>
              {nameError ? (
                <p id="supplier-name-error" className="text-xs text-red-700">
                  {nameError}
                </p>
              ) : null}
            </div>
            <label className="grid gap-1.5 text-sm font-medium" htmlFor="supplier-country">
              Country
              <Input
                id="supplier-country"
                required
                maxLength={2}
                value={form.country}
                placeholder="DE"
                aria-invalid={countryError ? true : undefined}
                aria-describedby={countryError ? "supplier-country-error" : undefined}
                onChange={(event) => setForm({ ...form, country: event.target.value.toUpperCase() })}
              />
            </label>
            {countryError ? (
              <p id="supplier-country-error" className="text-xs text-red-700">
                {countryError}
              </p>
            ) : null}
            <label className="grid gap-1.5 text-sm font-medium">
              Website
              <Input
                type="url"
                value={form.website}
                placeholder="https://"
                onChange={(event) => setForm({ ...form, website: event.target.value })}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Category
              <Input
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Criticality
              <Select
                value={form.criticality}
                onValueChange={(value) => {
                  if (value === "low" || value === "medium" || value === "high") {
                    setForm({ ...form, criticality: value });
                  }
                }}
              >
                <SelectTrigger className="w-full capitalize" aria-label="Criticality">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => changeOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Add supplier"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
