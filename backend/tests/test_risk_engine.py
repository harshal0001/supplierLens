from datetime import date, datetime, timedelta

import pytest

from app.facts import Certification, ContractTerms, Delivery, DocumentExtraction, Financials, NumFact, BoolFact
from app.services import risk_engine as re_
from app.services.risk_engine import DocInput, IndicatorDraft, SignalInput, SupplierInput

TODAY = date(2026, 11, 7)
SUP = SupplierInput(name="Alpha", country="DE", criticality="medium")


def n(v):
    return NumFact(value=v, quote=f"value {v}", page=1)


def doc(**kw) -> DocInput:
    return DocInput(1, "a.pdf", DocumentExtraction(doc_type="other", **kw))


def iso(expires: date, std="ISO 9001:2015") -> Certification:
    return Certification(standard=std, expires_on=expires, quote="cert", page=1)


def ind(rule_key, docs, sup=SUP, signals=()):
    return [i for i in re_.build_indicators(sup, docs, list(signals), TODAY) if i.rule_key == rule_key]


@pytest.mark.parametrize("pct,sev", [(84.9, 75), (85, 45), (94.9, 45), (95, 10)])
def test_on_time_bands(pct, sev):
    (i,) = ind("on_time_delivery", [doc(delivery=Delivery(on_time_delivery_pct=n(pct)))])
    assert i.severity == sev and i.category == "delivery" and i.evidence[0]["page_number"] == 1


@pytest.mark.parametrize("ppm,sev", [(1001, 70), (1000, 40), (200, 40), (199, 10)])
def test_defect_bands(ppm, sev):
    assert ind("defect_rate", [doc(delivery=Delivery(defect_rate_ppm=n(ppm)))])[0].severity == sev


@pytest.mark.parametrize("days,key,sev", [(-1, "cert_expired", 85), (89, "cert_expiring", 50),
                                          (90, "cert_expiring", 50), (91, "cert_valid", 10)])
def test_cert_expiry(days, key, sev):
    (i,) = ind(key, [doc(certifications=[iso(TODAY + timedelta(days=days))])])
    assert i.severity == sev


def test_cert_dedupe_latest_expiry_wins():
    d = doc(certifications=[iso(TODAY - timedelta(days=10)), iso(TODAY + timedelta(days=400), "ISO 9001")])
    assert ind("cert_expired", [d]) == [] and len(ind("cert_valid", [d])) == 1


def test_missing_iso9001():
    assert ind("iso9001_missing", [])[0].severity == 60
    assert ind("iso9001_missing", [doc(certifications=[iso(TODAY + timedelta(days=400))])]) == []


@pytest.mark.parametrize("rev,prev,sev", [(80, 100, 70), (81, 100, 45), (95, 100, 45), (96, 100, 15)])
def test_revenue_change(rev, prev, sev):
    assert ind("revenue_change", [doc(financials=Financials(revenue=n(rev), revenue_prev=n(prev)))])[0].severity == sev


def test_financial_rules():
    d = doc(financials=Financials(net_income=n(-5), equity_ratio_pct=n(9.9), current_ratio=n(1.0)))
    assert ind("net_loss", [d])[0].severity == 65
    assert ind("equity_ratio", [d])[0].severity == 75
    assert ind("current_ratio", [d])[0].severity == 35


def test_single_source_only_for_critical():
    d = doc(contract=ContractTerms(single_source=BoolFact(value=True, quote="sole source", page=2)))
    assert ind("single_source", [d]) == []
    assert ind("single_source", [d], sup=SupplierInput("A", "DE", "high"))[0].severity == 70


def sig(status, typ="insolvency_or_bankruptcy", days_old=10):
    return SignalInput(1, "News", "https://x", typ, "filed for insolvency", "excerpt", status,
                       datetime(2026, 11, 7) - timedelta(days=days_old))


def test_signals_filtering():
    assert ind("signal:insolvency_or_bankruptcy", [], signals=[sig("rejected")]) == []
    assert ind("signal:insolvency_or_bankruptcy", [], signals=[sig("unverified", days_old=800)]) == []
    assert ind("signal:other_irrelevant", [], signals=[sig("unverified", typ="other_irrelevant")]) == []
    (i,) = ind("signal:insolvency_or_bankruptcy", [], signals=[sig("unverified")])
    assert i.confidence == 0.5 and i.severity == 95 and i.evidence[0]["url"] == "https://x"


def I(cat, sev, conf):
    return IndicatorDraft(cat, "k", "l", None, sev, conf, "document_fact")


def test_empty_is_insufficient():
    a = re_.score([])
    assert a.overall_score is None and a.classification == "insufficient_data" and a.coverage == 0


def test_only_external_is_insufficient():
    a = re_.score([I("external", 10, 0.7)])
    assert a.coverage == 0.15 and a.classification == "insufficient_data" and a.overall_score == 10


def test_unconfirmed_critical_is_averaged_confirmed_is_not():
    base = [I("financial", 15, 0.9), I("financial", 15, 0.9)]
    unverified = re_.score(base + [I("financial", 95, 0.5)]).categories["financial"]["score"]
    confirmed = re_.score(base + [I("financial", 95, 0.75)]).categories["financial"]["score"]
    assert unverified < 50 and confirmed == 95


def test_not_assessed_is_not_low():
    a = re_.score([I("financial", 80, 0.9), I("delivery", 80, 0.9), I("operational", 80, 0.9)])
    assert a.categories["compliance"]["score"] is None
    assert a.coverage == 0.7 and a.overall_score == 80 and a.classification == "high"


@pytest.mark.parametrize("s,c", [(30, "low"), (30.1, "medium"), (30.5, "medium"), (60, "medium"),
                                 (60.1, "high"), (61, "high")])
def test_classification_bounds(s, c):
    assert re_.classify(s, 1.0) == c


def test_weights_sum_to_one_and_deterministic():
    assert abs(sum(re_.WEIGHTS.values()) - 1) < 1e-9
    xs = [I("financial", 70, 0.9), I("delivery", 45, 0.9), I("external", 10, 0.7)]
    assert re_.score(xs) == re_.score(xs)


def test_actions():
    xs = [I("financial", 80, 0.9), I("delivery", 80, 0.9), I("operational", 80, 0.9)]
    a = re_.score(xs)
    keys = {x.template_key for x in re_.plan_actions(a, xs, "high", {"financial_report"})}
    assert {"request_financials", "delivery_recovery_plan", "qualify_alternative_supplier",
            "schedule_reassessment"} <= keys


def test_missing_documents():
    assert re_.missing_documents({"contract"}, "high") == ["certification", "financial_report", "delivery_report"]


def test_concern_restating_a_fact_is_skipped():
    from app.facts import Concern
    q = "value 80"
    d = doc(delivery=Delivery(on_time_delivery_pct=n(80)),
            concerns=[Concern(category="delivery", text="Late deliveries", quote=q, page=1),
                      Concern(category="operational", text="Staff shortage", quote="line 2 reduced", page=1)])
    assert [i.label for i in ind("ai_concern", [d])] == ["Staff shortage"]


def AI(cat, sev=40):
    return IndicatorDraft(cat, "ai_concern", "l", None, sev, 0.4, "ai_interpretation")


@pytest.mark.parametrize("xs,cat,score,conf,count,coverage", [
    # AI-only category: not assessed, excluded from coverage, indicators still counted
    ([AI("operational")], "operational", None, 0.0, 1, 0),
    ([AI("operational"), AI("operational", 90), I("external", 10, 0.7)], "operational", None, 0.0, 2, 0.15),
    # assessed category: AI indicator still counts in mean and confidence (unchanged)
    ([I("operational", 70, 0.9), AI("operational")], "operational", 70, 0.94, 2, 0.25),
    ([I("operational", 50, 0.5), AI("operational")], "operational", 45.56, 0.7, 2, 0.25),
])
def test_ai_only_category_not_assessed(xs, cat, score, conf, count, coverage):
    a = re_.score(xs)
    c = a.categories[cat]
    assert (c["score"], c["confidence"], c["indicator_count"], a.coverage) == (score, conf, count, coverage)


def test_delta_like_contract_only_is_insufficient():
    from app.facts import Concern
    d = doc(contract=ContractTerms(single_source=BoolFact(value=True, quote="sole supplier", page=1)),
            concerns=[Concern(category="operational", text="Single-source dependency", quote="sole supplier", page=1)])
    xs = re_.build_indicators(SupplierInput(name="Delta", country="DE", criticality="medium"), [d], [], TODAY)
    assert {(i.category, i.basis) for i in xs} == {("compliance", "document_fact"), ("external", "reference_data"),
                                                   ("operational", "ai_interpretation")}
    a = re_.score(xs)  # before the rule: coverage 0.55, overall 37.3 medium
    assert a.coverage == 0.3 and a.classification == "insufficient_data" and a.overall_score == 35.0
    assert a.categories["operational"]["score"] is None and a.categories["operational"]["indicator_count"] == 1


def test_same_concern_in_two_documents_counts_once():
    from app.facts import Concern
    c = Concern(category="operational", text="Capacity shortage", quote="line 2 runs at reduced capacity", page=1)
    twice = [DocInput(1, "a.pdf", DocumentExtraction(doc_type="other", concerns=[c])),
             DocInput(2, "a (1).pdf", DocumentExtraction(doc_type="other", concerns=[c]))]
    assert len(ind("ai_concern", twice)) == 1
