import json
from datetime import date, timedelta
from types import SimpleNamespace as NS

import pytest

from app import llm
from app.errors import ProviderError
from app.facts import Certification, Delivery, DocumentExtraction, Financials, NumFact
from app.services import research as research_mod
from tests.conftest import make_pdf

EXPIRED = (date.today() - timedelta(days=60)).isoformat()
PDF = make_pdf([["Alpha GmbH Supplier Performance Report", "On-time delivery rate: 78.0 %"],
                ["Certificate ISO 9001:2015", f"Valid until {EXPIRED}"]])


def fake_extraction(*_a, **_k):
    return DocumentExtraction(
        doc_type="delivery_report",
        delivery=Delivery(on_time_delivery_pct=NumFact(value=78, quote="On-time delivery rate: 78.0 %", page=1)),
        certifications=[Certification(standard="ISO 9001:2015", expires_on=date.fromisoformat(EXPIRED),
                                      quote=f"Valid until {EXPIRED}", page=1)],  # wrong page → corrected to 2
        financials=Financials(net_income=NumFact(value=-2e6, quote="Net loss of EUR 2 million", page=1)),  # fabricated
    )


@pytest.fixture
def fakes(monkeypatch):
    monkeypatch.setattr(llm, "structured", fake_extraction)
    monkeypatch.setattr(llm, "text", lambda *a, **k: "Alpha shows delivery and compliance concerns.")
    monkeypatch.setattr(research_mod, "research", lambda db, sup: [])


def run_analysis(client, sid):
    run = client.post(f"/api/suppliers/{sid}/analyze")
    assert run.status_code == 202
    return client.get(f"/api/runs/{run.json()['id']}").json()  # TestClient runs background tasks before returning


def make_supplier(client, **kw):
    r = client.post("/api/suppliers", json={"name": "Alpha GmbH", "country": "de", "criticality": "high", **kw})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_end_to_end(client, fakes):
    sid = make_supplier(client)
    assert client.post("/api/suppliers", json={"name": "alpha gmbh", "country": "DE"}).status_code == 409
    up = client.post(f"/api/suppliers/{sid}/documents", files=[("files", ("otd_report.pdf", PDF, "application/pdf"))])
    assert up.status_code == 201 and up.json()[0]["doc_type"] == "delivery_report"

    run = run_analysis(client, sid)
    assert run["status"] == "succeeded", run
    assert [s["status"] for s in run["steps"]] == ["succeeded"] * 4
    assert run["steps"][1]["error"] == "No relevant web signals found"

    risk = client.get(f"/api/suppliers/{sid}/risk").json()
    keys = {i["rule_key"]: i for i in risk["indicators"]}
    assert keys["on_time_delivery"]["severity"] == 75
    assert keys["cert_expired"]["evidence"][0]["page_number"] == 2
    assert "net_loss" not in keys  # fabricated quote dropped
    assert risk["categories"]["financial"]["score"] is None
    assert risk["summary"]

    actions = {a["template_key"] for a in client.get(f"/api/suppliers/{sid}/actions").json()}
    assert {"renew_certification", "delivery_recovery_plan", "request_financials"} <= actions
    run_analysis(client, sid)  # re-run must not duplicate open actions
    assert len(client.get(f"/api/suppliers/{sid}/actions").json()) == len(actions)

    detail = client.get(f"/api/suppliers/{sid}").json()
    assert detail["classification"] == risk["classification"] and detail["document_count"] == 1
    dash = client.get("/api/dashboard").json()
    assert dash["totals"]["suppliers"] == 1 and dash["certifications"][0]["days_left"] < 0
    assert client.get(f"/api/documents/{up.json()[0]['id']}/file").content.startswith(b"%PDF")


def test_research_failure_does_not_fail_run(client, fakes, monkeypatch):
    def boom(db, sup):
        raise ProviderError("Exa down")
    monkeypatch.setattr(research_mod, "research", boom)
    sid = make_supplier(client)
    run = run_analysis(client, sid)
    assert run["status"] == "succeeded"
    assert run["steps"][1] == {"name": "external_research", "status": "failed", "error": "Exa down"}


def test_risk_history(client, fakes):
    sid = make_supplier(client)
    assert client.get(f"/api/suppliers/{sid}/risk/history").json() == []
    assert client.get("/api/suppliers/999/risk/history").status_code == 404
    client.post(f"/api/suppliers/{sid}/documents", files=[("files", ("otd_report.pdf", PDF, "application/pdf"))])
    run_analysis(client, sid)
    run_analysis(client, sid)
    hist = client.get(f"/api/suppliers/{sid}/risk/history").json()
    assert len(hist) == 2 and hist[0]["id"] < hist[1]["id"]
    assert hist[-1]["overall_score"] == client.get(f"/api/suppliers/{sid}/risk").json()["overall_score"]
    assert set(hist[0]) == {"id", "overall_score", "classification", "confidence", "coverage", "created_at"}


def test_upload_validation(client):
    sid = make_supplier(client)
    bad = client.post(f"/api/suppliers/{sid}/documents", files=[("files", ("x.pdf", b"hello", "application/pdf"))])
    assert bad.status_code == 415 and bad.json()["error"]["code"] == "unsupported_media_type"
    assert client.get("/api/suppliers/999").json()["error"]["code"] == "not_found"
    assert client.post("/api/suppliers", json={"name": "X", "country": "Germany"}).status_code == 422


def test_scanned_pdf_fails_doc_not_run(client, fakes):
    sid = make_supplier(client)
    client.post(f"/api/suppliers/{sid}/documents", files=[("files", ("scan.pdf", make_pdf([[]]), "application/pdf"))])
    run = run_analysis(client, sid)
    assert run["status"] == "succeeded" and "1 of 1" in run["steps"][0]["error"]
    doc = client.get(f"/api/suppliers/{sid}").json()["documents"][0]
    assert doc["status"] == "failed" and "No extractable text" in doc["error"]


# ---------------- assistant ----------------

def _msg(*blocks):
    return NS(content=list(blocks), usage=NS(input_tokens=1, output_tokens=1))


def test_assistant_citations(client, fakes, monkeypatch):
    sid = make_supplier(client)
    client.post(f"/api/suppliers/{sid}/documents", files=[("files", ("otd.pdf", PDF, "application/pdf"))])
    run_analysis(client, sid)
    calls = []

    def fake_create(**kw):
        calls.append(kw)
        if len(calls) == 1:
            return _msg(NS(type="tool_use", id="t1", name="get_risk", input={"supplier_id": sid}))
        if len(calls) == 2:
            return _msg(NS(type="tool_use", id="t2", name="propose_action",
                           input={"supplier_id": sid, "title": "Call Alpha", "rationale": "Low OTD"}))
        raw = kw["messages"][2]["content"][0]["content"]
        assert raw.startswith("<untrusted_document>")
        result = json.loads(raw.removeprefix("<untrusted_document>").removesuffix("</untrusted_document>"))
        real = result["indicators"][0]["evidence"][0]["evidence_id"]
        return _msg(NS(type="text", text=f"Alpha is high risk [E:{real}] and fake [E:deadbeef]."))

    monkeypatch.setattr(llm, "_create", fake_create)
    r = client.post("/api/assistant/query", json={"question": "Why is Alpha risky?"}).json()
    assert r["answer"] == "Alpha is high risk and fake."
    assert len(r["citations"]) == 1 and r["citations"][0]["supplier_id"] == sid
    assert r["proposed_actions"][0]["status"] == "proposed"


def test_assistant_unknown_supplier_tool(client, monkeypatch):
    seen = []

    def fake_create(**kw):
        if not seen:
            seen.append(1)
            return _msg(NS(type="tool_use", id="t1", name="get_risk", input={"supplier_id": 4242}))
        seen.append(kw["messages"][-1]["content"][0]["content"])
        return _msg(NS(type="text", text="I could not find that supplier."))

    monkeypatch.setattr(llm, "_create", fake_create)
    r = client.post("/api/assistant/query", json={"question": "Risk of supplier 4242?"}).json()
    assert "No supplier with id 4242" in seen[1] and r["citations"] == []


def test_missing_document_file_is_404(client):
    from pathlib import Path
    sid = make_supplier(client)
    doc = client.post(f"/api/suppliers/{sid}/documents", files=[("files", ("a.pdf", PDF, "application/pdf"))]).json()[0]
    from app import db as dbmod
    from app.models import Document
    with dbmod.SessionLocal() as db:
        Path(db.get(Document, doc["id"]).storage_path).unlink()
    r = client.get(f"/api/documents/{doc['id']}/file")
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"


def test_dashboard_counts_all_open_actions_not_just_the_listed_8(client):
    from app import db as dbmod
    from app.models import Action, Supplier
    with dbmod.SessionLocal() as db:
        sup = Supplier(name="Many Actions GmbH", name_key="many actions gmbh", country="DE")
        db.add(sup)
        db.flush()
        db.add_all(Action(supplier_id=sup.id, template_key=f"k{i}", title=f"Action {i}", rationale="r",
                          priority="high" if i < 4 else "low", status="approved" if i == 0 else "proposed")
                   for i in range(11))
        db.add(Action(supplier_id=sup.id, template_key="done", title="Done", rationale="r", priority="high", status="done"))
        db.commit()
    d = client.get("/api/dashboard").json()
    assert len(d["open_actions"]) == 8
    assert d["totals"]["open_actions"] == 11 and d["totals"]["open_high_priority"] == 4
