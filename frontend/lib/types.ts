// Copied verbatim from docs/CONTRACT.md §4.

export type Classification = "low" | "medium" | "high" | "insufficient_data";
export type Category = "financial" | "operational" | "delivery" | "compliance" | "external";
export type DocType = "financial_report" | "certification" | "delivery_report" | "contract" | "other";

export interface SupplierInput {
  name: string;
  country: string;
  website?: string;
  category?: string;
  criticality?: "low" | "medium" | "high";
  is_synthetic?: boolean;
}

export interface SupplierSummary {
  id: number;
  name: string;
  country: string;
  category: string | null;
  criticality: "low" | "medium" | "high";
  is_synthetic: boolean;
  overall_score: number | null;
  classification: Classification | null;
  confidence: number | null;
  last_assessed_at: string | null;
  document_count: number;
}

export interface SupplierDetail extends SupplierSummary {
  website: string | null;
  documents: SupplierDocument[];
  missing_documents: DocType[];
  latest_run: AnalysisRun | null;
}

export interface SupplierDocument {
  id: number;
  filename: string;
  doc_type: DocType;
  status: "uploaded" | "processing" | "processed" | "failed";
  error: string | null;
  page_count: number | null;
  created_at: string;
}

export interface AnalysisStep {
  name: "process_documents" | "external_research" | "score" | "recommend";
  status: "pending" | "running" | "succeeded" | "failed";
  error: string | null;
}

export interface AnalysisRun {
  id: number;
  supplier_id: number;
  status: "queued" | "running" | "succeeded" | "failed";
  steps: AnalysisStep[];
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface Evidence {
  id: string;
  source_type: "document" | "external" | "reference";
  title: string;
  excerpt: string;
  url: string | null;
  document_id: number | null;
  page_number: number | null;
  source_date: string | null;
}

export interface CategoryScore {
  score: number | null;
  confidence: number;
  weight: number;
  indicator_count: number;
}

export interface RiskIndicator {
  id: number;
  category: Category;
  rule_key: string;
  label: string;
  value: string | null;
  severity: number;
  confidence: number;
  basis: "document_fact" | "external_signal" | "ai_interpretation" | "reference_data";
  evidence: Evidence[];
}

export interface RiskAssessment {
  id: number;
  supplier_id: number;
  overall_score: number | null;
  classification: Classification;
  confidence: number;
  coverage: number;
  categories: Record<Category, CategoryScore>;
  indicators: RiskIndicator[];
  summary: string | null;
  created_at: string;
}

export interface RiskHistoryPoint {
  id: number;
  overall_score: number | null;
  classification: Classification;
  confidence: number;
  coverage: number;
  created_at: string;
}

export interface ExternalSignal {
  id: number;
  title: string;
  url: string;
  published_at: string | null;
  retrieved_at: string;
  signal_type: string;
  category: Category | null;
  severity: number | null;
  claim: string;
  excerpt: string;
  relevance: number;
  verification_status: "unverified" | "source_confirmed" | "rejected";
}

export interface ActionItem {
  id: number;
  supplier_id: number;
  supplier_name: string;
  template_key: string;
  title: string;
  rationale: string;
  priority: "low" | "medium" | "high";
  status: "proposed" | "approved" | "rejected" | "done";
  created_at: string;
}

export interface Dashboard {
  totals: {
    suppliers: number;
    high: number;
    medium: number;
    low: number;
    insufficient_data: number;
    not_assessed: number;
  };
  top_risk: SupplierSummary[];
  certifications: {
    supplier_id: number;
    supplier_name: string;
    standard: string;
    expires_on: string;
    days_left: number;
  }[];
  open_actions: ActionItem[];
}

export interface Citation {
  evidence_id: string;
  title: string;
  excerpt: string;
  url: string | null;
  document_id: number | null;
  page_number: number | null;
  supplier_id: number;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantAnswer {
  answer: string;
  citations: Citation[];
  proposed_actions: ActionItem[];
}

export interface ApiFailure {
  status: number;
  code: string;
  message: string;
}
