"""Schema for facts the LLM extracts from a document (CONTRACT §5.1).

Every fact carries a verbatim quote + page; extraction.verify_quotes() drops any fact whose quote is not in the source.
"""

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

Category = Literal["financial", "operational", "delivery", "compliance", "external"]
DocType = Literal["financial_report", "certification", "delivery_report", "contract", "other"]


class Quoted(BaseModel):
    quote: str = Field(description="Exact verbatim text copied from the document that states this fact")
    page: int = Field(description="Page number from the [page N] marker where the quote appears")


class NumFact(Quoted):
    value: float


class DateFact(Quoted):
    value: date


class BoolFact(Quoted):
    value: bool


class Certification(Quoted):
    standard: str = Field(description="e.g. 'ISO 9001', 'IATF 16949', 'ISO 14001'")
    expires_on: date | None = None


class Financials(BaseModel):
    fiscal_year_end: DateFact | None = None
    revenue: NumFact | None = Field(None, description="Revenue of the latest fiscal year, in the stated currency")
    revenue_prev: NumFact | None = Field(None, description="Revenue of the previous fiscal year, same currency")
    net_income: NumFact | None = Field(None, description="Net income / net profit; negative for a loss")
    equity_ratio_pct: NumFact | None = Field(None, description="Equity ratio in percent, e.g. 8.0 for 8 %")
    current_ratio: NumFact | None = None


class Delivery(BaseModel):
    on_time_delivery_pct: NumFact | None = Field(None, description="On-time delivery rate in percent")
    defect_rate_ppm: NumFact | None = Field(None, description="Defect rate in parts per million")


class ContractTerms(BaseModel):
    end_on: DateFact | None = None
    single_source: BoolFact | None = Field(None, description="True only if the contract states the supplier is the single/sole source")


class Concern(Quoted):
    category: Category
    text: str = Field(description="One-sentence description of the potential risk")


class DocumentExtraction(BaseModel):
    doc_type: DocType
    certifications: list[Certification] = Field(default_factory=list)
    financials: Financials | None = None
    delivery: Delivery | None = None
    contract: ContractTerms | None = None
    concerns: list[Concern] = Field(default_factory=list, max_length=5)
