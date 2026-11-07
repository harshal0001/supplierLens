"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { api, asApiFailure } from "@/lib/api";
import { formatWhen } from "@/lib/format";
import type { ActionItem, Dashboard } from "@/lib/types";
import { RiskBadge } from "@/components/risk/risk-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const SLICES = [
  { key: "high" as const, label: "High", fill: "var(--risk-high)" },
  { key: "medium" as const, label: "Medium", fill: "var(--risk-medium)" },
  { key: "low" as const, label: "Low", fill: "var(--risk-low)" },
  { key: "insufficient_data" as const, label: "Insufficient data", fill: "var(--risk-unknown)" },
  { key: "not_assessed" as const, label: "Not assessed", fill: "var(--chart-5)" },
];

function formatScore(score: number | null) {
  return score == null ? "—" : score.toFixed(1);
}

export function DashboardView() {
  const router = useRouter();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<Dashboard>("/api/dashboard")
      .then((dashboard) => {
        if (!cancelled) setData(dashboard);
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
    } catch (cause) {
      toast.error(asApiFailure(cause).message);
    } finally {
      setPendingId(null);
    }
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

  if (!data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
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

  const kpis = [
    { label: "Suppliers", value: data.totals.suppliers, className: "text-foreground" },
    { label: "High", value: data.totals.high, className: "text-red-700" },
    { label: "Medium", value: data.totals.medium, className: "text-amber-800" },
    { label: "Low", value: data.totals.low, className: "text-emerald-800" },
    { label: "Insufficient data", value: data.totals.insufficient_data, className: "text-slate-600" },
    { label: "Not assessed", value: data.totals.not_assessed, className: "text-slate-600" },
  ];
  const slices = SLICES.map((slice) => ({ ...slice, value: data.totals[slice.key] })).filter(
    (slice) => slice.value > 0,
  );

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <Card key={kpi.label} size="sm">
            <CardHeader>
              <CardDescription>{kpi.label}</CardDescription>
              <CardTitle className={`text-2xl font-semibold tracking-tight ${kpi.className}`}>
                {kpi.value}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Risk distribution</CardTitle>
            <CardDescription>Latest classification for each supplier.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="h-48 w-full sm:w-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={slices} dataKey="value" nameKey="label" innerRadius={52} outerRadius={74} stroke="none">
                    {slices.map((slice) => (
                      <Cell key={slice.key} fill={slice.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="min-w-44 flex-1 space-y-2 text-sm">
              {slices.map((slice) => (
                <li key={slice.key} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: slice.fill }} aria-hidden />
                    {slice.label}
                  </span>
                  <span className="font-medium tabular-nums">{slice.value}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Highest risk</CardTitle>
            <CardDescription>Five suppliers with the highest overall score.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.top_risk.map((supplier) => (
                  <TableRow
                    key={supplier.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/suppliers/${supplier.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") router.push(`/suppliers/${supplier.id}`);
                    }}
                    tabIndex={0}
                  >
                    <TableCell className="font-medium whitespace-normal">
                      <Link href={`/suppliers/${supplier.id}`} className="cursor-pointer hover:underline">
                        {supplier.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <RiskBadge classification={supplier.classification} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatScore(supplier.overall_score)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Certifications</CardTitle>
            <CardDescription>Expired or due within 90 days.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.certifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No certificates are expired or due soon.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.certifications.map((certificate) => {
                  const expired = certificate.days_left < 0;
                  return (
                    <li key={`${certificate.supplier_id}-${certificate.standard}`} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div>
                        <Link
                          href={`/suppliers/${certificate.supplier_id}`}
                          className="cursor-pointer font-medium hover:underline"
                        >
                          {certificate.supplier_name}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {certificate.standard} · {formatWhen(certificate.expires_on)}
                        </p>
                      </div>
                      <p className={expired ? "text-sm font-medium text-red-700" : "text-sm text-amber-800"}>
                        {expired ? `Expired ${Math.abs(certificate.days_left)} days ago` : `${certificate.days_left} days left`}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open actions</CardTitle>
            <CardDescription>Proposed and approved follow-ups.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.open_actions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open actions.</p>
            ) : (
              <ul className="space-y-3">
                {data.open_actions.map((action) => (
                  <li key={action.id} className="rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{action.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {action.supplier_name} · {action.priority} priority
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pendingId === action.id || action.status === "approved"}
                          onClick={() => updateAction(action, "approved")}
                        >
                          {action.status === "approved" ? "Approved" : "Approve"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pendingId === action.id}
                          onClick={() => updateAction(action, "rejected")}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{action.rationale}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
