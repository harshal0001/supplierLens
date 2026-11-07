"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { api, asApiFailure } from "@/lib/api";
import { formatWhen } from "@/lib/format";
import type { SupplierDetail, SupplierSummary } from "@/lib/types";
import { RiskBadge } from "@/components/risk/risk-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

export function SuppliersView() {
  const [suppliers, setSuppliers] = useState<SupplierSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [nameError, setNameError] = useState<string | null>(null);
  const [countryError, setCountryError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
    if (!needle) return suppliers;
    return suppliers.filter((supplier) =>
      [supplier.name, supplier.country, supplier.category ?? ""].join(" ").toLowerCase().includes(needle),
    );
  }, [query, suppliers]);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, country, or category"
          aria-label="Search suppliers"
          className="sm:max-w-sm"
        />
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" aria-hidden />
          Add supplier
        </Button>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {!suppliers ? (
        <Skeleton className="h-64" />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-card px-6 py-10 text-center ring-1 ring-foreground/10">
          <p className="font-medium">{suppliers.length === 0 ? "No suppliers yet" : "No suppliers match that search"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {suppliers.length === 0 ? "Add a supplier to start a risk review." : "Try a different name, country, or category."}
          </p>
          {suppliers.length === 0 ? (
            <Button className="mt-4" onClick={() => setOpen(true)}>
              Add supplier
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Criticality</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead className="text-right">Docs</TableHead>
                <TableHead>Last assessed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="whitespace-normal">
                    <Link href={`/suppliers/${supplier.id}`} className="cursor-pointer font-medium hover:underline">
                      {supplier.name}
                    </Link>
                    {supplier.is_synthetic ? (
                      <Badge variant="outline" className="mt-1 border-dashed">
                        Synthetic demo data
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>{supplier.country}</TableCell>
                  <TableCell className="whitespace-normal">{supplier.category ?? "—"}</TableCell>
                  <TableCell className="capitalize">{supplier.criticality}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <RiskBadge classification={supplier.classification} />
                      <span className="text-xs text-muted-foreground tabular-nums">{formatScore(supplier.overall_score)}</span>
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
                  <TableCell className="text-right tabular-nums">{supplier.document_count}</TableCell>
                  <TableCell>{formatWhen(supplier.last_assessed_at, true)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setNameError(null);
            setCountryError(null);
          }
        }}
      >
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
                <SelectTrigger className="w-full" aria-label="Criticality">
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
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
