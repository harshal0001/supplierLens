import type {
  ActionItem,
  AnalysisRun,
  AnalysisStep,
  AssistantAnswer,
  Dashboard,
  ExternalSignal,
  RiskAssessment,
  SupplierDetail,
  SupplierDocument,
  SupplierInput,
  SupplierSummary,
} from "@/lib/types";

const NOW = "2026-11-07T09:00:00.000Z";

const STEP_NAMES: AnalysisStep["name"][] = [
  "process_documents",
  "external_research",
  "score",
  "recommend",
];

interface SupplierRecord extends SupplierDetail {
  failExternalResearch: boolean;
}

let nextSupplierId = 7;
let nextDocumentId = 20;
let nextRunId = 3;
let nextActionId = 6;

const polls = new Map<number, number>();

function summaryOf(supplier: SupplierRecord): SupplierSummary {
  return {
    id: supplier.id,
    name: supplier.name,
    country: supplier.country,
    category: supplier.category,
    criticality: supplier.criticality,
    is_synthetic: supplier.is_synthetic,
    overall_score: supplier.overall_score,
    classification: supplier.classification,
    confidence: supplier.confidence,
    last_assessed_at: supplier.last_assessed_at,
    document_count: supplier.document_count,
  };
}

function stepsFor(poll: number, failExternal: boolean): AnalysisStep[] {
  return STEP_NAMES.map((name, index) => {
    if (poll <= index) return { name, status: "pending", error: null };
    if (poll === index + 1) return { name, status: "running", error: null };
    if (failExternal && name === "external_research") {
      return {
        name,
        status: "failed",
        error: "Web research unavailable",
      };
    }
    return { name, status: "succeeded", error: null };
  });
}

function materialiseRun(supplier: SupplierRecord): AnalysisRun | null {
  const run = supplier.latest_run;
  if (!run || run.status === "succeeded" || run.status === "failed") return run;
  const poll = (polls.get(run.id) ?? 0) + 1;
  polls.set(run.id, poll);
  const steps = stepsFor(poll, supplier.failExternalResearch);
  const finished = poll >= STEP_NAMES.length;
  const next: AnalysisRun = {
    ...run,
    status: finished ? "succeeded" : "running",
    steps,
    finished_at: finished ? NOW : null,
  };
  supplier.latest_run = next;
  return next;
}

const alphaEvidenceLoss = {
  id: "a1f3c2",
  source_type: "document" as const,
  title: "Alpha Präzisionsteile GmbH — Annual report 2025",
  excerpt: "Net income: -1.8 million EUR.",
  url: null,
  document_id: 1,
  page_number: 2,
  source_date: "2025-12-31",
};

const alphaEvidenceCert = {
  id: "b7e91d",
  source_type: "document" as const,
  title: "Alpha Präzisionsteile GmbH — ISO 9001 certificate",
  excerpt: "ISO 9001 certificate expired on 2026-09-07.",
  url: null,
  document_id: 2,
  page_number: 1,
  source_date: "2026-09-07",
};

export const assistantAnswer: AssistantAnswer = {
  answer:
    "Alpha Präzisionsteile GmbH has the highest risk. The 2025 report shows a net loss, and the ISO 9001 certificate expired on 7 September 2026. This is not financial or legal advice.",
  citations: [
    {
      evidence_id: alphaEvidenceLoss.id,
      title: alphaEvidenceLoss.title,
      excerpt: alphaEvidenceLoss.excerpt,
      url: null,
      document_id: 1,
      page_number: 2,
      supplier_id: 1,
    },
    {
      evidence_id: alphaEvidenceCert.id,
      title: alphaEvidenceCert.title,
      excerpt: alphaEvidenceCert.excerpt,
      url: null,
      document_id: 2,
      page_number: 1,
      supplier_id: 1,
    },
  ],
  proposed_actions: [],
};

const alphaAssessment: RiskAssessment = {
  id: 1,
  supplier_id: 1,
  overall_score: 75.3,
  classification: "high",
  confidence: 0.8,
  coverage: 0.85,
  categories: {
    financial: { score: 75, confidence: 0.999, weight: 0.25, indicator_count: 3 },
    operational: { score: 70, confidence: 0.94, weight: 0.25, indicator_count: 2 },
    delivery: { score: 75, confidence: 0.9, weight: 0.2, indicator_count: 1 },
    compliance: { score: 85, confidence: 0.9, weight: 0.15, indicator_count: 1 },
    external: { score: null, confidence: 0, weight: 0.15, indicator_count: 0 },
  },
  indicators: [
    {
      id: 1,
      category: "financial",
      rule_key: "net_income_negative",
      label: "Net income is negative",
      value: "-1.8 million EUR",
      severity: 65,
      confidence: 0.9,
      basis: "document_fact",
      evidence: [alphaEvidenceLoss],
    },
    {
      id: 2,
      category: "financial",
      rule_key: "revenue_change",
      label: "Revenue fell by 25%",
      value: "-25%",
      severity: 70,
      confidence: 0.9,
      basis: "document_fact",
      evidence: [
        {
          id: "c4aa10",
          source_type: "document",
          title: "Alpha Präzisionsteile GmbH — Annual report 2025",
          excerpt: "Revenue change: -25.0 % versus the prior year.",
          url: null,
          document_id: 1,
          page_number: 2,
          source_date: "2025-12-31",
        },
      ],
    },
    {
      id: 3,
      category: "financial",
      rule_key: "equity_ratio",
      label: "Equity ratio below 10%",
      value: "8%",
      severity: 75,
      confidence: 0.9,
      basis: "document_fact",
      evidence: [
        {
          id: "d81b44",
          source_type: "document",
          title: "Alpha Präzisionsteile GmbH — Annual report 2025",
          excerpt: "Equity ratio: 8.0 %.",
          url: null,
          document_id: 1,
          page_number: 3,
          source_date: "2025-12-31",
        },
      ],
    },
    {
      id: 4,
      category: "operational",
      rule_key: "single_source_high_criticality",
      label: "Single-source supplier with high criticality",
      value: "single source",
      severity: 70,
      confidence: 0.9,
      basis: "document_fact",
      evidence: [
        {
          id: "e22c90",
          source_type: "document",
          title: "Alpha Präzisionsteile GmbH — Supply contract",
          excerpt: "This agreement is a single-source supply contract.",
          url: null,
          document_id: 3,
          page_number: 1,
          source_date: "2024-04-01",
        },
      ],
    },
    {
      id: 5,
      category: "operational",
      rule_key: "concern",
      label: "Customer concentration noted in the report",
      value: null,
      severity: 40,
      confidence: 0.4,
      basis: "ai_interpretation",
      evidence: [
        {
          id: "f09d17",
          source_type: "document",
          title: "Alpha Präzisionsteile GmbH — Annual report 2025",
          excerpt: "Three customers account for most of annual revenue.",
          url: null,
          document_id: 1,
          page_number: 4,
          source_date: "2025-12-31",
        },
      ],
    },
    {
      id: 6,
      category: "delivery",
      rule_key: "on_time_delivery",
      label: "On-time delivery below 85%",
      value: "78%",
      severity: 75,
      confidence: 0.9,
      basis: "document_fact",
      evidence: [
        {
          id: "a90e55",
          source_type: "document",
          title: "Alpha Präzisionsteile GmbH — Delivery report",
          excerpt: "On-time delivery rate: 78.0 %.",
          url: null,
          document_id: 4,
          page_number: 1,
          source_date: "2026-06-30",
        },
      ],
    },
    {
      id: 7,
      category: "compliance",
      rule_key: "certificate_expired",
      label: "ISO 9001 certificate expired",
      value: "2026-09-07",
      severity: 85,
      confidence: 0.9,
      basis: "document_fact",
      evidence: [alphaEvidenceCert],
    },
  ],
  summary:
    "Alpha shows a net loss, a sharp revenue decline, and an equity ratio of 8%. Delivery performance is 78% on time and the ISO 9001 certificate has expired. External signals were not assessed.",
  created_at: "2026-11-06T15:00:00.000Z",
};

const assessments = new Map<number, RiskAssessment>([[1, alphaAssessment]]);

const signalsBySupplier = new Map<number, ExternalSignal[]>([
  [
    1,
    [
      {
        id: 1,
        title: "Precision supplier reports delayed customer payments",
        url: "https://example.com/signals/alpha-payments",
        published_at: "2026-10-12",
        retrieved_at: NOW,
        signal_type: "financial_distress",
        category: "financial",
        severity: 70,
        claim: "A trade publication reported delayed payments to tooling vendors.",
        excerpt: "Alpha Präzisionsteile has stretched payments to several tooling vendors.",
        relevance: 0.82,
        verification_status: "unverified",
      },
    ],
  ],
]);

const actions: ActionItem[] = [
  {
    id: 1,
    supplier_id: 1,
    supplier_name: "Alpha Präzisionsteile GmbH",
    template_key: "request_financials",
    title: "Request updated financials",
    rationale: "Net income is negative; Revenue fell by 25%; Equity ratio below 10%",
    priority: "high",
    status: "proposed",
    created_at: "2026-11-06T15:05:00.000Z",
  },
  {
    id: 2,
    supplier_id: 1,
    supplier_name: "Alpha Präzisionsteile GmbH",
    template_key: "renew_certification",
    title: "Renew ISO 9001 certification",
    rationale: "ISO 9001 certificate expired",
    priority: "high",
    status: "proposed",
    created_at: "2026-11-06T15:05:00.000Z",
  },
  {
    id: 3,
    supplier_id: 1,
    supplier_name: "Alpha Präzisionsteile GmbH",
    template_key: "delivery_recovery_plan",
    title: "Ask for a delivery recovery plan",
    rationale: "On-time delivery below 85%",
    priority: "high",
    status: "approved",
    created_at: "2026-11-06T15:05:00.000Z",
  },
  {
    id: 4,
    supplier_id: 2,
    supplier_name: "Beta Kunststofftechnik GmbH",
    template_key: "renew_certification",
    title: "Renew ISO 9001 before it expires",
    rationale: "ISO 9001 expires within 90 days",
    priority: "high",
    status: "proposed",
    created_at: "2026-11-05T11:00:00.000Z",
  },
  {
    id: 5,
    supplier_id: 2,
    supplier_name: "Beta Kunststofftechnik GmbH",
    template_key: "schedule_reassessment",
    title: "Schedule a reassessment",
    rationale: "Overall risk is medium",
    priority: "low",
    status: "proposed",
    created_at: "2026-11-05T11:00:00.000Z",
  },
];

const suppliers: SupplierRecord[] = [
  {
    id: 1,
    name: "Alpha Präzisionsteile GmbH",
    country: "DE",
    category: "Precision parts",
    criticality: "high",
    is_synthetic: true,
    overall_score: 75.3,
    classification: "high",
    confidence: 0.8,
    last_assessed_at: "2026-11-06T15:00:00.000Z",
    document_count: 4,
    website: "https://example.com/alpha",
    documents: [
      {
        id: 1,
        filename: "alpha-annual-report-2025.pdf",
        doc_type: "financial_report",
        status: "processed",
        error: null,
        page_count: 4,
        created_at: "2026-11-06T14:40:00.000Z",
      },
      {
        id: 2,
        filename: "alpha-iso-9001.pdf",
        doc_type: "certification",
        status: "processed",
        error: null,
        page_count: 1,
        created_at: "2026-11-06T14:41:00.000Z",
      },
      {
        id: 3,
        filename: "alpha-supply-contract.pdf",
        doc_type: "contract",
        status: "processed",
        error: null,
        page_count: 2,
        created_at: "2026-11-06T14:42:00.000Z",
      },
      {
        id: 4,
        filename: "alpha-delivery-report.pdf",
        doc_type: "delivery_report",
        status: "processed",
        error: null,
        page_count: 2,
        created_at: "2026-11-06T14:43:00.000Z",
      },
    ],
    missing_documents: [],
    latest_run: {
      id: 1,
      supplier_id: 1,
      status: "succeeded",
      steps: STEP_NAMES.map((name) => ({ name, status: "succeeded", error: null })),
      error: null,
      created_at: "2026-11-06T14:50:00.000Z",
      finished_at: "2026-11-06T15:00:00.000Z",
    },
    failExternalResearch: false,
  },
  {
    id: 2,
    name: "Beta Kunststofftechnik GmbH",
    country: "DE",
    category: "Plastics",
    criticality: "medium",
    is_synthetic: true,
    overall_score: 48.2,
    classification: "medium",
    confidence: 0.74,
    last_assessed_at: "2026-11-05T11:00:00.000Z",
    document_count: 2,
    website: null,
    documents: [
      {
        id: 5,
        filename: "beta-financials.pdf",
        doc_type: "financial_report",
        status: "processed",
        error: null,
        page_count: 3,
        created_at: "2026-11-05T10:20:00.000Z",
      },
      {
        id: 6,
        filename: "beta-iso-9001.pdf",
        doc_type: "certification",
        status: "processed",
        error: null,
        page_count: 1,
        created_at: "2026-11-05T10:21:00.000Z",
      },
    ],
    missing_documents: ["contract"],
    latest_run: null,
    failExternalResearch: false,
  },
  {
    id: 3,
    name: "Gamma Elektronik AG",
    country: "CH",
    category: "Electronics",
    criticality: "medium",
    is_synthetic: true,
    overall_score: 18.6,
    classification: "low",
    confidence: 0.91,
    last_assessed_at: "2026-11-04T09:30:00.000Z",
    document_count: 3,
    website: "https://example.com/gamma",
    documents: [],
    missing_documents: [],
    latest_run: null,
    failExternalResearch: false,
  },
  {
    id: 4,
    name: "Delta Logistik GmbH",
    country: "DE",
    category: "Logistics",
    criticality: "low",
    is_synthetic: true,
    overall_score: 42,
    classification: "insufficient_data",
    confidence: 0.22,
    last_assessed_at: "2026-11-03T16:10:00.000Z",
    document_count: 1,
    website: null,
    documents: [
      {
        id: 7,
        filename: "delta-contract.pdf",
        doc_type: "contract",
        status: "processed",
        error: null,
        page_count: 2,
        created_at: "2026-11-03T16:00:00.000Z",
      },
    ],
    missing_documents: ["certification", "financial_report"],
    latest_run: null,
    failExternalResearch: false,
  },
  {
    id: 5,
    name: "Epsilon Werkzeuge KG",
    country: "DE",
    category: "Tooling",
    criticality: "medium",
    is_synthetic: true,
    overall_score: null,
    classification: null,
    confidence: null,
    last_assessed_at: null,
    document_count: 0,
    website: null,
    documents: [],
    missing_documents: ["certification", "financial_report", "contract"],
    latest_run: null,
    failExternalResearch: false,
  },
  {
    id: 6,
    name: "Zeta Stahlhandel AG",
    country: "AT",
    category: "Steel",
    criticality: "high",
    is_synthetic: false,
    overall_score: 52.4,
    classification: "medium",
    confidence: 0.63,
    last_assessed_at: "2026-11-02T08:00:00.000Z",
    document_count: 1,
    website: "https://example.com/zeta",
    documents: [
      {
        id: 8,
        filename: "zeta-overview.pdf",
        doc_type: "other",
        status: "failed",
        error: "Could not extract text from page 2.",
        page_count: 2,
        created_at: "2026-11-02T07:40:00.000Z",
      },
    ],
    missing_documents: ["certification", "financial_report", "contract", "delivery_report"],
    latest_run: {
      id: 2,
      supplier_id: 6,
      status: "succeeded",
      steps: STEP_NAMES.map((name) =>
        name === "external_research"
          ? { name, status: "failed" as const, error: "Web research unavailable" }
          : { name, status: "succeeded" as const, error: null },
      ),
      error: null,
      created_at: "2026-11-02T07:45:00.000Z",
      finished_at: "2026-11-02T08:00:00.000Z",
    },
    failExternalResearch: true,
  },
];

function sortedSuppliers(): SupplierSummary[] {
  return suppliers
    .map(summaryOf)
    .sort((a, b) => {
      if (a.overall_score == null && b.overall_score == null) return a.name.localeCompare(b.name);
      if (a.overall_score == null) return 1;
      if (b.overall_score == null) return -1;
      return b.overall_score - a.overall_score;
    });
}

function dashboard(): Dashboard {
  const list = suppliers.map(summaryOf);
  const count = (value: SupplierSummary["classification"]) =>
    list.filter((supplier) => supplier.classification === value).length;
  const open = actions
    .filter((action) => action.status === "proposed" || action.status === "approved")
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 };
      return rank[a.priority] - rank[b.priority];
    })
    .slice(0, 8);
  return {
    totals: {
      suppliers: list.length,
      high: count("high"),
      medium: count("medium"),
      low: count("low"),
      insufficient_data: count("insufficient_data"),
      not_assessed: list.filter((supplier) => supplier.classification == null).length,
    },
    top_risk: sortedSuppliers().filter((supplier) => supplier.overall_score != null).slice(0, 5),
    certifications: [
      {
        supplier_id: 1,
        supplier_name: "Alpha Präzisionsteile GmbH",
        standard: "ISO 9001",
        expires_on: "2026-09-07",
        days_left: -61,
      },
      {
        supplier_id: 2,
        supplier_name: "Beta Kunststofftechnik GmbH",
        standard: "ISO 9001",
        expires_on: "2026-12-07",
        days_left: 30,
      },
    ],
    open_actions: open,
  };
}

function fail(status: number, code: string, message: string): never {
  throw { status, code, message };
}

function findSupplier(id: number): SupplierRecord {
  const supplier = suppliers.find((item) => item.id === id);
  if (!supplier) fail(404, "not_found", "Supplier not found.");
  return supplier;
}

function parseBody(init?: RequestInit): unknown {
  if (typeof init?.body !== "string") return {};
  return JSON.parse(init.body) as unknown;
}

export function mockApi<T>(path: string, init?: RequestInit): T {
  const method = (init?.method ?? "GET").toUpperCase();
  const url = path.split("?")[0] ?? path;

  if (method === "GET" && url === "/api/health") return { status: "ok" } as T;
  if (method === "GET" && url === "/api/suppliers") return sortedSuppliers() as T;
  if (method === "GET" && url === "/api/dashboard") return dashboard() as T;

  if (method === "POST" && url === "/api/suppliers") {
    const body = parseBody(init) as SupplierInput;
    if (suppliers.some((item) => item.name.toLowerCase() === body.name.trim().toLowerCase())) {
      fail(409, "duplicate_name", "A supplier with this name already exists.");
    }
    const created: SupplierRecord = {
      id: nextSupplierId++,
      name: body.name.trim(),
      country: body.country,
      category: body.category ?? null,
      criticality: body.criticality ?? "medium",
      is_synthetic: body.is_synthetic ?? false,
      overall_score: null,
      classification: null,
      confidence: null,
      last_assessed_at: null,
      document_count: 0,
      website: body.website ?? null,
      documents: [],
      missing_documents: ["certification", "financial_report", "contract"],
      latest_run: null,
      failExternalResearch: false,
    };
    suppliers.push(created);
    return created as T;
  }

  const supplierMatch = url.match(/^\/api\/suppliers\/(\d+)$/);
  if (supplierMatch && method === "GET") {
    const supplier = findSupplier(Number(supplierMatch[1]));
    return { ...supplier, documents: [...supplier.documents] } as T;
  }

  const docsMatch = url.match(/^\/api\/suppliers\/(\d+)\/documents$/);
  if (docsMatch && method === "POST") {
    const supplier = findSupplier(Number(docsMatch[1]));
    const uploaded: SupplierDocument[] = [];
    const form = init?.body;
    const files =
      typeof FormData !== "undefined" && form instanceof FormData ? form.getAll("files") : [];
    const names = files.length
      ? files.map((file) => (file instanceof File ? file.name : "upload.pdf"))
      : ["upload.pdf"];
    for (const filename of names) {
      const document: SupplierDocument = {
        id: nextDocumentId++,
        filename,
        doc_type: "other",
        status: "uploaded",
        error: null,
        page_count: null,
        created_at: NOW,
      };
      supplier.documents.push(document);
      uploaded.push(document);
    }
    supplier.document_count = supplier.documents.length;
    return uploaded as T;
  }

  const analyzeMatch = url.match(/^\/api\/suppliers\/(\d+)\/analyze$/);
  if (analyzeMatch && method === "POST") {
    const supplier = findSupplier(Number(analyzeMatch[1]));
    if (supplier.latest_run && (supplier.latest_run.status === "queued" || supplier.latest_run.status === "running")) {
      return supplier.latest_run as T;
    }
    const run: AnalysisRun = {
      id: nextRunId++,
      supplier_id: supplier.id,
      status: "queued",
      steps: STEP_NAMES.map((name) => ({ name, status: "pending", error: null })),
      error: null,
      created_at: NOW,
      finished_at: null,
    };
    polls.set(run.id, 0);
    supplier.latest_run = run;
    return run as T;
  }

  const riskMatch = url.match(/^\/api\/suppliers\/(\d+)\/risk$/);
  if (riskMatch && method === "GET") {
    const assessment = assessments.get(Number(riskMatch[1]));
    if (!assessment) fail(404, "not_found", "This supplier has not been analysed.");
    return assessment as T;
  }

  const signalsMatch = url.match(/^\/api\/suppliers\/(\d+)\/signals$/);
  if (signalsMatch && method === "GET") {
    return (signalsBySupplier.get(Number(signalsMatch[1])) ?? []) as T;
  }

  const actionsMatch = url.match(/^\/api\/suppliers\/(\d+)\/actions$/);
  if (actionsMatch && method === "GET") {
    const id = Number(actionsMatch[1]);
    return actions.filter((action) => action.supplier_id === id) as T;
  }

  const runMatch = url.match(/^\/api\/runs\/(\d+)$/);
  if (runMatch && method === "GET") {
    const id = Number(runMatch[1]);
    const supplier = suppliers.find((item) => item.latest_run?.id === id);
    if (!supplier?.latest_run) fail(404, "not_found", "Analysis run not found.");
    return materialiseRun(supplier) as T;
  }

  const actionMatch = url.match(/^\/api\/actions\/(\d+)$/);
  if (actionMatch && method === "PATCH") {
    const action = actions.find((item) => item.id === Number(actionMatch[1]));
    if (!action) fail(404, "not_found", "Action not found.");
    const body = parseBody(init) as { status?: ActionItem["status"] };
    if (body.status === "approved" || body.status === "rejected" || body.status === "done") {
      action.status = body.status;
    }
    return action as T;
  }

  if (method === "POST" && url === "/api/assistant/query") {
    const answer: AssistantAnswer = {
      ...assistantAnswer,
      proposed_actions: [
        {
          id: nextActionId++,
          supplier_id: 1,
          supplier_name: "Alpha Präzisionsteile GmbH",
          template_key: "qualify_alternative_supplier",
          title: "Qualify an alternative supplier",
          rationale: "Overall risk is high and criticality is high",
          priority: "high",
          status: "proposed",
          created_at: NOW,
        },
      ],
    };
    actions.push(answer.proposed_actions[0]);
    return answer as T;
  }

  if (method === "POST" && url === "/api/voice/transcribe") {
    return { text: "Which supplier has the highest risk, and why?" } as T;
  }
  if (method === "POST" && url === "/api/voice/speak") {
    fail(503, "provider_error", "Voice playback needs the real backend (NEXT_PUBLIC_API_MOCK=0).");
  }

  fail(404, "not_found", `No mock for ${method} ${url}`);
}
