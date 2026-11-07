"""Deterministic, explainable risk scoring. Pure functions: no DB, no LLM."""

import re
import secrets
from dataclasses import dataclass, field
from datetime import date, datetime

from app.facts import DocumentExtraction, Quoted

RULES_VERSION = "v1"
WEIGHTS = {"financial": 0.25, "operational": 0.25, "delivery": 0.20, "compliance": 0.15, "external": 0.15}
CONF = {"document_fact": 0.9, "ai_interpretation": 0.4, "reference_data": 0.7,
        "unverified": 0.5, "source_confirmed": 0.75}
CRITICAL_CONF = 0.75
SIGNAL_MAX_AGE_DAYS = 730

SIGNAL_RULES: dict[str, tuple[str, int]] = {
    "insolvency_or_bankruptcy": ("financial", 95),
    "financial_distress": ("financial", 70),
    "layoffs_or_restructuring": ("operational", 55),
    "plant_closure_or_disruption": ("operational", 75),
    "strike_or_cyberattack": ("operational", 65),
    "product_recall_or_quality_issue": ("delivery", 60),
    "sanctions_or_export_control": ("compliance", 100),
    "fine_investigation_or_litigation": ("compliance", 55),
    "geopolitical_or_trade_exposure": ("external", 60),
    "positive_investment_or_expansion": ("operational", 15),
}
SIGNAL_LABELS = {k: k.replace("_or_", " / ").replace("_", " ").capitalize() for k in SIGNAL_RULES}

_LOW_RISK_COUNTRIES = set(
    "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE "
    "IS LI NO CH GB US CA JP".split()
)
_COUNTRY_RISK = {"CN": 45, "TR": 35, "IN": 35, "MX": 35, "RU": 95, "BY": 95, "IR": 95, "KP": 95}


def country_severity(country: str) -> int:
    c = country.upper()
    return 10 if c in _LOW_RISK_COUNTRIES else _COUNTRY_RISK.get(c, 30)


@dataclass
class DocInput:
    document_id: int
    filename: str
    extraction: DocumentExtraction


@dataclass
class SignalInput:
    id: int
    title: str
    url: str
    signal_type: str
    claim: str
    excerpt: str
    verification_status: str
    published_at: datetime | None


@dataclass
class SupplierInput:
    name: str
    country: str
    criticality: str


@dataclass
class IndicatorDraft:
    category: str
    rule_key: str
    label: str
    value: str | None
    severity: float
    confidence: float
    basis: str
    evidence: list[dict] = field(default_factory=list)


@dataclass
class AssessmentDraft:
    overall_score: float | None
    classification: str
    confidence: float
    coverage: float
    categories: dict[str, dict]


def _ev_doc(doc: DocInput, q: Quoted) -> dict:
    return {"id": secrets.token_hex(4), "source_type": "document", "title": f"{doc.filename}, p. {q.page}",
            "excerpt": q.quote, "url": None, "document_id": doc.document_id, "page_number": q.page, "source_date": None}


def _ev_ref(title: str, excerpt: str) -> dict:
    return {"id": secrets.token_hex(4), "source_type": "reference", "title": title, "excerpt": excerpt,
            "url": None, "document_id": None, "page_number": None, "source_date": None}


def _band(x: float, bands: list[tuple[float, int]], top: int) -> int:
    """Return severity of the first band whose upper bound (exclusive) is above x."""
    for upper, sev in bands:
        if x < upper:
            return sev
    return top


def _cert_key(standard: str) -> str:
    m = re.search(r"(ISO|IATF)\s*(\d{4,5})", standard.upper())
    return f"{m.group(1)} {m.group(2)}" if m else standard.strip().upper()


def build_indicators(supplier: SupplierInput, docs: list[DocInput], signals: list[SignalInput],
                     today: date) -> list[IndicatorDraft]:
    out: list[IndicatorDraft] = []

    def doc_ind(cat, key, label, value, sev, doc, *quotes):
        out.append(IndicatorDraft(cat, key, label, value, sev, CONF["document_fact"], "document_fact",
                                  [_ev_doc(doc, q) for q in quotes]))

    # --- financial: latest report wins (by fiscal_year_end; undated reports rank last)
    fin_docs = [d for d in docs if d.extraction.financials]
    fin_docs.sort(key=lambda d: d.extraction.financials.fiscal_year_end.value
                  if d.extraction.financials.fiscal_year_end else date.min, reverse=True)
    if fin_docs:
        d = fin_docs[0]
        f = d.extraction.financials
        if f.net_income and f.net_income.value < 0:
            doc_ind("financial", "net_loss", "Net loss reported", f"{f.net_income.value:,.0f}", 65, d, f.net_income)
        if f.revenue and f.revenue_prev and f.revenue_prev.value > 0:
            pct = (f.revenue.value - f.revenue_prev.value) / f.revenue_prev.value * 100
            sev = 70 if pct <= -20 else 45 if pct <= -5 else 15
            doc_ind("financial", "revenue_change", "Revenue change year over year", f"{pct:+.1f} %", sev, d,
                    f.revenue, f.revenue_prev)
        if f.equity_ratio_pct:
            v = f.equity_ratio_pct.value
            doc_ind("financial", "equity_ratio", "Equity ratio", f"{v:.1f} %", _band(v, [(10, 75), (25, 45)], 15),
                    d, f.equity_ratio_pct)
        if f.current_ratio:
            v = f.current_ratio.value
            doc_ind("financial", "current_ratio", "Current ratio (liquidity)", f"{v:.2f}",
                    _band(v, [(1.0, 65), (1.5, 35)], 10), d, f.current_ratio)

    # --- delivery: first document that states the metric
    for metric in ("on_time_delivery_pct", "defect_rate_ppm"):
        for d in docs:
            fact = getattr(d.extraction.delivery, metric, None) if d.extraction.delivery else None
            if fact is None:
                continue
            v = fact.value
            if metric == "on_time_delivery_pct":
                doc_ind("delivery", "on_time_delivery", "On-time delivery rate", f"{v:.1f} %",
                        _band(v, [(85, 75), (95, 45)], 10), d, fact)
            else:
                sev = 70 if v > 1000 else 40 if v >= 200 else 10
                doc_ind("delivery", "defect_rate", "Defect rate", f"{v:,.0f} ppm", sev, d, fact)
            break

    # --- compliance: certificates, deduped by standard, latest expiry wins
    certs: dict[str, tuple] = {}
    for d in docs:
        for c in d.extraction.certifications:
            k = _cert_key(c.standard)
            prev = certs.get(k)
            if prev is None or (c.expires_on and (prev[1].expires_on is None or c.expires_on > prev[1].expires_on)):
                certs[k] = (d, c)
    for k, (d, c) in sorted(certs.items()):
        if c.expires_on is None:
            continue
        days = (c.expires_on - today).days
        if days < 0:
            doc_ind("compliance", "cert_expired", f"{k} certificate expired", f"expired {c.expires_on}", 85, d, c)
        elif days <= 90:
            doc_ind("compliance", "cert_expiring", f"{k} certificate expires in {days} days", str(c.expires_on), 50, d, c)
        else:
            doc_ind("compliance", "cert_valid", f"{k} certificate valid", f"until {c.expires_on}", 10, d, c)
    if "ISO 9001" not in certs:
        out.append(IndicatorDraft("compliance", "iso9001_missing", "No ISO 9001 certificate on file", None, 60,
                                  CONF["document_fact"], "document_fact",
                                  [_ev_ref("Document check", "No documents have been uploaded yet." if not docs else
                                           f"None of the {len(docs)} processed document{'s' if len(docs) > 1 else ''} "
                                           "contains an ISO 9001 certificate.")]))

    # --- operational: single-source dependency on a critical supplier
    if supplier.criticality == "high":
        for d in docs:
            ss = d.extraction.contract.single_source if d.extraction.contract else None
            if ss and ss.value:
                doc_ind("operational", "single_source", "Single-source dependency on a critical supplier",
                        "single source", 70, d, ss)
                break

    # --- AI-interpreted concerns: skip ones restating a quote already used (as a fact, or by an earlier concern,
    # e.g. the same PDF uploaded twice)
    used = {re.sub(r"\s+", " ", e["excerpt"]).strip().lower() for i in out for e in i.evidence}
    for d in docs:
        for c in d.extraction.concerns:
            key = re.sub(r"\s+", " ", c.quote).strip().lower()
            if key in used:
                continue
            used.add(key)
            out.append(IndicatorDraft(c.category, "ai_concern", c.text, None, 40, CONF["ai_interpretation"],
                                      "ai_interpretation", [_ev_doc(d, c)]))

    # --- external: country reference table
    sev = country_severity(supplier.country)
    out.append(IndicatorDraft("external", "country_risk", f"Country risk ({supplier.country.upper()})",
                              supplier.country.upper(), sev, CONF["reference_data"], "reference_data",
                              [_ev_ref(f"Country reference table {RULES_VERSION}",
                                       f"{supplier.country.upper()} rated {sev}/100 (hypothesis, to be calibrated).")]))

    # --- external web signals
    for s in signals:
        rule = SIGNAL_RULES.get(s.signal_type)
        if rule is None or s.verification_status == "rejected" or s.verification_status not in CONF:
            continue
        if s.published_at and (today - s.published_at.date()).days > SIGNAL_MAX_AGE_DAYS:
            continue
        cat, sev = rule
        out.append(IndicatorDraft(
            cat, f"signal:{s.signal_type}", f"{SIGNAL_LABELS[s.signal_type]}: {s.claim}"[:300], None, sev,
            CONF[s.verification_status], "external_signal",
            [{"id": secrets.token_hex(4), "source_type": "external", "title": s.title, "excerpt": s.excerpt,
              "url": s.url, "document_id": None, "page_number": None,
              "source_date": s.published_at.date().isoformat() if s.published_at else None}]))
    return out


def classify(overall: float | None, coverage: float) -> str:
    if overall is None or coverage < 0.5:
        return "insufficient_data"
    return "low" if overall <= 30 else "medium" if overall <= 60 else "high"  # low ≤ 30 < medium ≤ 60 < high


def score(indicators: list[IndicatorDraft]) -> AssessmentDraft:
    categories: dict[str, dict] = {}
    for cat, w in WEIGHTS.items():
        items = [i for i in indicators if i.category == cat]
        # AI interpretation alone is not verified evidence: such a category stays "Not assessed"
        if all(i.basis == "ai_interpretation" for i in items):
            categories[cat] = {"score": None, "confidence": 0.0, "weight": w, "indicator_count": len(items)}
            continue
        total_conf = sum(i.confidence for i in items)
        mean = sum(i.severity * i.confidence for i in items) / total_conf
        crit = max((i.severity for i in items if i.confidence >= CRITICAL_CONF), default=0)
        miss = 1.0
        for i in items:
            miss *= 1 - i.confidence
        categories[cat] = {"score": round(max(mean, crit), 2), "confidence": round(1 - miss, 3),
                           "weight": w, "indicator_count": len(items)}

    assessed = {c: v for c, v in categories.items() if v["score"] is not None}
    coverage = round(sum(v["weight"] for v in assessed.values()), 3)
    overall = round(sum(v["weight"] * v["score"] for v in assessed.values()) / coverage, 1) if coverage else None
    confidence = round(sum(v["weight"] * v["confidence"] for v in assessed.values()), 3)
    return AssessmentDraft(overall, classify(overall, coverage), confidence, coverage, categories)


def missing_documents(doc_types: set[str], criticality: str) -> list[str]:
    required = ["certification", "financial_report", "contract"] + (["delivery_report"] if criticality == "high" else [])
    return [t for t in required if t not in doc_types]


@dataclass
class ActionDraft:
    template_key: str
    title: str
    rationale: str
    priority: str


def plan_actions(a: AssessmentDraft, indicators: list[IndicatorDraft], criticality: str,
                 doc_types: set[str]) -> list[ActionDraft]:
    def labels(pred) -> str:
        return "; ".join(i.label for i in indicators if pred(i)) or ""

    cats = {c: v["score"] for c, v in a.categories.items()}
    out: list[ActionDraft] = []
    fin = cats["financial"]
    if fin is not None and fin >= 61:
        out.append(ActionDraft("request_financials", "Request updated financial statements",
                               labels(lambda i: i.category == "financial" and i.severity >= 45), "high"))
    elif "financial_report" not in doc_types:
        out.append(ActionDraft("request_financials", "Request updated financial statements",
                               "No financial report on file.", "medium"))
    cert = labels(lambda i: i.rule_key in ("cert_expired", "cert_expiring"))
    if cert:
        out.append(ActionDraft("renew_certification", "Request renewed certificate(s)", cert, "high"))
    if cats["delivery"] is not None and cats["delivery"] >= 61:
        out.append(ActionDraft("delivery_recovery_plan", "Review open orders and agree a delivery recovery plan",
                               labels(lambda i: i.category == "delivery" and i.severity >= 45), "high"))
    if a.classification == "high" and criticality == "high":
        out.append(ActionDraft("qualify_alternative_supplier", "Identify and qualify an alternative supplier",
                               f"Overall risk {a.overall_score} (high) on a critical supplier.", "high"))
    sig = labels(lambda i: i.basis == "external_signal" and i.severity >= 70)
    if sig:
        out.append(ActionDraft("verify_signal", "Verify reported web signal with the supplier", sig, "high"))
    if a.overall_score is not None and a.overall_score >= 31:
        days = 14 if a.classification == "high" else 30
        out.append(ActionDraft("schedule_reassessment", f"Schedule a reassessment in {days} days",
                               f"Overall risk {a.overall_score} ({a.classification}).", "low"))
    return out
