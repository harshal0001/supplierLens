"""API shapes — must match docs/CONTRACT.md §4 exactly."""

from datetime import UTC, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer, field_validator


def _iso_utc(dt: datetime) -> str:
    # SQLite returns naive datetimes; we only ever store UTC.
    return (dt if dt.tzinfo else dt.replace(tzinfo=UTC)).isoformat().replace("+00:00", "Z")


UtcDatetime = Annotated[datetime, PlainSerializer(_iso_utc, return_type=str)]

Classification = Literal["low", "medium", "high", "insufficient_data"]
Category = Literal["financial", "operational", "delivery", "compliance", "external"]
DocType = Literal["financial_report", "certification", "delivery_report", "contract", "other"]
Criticality = Literal["low", "medium", "high"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class SupplierInput(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    country: str
    website: str | None = None
    category: str | None = Field(default=None, max_length=200)
    criticality: Criticality = "medium"
    is_synthetic: bool = False

    @field_validator("name")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be empty")
        return v

    @field_validator("country")
    @classmethod
    def _country(cls, v: str) -> str:
        v = v.strip().upper()
        if len(v) != 2 or not v.isalpha():
            raise ValueError("country must be a 2-letter ISO code")
        return v


class SupplierDocument(ORM):
    id: int
    filename: str
    doc_type: DocType
    status: Literal["uploaded", "processing", "processed", "failed"]
    error: str | None
    page_count: int | None
    created_at: UtcDatetime


class AnalysisStep(BaseModel):
    name: Literal["process_documents", "external_research", "score", "recommend"]
    status: Literal["pending", "running", "succeeded", "failed"]
    error: str | None = None


class AnalysisRunOut(ORM):
    id: int
    supplier_id: int
    status: Literal["queued", "running", "succeeded", "failed"]
    steps: list[AnalysisStep]
    error: str | None
    created_at: UtcDatetime
    finished_at: UtcDatetime | None


class SupplierSummary(BaseModel):
    id: int
    name: str
    country: str
    category: str | None
    criticality: Criticality
    is_synthetic: bool
    overall_score: float | None
    classification: Classification | None
    confidence: float | None
    last_assessed_at: UtcDatetime | None
    document_count: int


class SupplierDetail(SupplierSummary):
    website: str | None
    documents: list[SupplierDocument]
    missing_documents: list[DocType]
    latest_run: AnalysisRunOut | None


class Evidence(BaseModel):
    id: str
    source_type: Literal["document", "external", "reference"]
    title: str
    excerpt: str
    url: str | None = None
    document_id: int | None = None
    page_number: int | None = None
    source_date: str | None = None


class CategoryScore(BaseModel):
    score: float | None
    confidence: float
    weight: float
    indicator_count: int


class RiskIndicator(ORM):
    id: int
    category: Category
    rule_key: str
    label: str
    value: str | None
    severity: float
    confidence: float
    basis: Literal["document_fact", "external_signal", "ai_interpretation", "reference_data"]
    evidence: list[Evidence]


class RiskAssessment(BaseModel):
    id: int
    supplier_id: int
    overall_score: float | None
    classification: Classification
    confidence: float
    coverage: float
    categories: dict[Category, CategoryScore]
    indicators: list[RiskIndicator]
    summary: str | None
    created_at: UtcDatetime


class RiskHistoryPoint(ORM):
    id: int
    overall_score: float | None
    classification: Classification
    confidence: float
    coverage: float
    created_at: UtcDatetime


class ExternalSignalOut(BaseModel):
    id: int
    title: str
    url: str
    published_at: UtcDatetime | None
    retrieved_at: UtcDatetime
    signal_type: str
    category: Category | None
    severity: float | None
    claim: str
    excerpt: str
    relevance: float
    verification_status: Literal["unverified", "source_confirmed", "rejected"]


class ActionItem(BaseModel):
    id: int
    supplier_id: int
    supplier_name: str
    template_key: str
    title: str
    rationale: str
    priority: Literal["low", "medium", "high"]
    status: Literal["proposed", "approved", "rejected", "done"]
    created_at: UtcDatetime


class ActionPatch(BaseModel):
    status: Literal["approved", "rejected", "done"]


class DashboardTotals(BaseModel):
    suppliers: int
    high: int
    medium: int
    low: int
    insufficient_data: int
    not_assessed: int


class DashboardCert(BaseModel):
    supplier_id: int
    supplier_name: str
    standard: str
    expires_on: str
    days_left: int


class Dashboard(BaseModel):
    totals: DashboardTotals
    top_risk: list[SupplierSummary]
    certifications: list[DashboardCert]
    open_actions: list[ActionItem]


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class AssistantQuery(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    supplier_id: int | None = None
    history: list[ChatTurn] = Field(default_factory=list, max_length=12)


class Citation(BaseModel):
    evidence_id: str
    title: str
    excerpt: str
    url: str | None
    document_id: int | None
    page_number: int | None
    supplier_id: int


class AssistantAnswer(BaseModel):
    answer: str
    citations: list[Citation]
    proposed_actions: list[ActionItem]
