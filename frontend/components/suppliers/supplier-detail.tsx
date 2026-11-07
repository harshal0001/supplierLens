"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ChartLine,
  Files,
  ListChecks,
  LoaderCircle,
  MapPin,
  MessageSquare,
  Radar,
  Rss,
  Sparkles,
  Tag,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { api, asApiFailure } from "@/lib/api";
import { formatWhen } from "@/lib/format";
import type {
  ActionItem,
  AnalysisRun,
  Category,
  ExternalSignal,
  RiskAssessment,
  RiskHistoryPoint,
  SupplierDetail,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ActionCards } from "./detail/action-cards";
import { AnalysisPipeline } from "./detail/analysis-pipeline";
import { DocumentPanel } from "./detail/document-panel";
import { CategoryCards, IndicatorList } from "./detail/risk-drivers";
import { RiskGauge } from "./detail/risk-gauge";
import { RiskRadar } from "./detail/risk-radar";
import { ScoreHistory } from "./detail/score-history";
import { CATEGORIES, CATEGORY_LABEL, riskVar } from "./detail/shared";
import { SignalTimeline } from "./detail/signal-timeline";

function Panel({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-primary/8 text-primary" aria-hidden>
            <Icon className="size-4" />
          </span>
          {title}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="min-w-0">{children}</CardContent>
    </Card>
  );
}

function ConfidenceRing({ value }: { value: number | null }) {
  const pct = value == null ? 0 : Math.round(value * 100);
  return (
    <svg viewBox="0 0 36 36" className="size-9 -rotate-90" aria-hidden>
      <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="4" className="text-white/15" />
      {value != null ? (
        <circle
          cx="18"
          cy="18"
          r="15"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${pct} 100`}
          className="text-sky-300 transition-[stroke-dasharray] duration-1000"
        />
      ) : null}
    </svg>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-white/6 px-3 py-2.5 ring-1 ring-white/10">
      <p className="text-[11px] font-medium tracking-wide text-white/60 uppercase">{label}</p>
      <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-white">{children}</div>
    </div>
  );
}

export function SupplierDetailView({ supplierId }: { supplierId: number }) {
  const [supplier, setSupplier] = useState<SupplierDetail | null>(null);
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [history, setHistory] = useState<RiskHistoryPoint[]>([]);
  const [signals, setSignals] = useState<ExternalSignal[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [run, setRun] = useState<AnalysisRun | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [pendingAction, setPendingAction] = useState<number | null>(null);
  const [selected, setSelected] = useState<Category | null>(null);

  async function loadEvidence(id: number) {
    const [riskResult, historyList, signalList, actionList] = await Promise.all([
      api<RiskAssessment>(`/api/suppliers/${id}/risk`).catch((cause: unknown) => {
        if (asApiFailure(cause).status === 404) return null;
        throw cause;
      }),
      api<RiskHistoryPoint[]>(`/api/suppliers/${id}/risk/history`),
      api<ExternalSignal[]>(`/api/suppliers/${id}/signals`),
      api<ActionItem[]>(`/api/suppliers/${id}/actions`),
    ]);
    setRisk(riskResult);
    setHistory(historyList);
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
          if (next.status === "succeeded" || next.status === "failed") {
            // Reload before setRun: setRun ends this effect (runStatus changes) and would cancel the reload.
            const detail = await api<SupplierDetail>(`/api/suppliers/${supplierId}`);
            if (cancelled) return;
            setSupplier(detail);
            await loadEvidence(supplierId);
            if (cancelled) return;
          }
          setRun(next);
        })
        .catch((cause: unknown) => {
          if (!cancelled) toast.error(asApiFailure(cause).message, { id: "run-poll" }); // one toast, not one per poll
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

  const runActive = run?.status === "queued" || run?.status === "running";

  function takeFiles(list: FileList | File[]) {
    const files = Array.from(list);
    if (files.length === 0) return;
    if (uploading || runActive) {
      // The running analysis already picked its documents; a file added now would stay "uploaded" unanalysed.
      toast.error("Wait for the current upload and analysis to finish.");
      return;
    }
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
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-5">
          <Skeleton className="h-56 lg:col-span-2" />
          <Skeleton className="h-56 lg:col-span-3" />
        </div>
      </div>
    );
  }

  const assessed = risk ? CATEGORIES.filter((category) => risk.categories[category]?.score != null).length : 0;
  const webFailed = run?.steps.some((step) => step.name === "external_research" && step.status === "failed") ?? false;
  const busy = analyzing || runActive;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-xl shadow-slate-900/10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,oklch(0.5_0.134_242.749/0.45),transparent_55%),radial-gradient(circle_at_0%_100%,oklch(0.5_0.134_242.749/0.18),transparent_45%)]"
        />
        <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center">
          <div className="min-w-0 space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-[0.2em] text-sky-300 uppercase">Supplier risk profile</p>
              <h1 className="text-2xl font-semibold tracking-tight break-words sm:text-3xl">{supplier.name}</h1>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {supplier.is_synthetic ? (
                  <span className="rounded-full border border-dashed border-white/50 px-2.5 py-0.5 font-medium text-white/90">
                    Synthetic demo data
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5">
                  <MapPin className="size-3" aria-hidden />
                  {supplier.country}
                </span>
                {supplier.category ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5">
                    <Tag className="size-3" aria-hidden />
                    {supplier.category}
                  </span>
                ) : null}
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 font-medium capitalize",
                    supplier.criticality === "high" ? "bg-white text-primary" : "bg-white/10",
                  )}
                >
                  {supplier.criticality} criticality
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Coverage">
                <span className="tabular-nums">{risk ? `${assessed}/5` : "—"}</span>
                <span className="flex flex-1 gap-0.5" aria-hidden>
                  {CATEGORIES.map((category) => {
                    const score = risk?.categories[category]?.score ?? null;
                    return (
                      <span
                        key={category}
                        title={`${CATEGORY_LABEL[category]}: ${score == null ? "not assessed" : score.toFixed(0)}`}
                        className={cn("h-2 flex-1 rounded-sm", score == null && "border border-dashed border-white/40")}
                        style={score == null ? undefined : { backgroundColor: riskVar(score) }}
                      />
                    );
                  })}
                </span>
              </Stat>
              <Stat label="Confidence">
                <ConfidenceRing value={supplier.confidence} />
                <span className="tabular-nums">
                  {supplier.confidence == null ? "—" : `${Math.round(supplier.confidence * 100)}%`}
                </span>
              </Stat>
              <Stat label="Documents">
                <Files className="size-4 text-sky-300" aria-hidden />
                <span className="tabular-nums">{supplier.documents.length}</span>
                {supplier.missing_documents.length ? (
                  <span className="text-xs font-normal text-white/60">+{supplier.missing_documents.length} missing</span>
                ) : null}
              </Stat>
              <Stat label="Last assessed">
                <span className="truncate">{formatWhen(supplier.last_assessed_at)}</span>
              </Stat>
            </div>
            <p className="text-xs text-white/60">
              {risk ? `Based on ${assessed} of 5 risk categories.` : "Coverage and confidence appear after the first analysis."}
            </p>

            <div className="flex flex-wrap gap-2">
              <Button
                size="lg"
                className="bg-white text-primary hover:bg-sky-50"
                onClick={() => void startAnalysis()}
                disabled={busy}
              >
                {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
                {busy ? "Analyzing…" : "Analyze"}
              </Button>
              <Button
                size="lg"
                nativeButton={false}
                variant="outline"
                className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                render={<Link href={`/assistant?supplier_id=${supplier.id}`} />}
              >
                <MessageSquare aria-hidden />
                Ask the assistant
              </Button>
            </div>
          </div>
          <div className="flex justify-center">
            <RiskGauge score={supplier.overall_score} classification={supplier.classification} />
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel icon={Files} title="Documents" className="lg:col-span-2">
          <DocumentPanel supplier={supplier} uploading={uploading} locked={runActive} onFiles={takeFiles} />
        </Panel>
        <Panel
          icon={Workflow}
          title="Analysis pipeline"
          description="Extract facts → web research → deterministic score → action plan"
          className={cn("lg:col-span-3", runActive && "ring-2 ring-sky-500/60")}
        >
          {run ? (
            <div className="space-y-3">
              <AnalysisPipeline run={run} />
              {webFailed ? (
                <p className="text-xs text-slate-600">Web research unavailable, score based on documents only.</p>
              ) : null}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-muted-foreground">
              No analysis yet. Upload documents or press Analyze.
            </p>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel icon={Radar} title="Category profile" description="Click a category to filter the risk drivers">
          {risk ? (
            <RiskRadar risk={risk} selected={selected} onSelect={setSelected} />
          ) : (
            <p className="grid h-[240px] place-items-center rounded-xl border border-dashed border-slate-300 text-sm text-muted-foreground">
              Not assessed
            </p>
          )}
        </Panel>
        <Panel icon={ChartLine} title="Score history" description="Overall score after each analysis">
          <ScoreHistory history={history} />
        </Panel>
        <Panel icon={Sparkles} title="Summary" description="AI-generated">
          {risk?.summary ? (
            <p className="text-sm leading-6 text-slate-700">{risk.summary}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No assessment yet. Run Analyze after documents are uploaded.</p>
          )}
        </Panel>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Risk drivers</h2>
          {selected ? (
            <button
              type="button"
              className="text-sm font-medium text-sky-800 hover:underline"
              onClick={() => setSelected(null)}
            >
              Show all categories
            </button>
          ) : null}
        </div>
        <CategoryCards risk={risk} selected={selected} onSelect={setSelected} />
        {risk ? <IndicatorList risk={risk} selected={selected} /> : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel icon={Rss} title="Web signals" description="Public news, newest first. Click to open the source.">
          <SignalTimeline signals={signals} />
        </Panel>
        <Panel icon={ListChecks} title="Action plan" description="Proposed by rules. A human decides.">
          <ActionCards actions={actions} pending={pendingAction} onUpdate={(action, status) => void updateAction(action, status)} />
        </Panel>
      </div>
    </div>
  );
}
