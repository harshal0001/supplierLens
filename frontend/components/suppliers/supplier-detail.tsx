"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Circle, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { api, asApiFailure } from "@/lib/api";
import { formatWhen } from "@/lib/format";
import type {
  ActionItem,
  AnalysisRun,
  AnalysisStep,
  Category,
  ExternalSignal,
  RiskAssessment,
  RiskIndicator,
  SupplierDetail,
} from "@/lib/types";
import { RiskBadge } from "@/components/risk/risk-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const CATEGORIES: Category[] = ["financial", "operational", "delivery", "compliance", "external"];

const CATEGORY_LABEL: Record<Category, string> = {
  financial: "Financial",
  operational: "Operational",
  delivery: "Delivery",
  compliance: "Compliance",
  external: "External",
};

const DOC_LABEL: Record<string, string> = {
  financial_report: "Financial report",
  certification: "Certification",
  delivery_report: "Delivery report",
  contract: "Contract",
  other: "Other",
};

const STEP_LABEL: Record<AnalysisStep["name"], string> = {
  process_documents: "Process documents",
  external_research: "Web research",
  score: "Score",
  recommend: "Recommend",
};

const BASIS_LABEL: Record<RiskIndicator["basis"], string> = {
  document_fact: "From document",
  external_signal: "Web signal · unverified",
  ai_interpretation: "AI interpretation",
  reference_data: "Reference data",
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function domainOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function gaugeColor(classification: SupplierDetail["classification"]) {
  if (classification === "high") return "var(--risk-high)";
  if (classification === "medium") return "var(--risk-medium)";
  if (classification === "low") return "var(--risk-low)";
  return "var(--risk-unknown)";
}

function ScoreGauge({
  score,
  classification,
}: {
  score: number | null;
  classification: SupplierDetail["classification"];
}) {
  const unknown = classification == null || classification === "insufficient_data";
  const shown = score == null ? 0 : Math.max(0, Math.min(100, score));
  return (
    <div
      className={cn("grid size-28 place-items-center rounded-full", unknown && "border border-dashed border-risk-unknown")}
      style={{
        background: `conic-gradient(${gaugeColor(classification)} ${shown * 3.6}deg, var(--muted) 0deg)`,
      }}
      aria-label={score == null ? "Overall score not assessed" : `Overall score ${score.toFixed(1)}`}
    >
      <div className="grid size-20 place-items-center rounded-full bg-card">
        <span className="text-xl font-semibold tabular-nums">{score == null ? "—" : score.toFixed(1)}</span>
      </div>
    </div>
  );
}

function StepIcon({ status }: { status: AnalysisStep["status"] }) {
  if (status === "succeeded") return <Check className="size-4 text-emerald-700" aria-hidden />;
  if (status === "running") return <LoaderCircle className="size-4 animate-spin text-sky-800" aria-hidden />;
  if (status === "failed") return <Circle className="size-4 text-red-700" aria-hidden />;
  return <Circle className="size-4 text-slate-400" aria-hidden />;
}

export function SupplierDetailView({ supplierId }: { supplierId: number }) {
  const [supplier, setSupplier] = useState<SupplierDetail | null>(null);
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [signals, setSignals] = useState<ExternalSignal[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [run, setRun] = useState<AnalysisRun | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [openEvidence, setOpenEvidence] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<number | null>(null);

  async function loadEvidence(id: number) {
    const [riskResult, signalList, actionList] = await Promise.all([
      api<RiskAssessment>(`/api/suppliers/${id}/risk`).catch((cause: unknown) => {
        if (asApiFailure(cause).status === 404) return null;
        throw cause;
      }),
      api<ExternalSignal[]>(`/api/suppliers/${id}/signals`),
      api<ActionItem[]>(`/api/suppliers/${id}/actions`),
    ]);
    setRisk(riskResult);
    setSignals(signalList);
    setActions(actionList);
  }

  useEffect(() => {
    let cancelled = false;
    api<SupplierDetail>(`/api/suppliers/${supplierId}`)
      .then(async (detail) => {
        if (cancelled) return;
        setSupplier(detail);
        setRun(detail.latest_run);
        await loadEvidence(detail.id);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setLoadError(asApiFailure(cause).message);
      });
    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  const runId = run?.id;
  const runStatus = run?.status;

  useEffect(() => {
    if (runId == null || runStatus === "succeeded" || runStatus === "failed") return;
    let cancelled = false;
    const timer = setInterval(() => {
      void api<AnalysisRun>(`/api/runs/${runId}`)
        .then(async (next) => {
          if (cancelled) return;
          setRun(next);
          if (next.status === "succeeded" || next.status === "failed") {
            const detail = await api<SupplierDetail>(`/api/suppliers/${supplierId}`);
            if (cancelled) return;
            setSupplier(detail);
            await loadEvidence(supplierId);
          }
        })
        .catch((cause: unknown) => {
          if (!cancelled) toast.error(asApiFailure(cause).message);
        });
    }, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [runId, runStatus, supplierId]);

  async function startAnalysis() {
    setAnalyzing(true);
    try {
      const next = await api<AnalysisRun>(`/api/suppliers/${supplierId}/analyze`, { method: "POST" });
      setRun(next);
    } catch (cause) {
      toast.error(asApiFailure(cause).message);
    } finally {
      setAnalyzing(false);
    }
  }

  function takeFiles(list: FileList | File[]) {
    const files = Array.from(list);
    if (files.length === 0) return;
    if (files.length > 10) {
      toast.error("Upload up to 10 PDFs at a time.");
      return;
    }
    for (const file of files) {
      const pdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!pdf) {
        toast.error("Only PDF files can be uploaded.");
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error("Each PDF must be 20 MB or smaller.");
        return;
      }
    }
    void upload(files);
  }

  async function upload(files: File[]) {
    const body = new FormData();
    for (const file of files) body.append("files", file);
    setUploading(true);
    try {
      await api(`/api/suppliers/${supplierId}/documents`, { method: "POST", body });
      const detail = await api<SupplierDetail>(`/api/suppliers/${supplierId}`);
      setSupplier(detail);
      await startAnalysis();
    } catch (cause) {
      toast.error(asApiFailure(cause).message);
    } finally {
      setUploading(false);
    }
  }

  async function updateAction(action: ActionItem, status: "approved" | "rejected" | "done") {
    setPendingAction(action.id);
    try {
      const updated = await api<ActionItem>(`/api/actions/${action.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setActions((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (cause) {
      toast.error(asApiFailure(cause).message);
    } finally {
      setPendingAction(null);
    }
  }

  if (loadError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Supplier unavailable</CardTitle>
          <CardDescription>{loadError}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!supplier) {
    return <Skeleton className="h-80" />;
  }

  const assessed = risk ? CATEGORIES.filter((category) => risk.categories[category]?.score != null).length : 0;
  const webFailed = run?.steps.some((step) => step.name === "external_research" && step.status === "failed") ?? false;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium text-sky-800">Supplier</p>
          <h1 className="text-2xl font-semibold tracking-tight">{supplier.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            {supplier.is_synthetic ? (
              <Badge variant="outline" className="border-dashed">
                Synthetic demo data
              </Badge>
            ) : null}
            <Badge variant="secondary">{supplier.country}</Badge>
            {supplier.category ? <Badge variant="secondary">{supplier.category}</Badge> : null}
            <Badge variant="outline" className="capitalize">
              {supplier.criticality} criticality
            </Badge>
            <RiskBadge classification={supplier.classification} />
          </div>
          <p className="text-sm text-muted-foreground">
            {risk
              ? `Based on ${assessed} of 5 risk categories`
              : "Confidence and coverage appear after the first analysis."}{" "}
            {supplier.confidence == null ? null : `Confidence ${Math.round(supplier.confidence * 100)}%.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void startAnalysis()} disabled={analyzing || run?.status === "queued" || run?.status === "running"}>
              {analyzing || run?.status === "queued" || run?.status === "running" ? "Analyzing…" : "Analyze"}
            </Button>
            <Button nativeButton={false} variant="outline" render={<Link href={`/assistant?supplier_id=${supplier.id}`} />}>
              Ask the assistant about this supplier
            </Button>
          </div>
        </div>
        <ScoreGauge score={supplier.overall_score} classification={supplier.classification} />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>PDF only, up to 10 files, 20 MB each. Uploading starts analysis.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label
            className={cn(
              "block cursor-pointer rounded-lg border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600 transition-colors",
              dragOver && "border-sky-700 bg-sky-50",
            )}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              takeFiles(event.dataTransfer.files);
            }}
          >
            <input
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="sr-only"
              disabled={uploading}
              onChange={(event) => {
                if (event.target.files) takeFiles(event.target.files);
                event.target.value = "";
              }}
            />
            {uploading ? "Uploading…" : "Drop PDFs here, or click to browse."}
          </label>
          {supplier.missing_documents.length > 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600">
              Missing documents: {supplier.missing_documents.map((type) => DOC_LABEL[type] ?? type).join(", ")}.
            </p>
          ) : null}
          {supplier.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents uploaded.</p>
          ) : (
            <ul className="divide-y divide-border">
              {supplier.documents.map((document) => (
                <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div>
                    <p className="font-medium">{document.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {DOC_LABEL[document.doc_type] ?? document.doc_type}
                      {document.page_count
                        ? ` · ${document.page_count} ${document.page_count === 1 ? "page" : "pages"}`
                        : ""}
                    </p>
                    {document.error ? <p className="text-xs text-red-700">{document.error}</p> : null}
                  </div>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
                      document.status === "failed" && "border-red-200 text-red-700",
                      document.status === "processed" && "border-emerald-200 text-emerald-800",
                      document.status !== "failed" && document.status !== "processed" && "border-amber-200 text-amber-800",
                    )}
                  >
                    {document.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {run ? (
        <Card>
          <CardHeader>
            <CardTitle>Analysis</CardTitle>
            <CardDescription className="capitalize">{run.status}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ol className="grid gap-2 sm:grid-cols-4">
              {run.steps.map((step) => (
                <li key={step.name} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <StepIcon status={step.status} />
                  <span>
                    {STEP_LABEL[step.name]}
                    <span className="sr-only"> {step.status}</span>
                    {step.error ? <span className="mt-0.5 block text-xs text-red-700">{step.error}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
            {run.status === "failed" && run.error ? <p className="text-sm text-red-700">{run.error}</p> : null}
            {webFailed ? (
              <p className="text-sm text-slate-600">Web research unavailable, score based on documents only.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Risk breakdown</h2>
        {risk?.summary ? (
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
              <CardDescription>AI-generated</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6">{risk.summary}</p>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">No assessment yet. Run Analyze after documents are uploaded.</p>
        )}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {CATEGORIES.map((category) => {
            const categoryScore = risk?.categories[category];
            const notAssessed = !categoryScore || categoryScore.score == null;
            return (
              <Card key={category} size="sm" className={cn(notAssessed && "border border-dashed border-slate-300")}>
                <CardHeader>
                  <CardDescription>{CATEGORY_LABEL[category]}</CardDescription>
                  <CardTitle>{notAssessed ? "Not assessed" : categoryScore.score?.toFixed(0)}</CardTitle>
                  <CardDescription>
                    {notAssessed
                      ? "Not assessed, no evidence"
                      : `Weight ${Math.round(categoryScore.weight * 100)}% · confidence ${Math.round(categoryScore.confidence * 100)}%`}
                  </CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
        {risk
          ? CATEGORIES.map((category) => {
              const indicators = risk.indicators.filter((indicator) => indicator.category === category);
              if (indicators.length === 0) return null;
              return (
                <div key={category} className="space-y-2">
                  <h3 className="text-sm font-medium">{CATEGORY_LABEL[category]}</h3>
                  {indicators.map((indicator) => (
                    <div key={indicator.id} className="rounded-xl bg-card p-3 ring-1 ring-foreground/10">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{indicator.label}</p>
                          {indicator.value ? <p className="text-sm text-muted-foreground">{indicator.value}</p> : null}
                        </div>
                        <Badge variant="outline">{BASIS_LABEL[indicator.basis]}</Badge>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-muted" aria-hidden>
                        <div className="h-full rounded-full bg-primary" style={{ width: `${indicator.severity}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">Severity {indicator.severity}</p>
                      <button
                        type="button"
                        className="mt-2 cursor-pointer text-sm font-medium text-sky-800"
                        aria-expanded={openEvidence === indicator.id}
                        onClick={() => setOpenEvidence(openEvidence === indicator.id ? null : indicator.id)}
                      >
                        Evidence
                      </button>
                      {openEvidence === indicator.id ? (
                        <ul className="mt-2 space-y-2">
                          {indicator.evidence.map((item) => (
                            <li key={item.id} className="text-sm">
                              <p className="text-slate-700">“{item.excerpt}”</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {item.document_id != null && item.page_number != null ? (
                                  <a
                                    className="cursor-pointer text-sky-800 underline"
                                    href={`${API_BASE}/api/documents/${item.document_id}/file#page=${item.page_number}`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Page {item.page_number}
                                  </a>
                                ) : null}
                                {item.url ? (
                                  <a className="cursor-pointer text-sky-800 underline" href={item.url} target="_blank" rel="noreferrer">
                                    {domainOf(item.url)}
                                  </a>
                                ) : null}
                                {item.source_date ? ` · ${formatWhen(item.source_date)}` : null}
                              </p>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </div>
              );
            })
          : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Web signals</h2>
        {signals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No web signals stored.</p>
        ) : (
          <div className="grid gap-3">
            {signals.map((signal) => (
              <Card key={signal.id} size="sm">
                <CardHeader>
                  <CardTitle>
                    <a className="cursor-pointer hover:underline" href={signal.url} target="_blank" rel="noreferrer">
                      {signal.title}
                    </a>
                  </CardTitle>
                  <CardDescription>
                    {domainOf(signal.url)}
                    {signal.published_at ? ` · ${formatWhen(signal.published_at)}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm">{signal.claim}</p>
                  <p className="text-sm text-slate-600">“{signal.excerpt}”</p>
                  <Badge variant="outline" className="capitalize">
                    {signal.verification_status.replaceAll("_", " ")}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Action plan</h2>
        {actions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No actions yet.</p>
        ) : (
          <ul className="space-y-3">
            {actions.map((action) => (
              <li key={action.id} className="rounded-xl bg-card p-3 ring-1 ring-foreground/10">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{action.title}</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {action.priority} priority · {action.status}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pendingAction === action.id || action.status === "approved" || action.status === "done"}
                      onClick={() => void updateAction(action, "approved")}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pendingAction === action.id || action.status === "rejected" || action.status === "done"}
                      onClick={() => void updateAction(action, "rejected")}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pendingAction === action.id || action.status === "done"}
                      onClick={() => void updateAction(action, "done")}
                    >
                      Done
                    </Button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-600">{action.rationale}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
