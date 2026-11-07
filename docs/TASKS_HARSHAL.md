# Harshal — Backend + AI

You own `backend/` (except `backend/app/api/voice.py`, which is Pranam's). Read `docs/CONTRACT.md` first. API shapes in §4 are
exact, because Pranam's frontend is built against them. Work top to bottom and tick `[x]` here when a task is done. After each task:
`uv run pytest -q`, then commit, `git pull --rebase`, `git push`. Check the current Anthropic and Exa SDK docs before calling them.

Layout:
```
backend/
  pyproject.toml          # uv: fastapi, uvicorn[standard], sqlalchemy, pydantic-settings, python-multipart,
                          #     pymupdf, anthropic, exa-py, httpx, rapidfuzz ; dev: pytest
  app/main.py             # app, CORS (CORS_ORIGINS), routers, error handler, create_all on startup
  app/config.py  app/db.py  app/models.py  app/schemas.py  app/llm.py
  app/api/{suppliers,documents,analysis,dashboard,assistant}.py   (+ voice.py by Pranam)
  app/services/{extraction,research,risk_engine,actions,analysis,assistant}.py
  tests/test_risk_engine.py  tests/test_pipeline.py
  data/                   # app.db + uploads/ (git-ignored)
```

## Tasks

- [ ] **H1. Skeleton (≤ 30 min)**: pyproject via `uv init`/`uv add`. `config.py` (pydantic-settings reading `backend/.env`).
  `db.py`: SQLite engine at `data/app.db`, `check_same_thread=False`, enable WAL. Session dependency. All models from CONTRACT §3.
  `main.py`: CORS, `GET /api/health`, JSON error handler producing `{"error":{"code","message"}}`, `create_all` on startup, and on
  startup mark runs still `running`/`queued` as `failed` (`"interrupted"`). Run: `uv run uvicorn app.main:app --reload --port 8000`.

- [ ] **H2. Suppliers**: `GET/POST /api/suppliers`, `GET /api/suppliers/{id}` exactly per CONTRACT §4 (summary fields come from the latest
  assessment; `missing_documents` per §5.3). Validate: name 1..200, country 2 uppercase letters. Duplicate name → 409.

- [ ] **H3. Upload + text**: `POST /api/suppliers/{id}/documents`: max 10 files, each ≤ `MAX_UPLOAD_MB`, must start with `%PDF-` (else 415),
  saved as `data/uploads/{doc_id}.pdf`. doc_type from filename (`financ|annual|bilanz` → financial_report, `iso|cert|iatf` → certification,
  `deliver|otd|performance|quality` → delivery_report, `contract|vertrag|agreement` → contract, else other).
  `GET /api/documents/{id}/file` serves the PDF inline.
  `services/extraction.extract_pages(path) -> list[(page_no, text)]` with PyMuPDF, ≤ 100 pages. No text → doc failed:
  "No extractable text (scanned PDF?)". Store one `chunks` row per page (split pages > 4000 chars).

- [ ] **H4. LLM wrapper** `app/llm.py`: `structured(system, user, schema: type[BaseModel], model=None) -> BaseModel` using Claude with a
  forced tool call whose `input_schema` is the Pydantic JSON schema. Validate and retry once with the error. Plus `text(system, user, model=None) -> str`.
  Timeout 60 s, retry on 429/5xx (2 attempts). Log token usage.

- [ ] **H5. Structured extraction**: `extraction.extract_facts(pages) -> DocumentExtraction` (CONTRACT §5.1). Document text in
  `<untrusted_document>` with `[page N]` markers. **Drop any field whose quote isn't verbatim in its page** (normalise whitespace/case).
  Save to `documents.extracted`, update `doc_type`, status processed.

- [ ] **H6. Risk engine + tests (most important code)**: pure functions in `risk_engine.py`:
  `build_indicators(supplier, extractions, signals, today) -> list[IndicatorDraft]` (each with `Evidence` list: quote + doc id + page,
  or signal url/excerpt, or "Country reference table v1"; `Evidence.id = secrets.token_hex(4)`), and `score(indicators) -> AssessmentDraft`
  exactly per §5.2–5.3. `tests/test_risk_engine.py` table-driven: rule boundaries (on-time 84.9/85/95, cert expired/89/91 days),
  no indicators → insufficient_data + overall null, only external → insufficient_data, unverified insolvency averaged vs source_confirmed
  not averaged, rejected signal ignored, missing ISO 9001 → 60, classification 30/31/60/61, weights sum to 1.

- [ ] **H7. Exa research** `services/research.py`: `research(db, supplier) -> list[ExternalSignal]`. 2 Exa searches with text contents,
  last 18 months, 5 results each: `"<name>" insolvency OR restructuring OR layoffs OR plant closure OR recall` and `"<name>" <country> news`
  (+ `include_domains`/site if website known, only as a third query). Drop results whose text doesn't contain the supplier name.
  Classify **all remaining results in one** `llm.structured(..., model=LLM_MODEL_FAST)` call → per result `{signal_type, claim, excerpt, relevance}`.
  Drop `other_irrelevant`, relevance < 0.5, or an excerpt not found in the result text. `source_confirmed` if the excerpt and the name are both
  in the text, else `unverified`. Upsert on (supplier_id, url). Exa failure raises, and the pipeline marks the step failed.

- [ ] **H8. Pipeline + actions**: `POST /api/suppliers/{id}/analyze` creates a run (or returns the active one) and starts
  `services/analysis.run(run_id)` via BackgroundTasks (opens its own DB session). Steps per §5.5, each step's status saved + committed
  as it goes. `services/actions.py` implements §5.4. Summary via `llm.text`, labelled AI in UI. Endpoints: `GET /api/runs/{id}`,
  `/risk`, `/signals`, `/actions`, `PATCH /api/actions/{id}`, `GET /api/dashboard`.
  `tests/test_pipeline.py`: fake `llm` + fake Exa (monkeypatch), upload a tiny generated PDF, analyze → run succeeded, assessment has indicators
  with evidence; Exa raising → step failed but run succeeded.
  **⏱ T+3:30: tell Pranam the real API is live.** Run it on Pranam's demo PDFs (`demo-data/`) and check the scores look sensible.

- [ ] **H9. Assistant**: `POST /api/assistant/query` per CONTRACT §6. Tools are thin wrappers over existing queries. Tool results include
  evidence ids. Keep only citations whose id was returned by a tool this turn. Max 5 rounds, 45 s. Simple per-IP limit 20/min
  (`# shortcut: in-process limiter`). Test with a scripted fake client: a valid citation is kept, a hallucinated id is dropped,
  `propose_action` creates a proposed action. Then try the CONCEPT §3.5 questions with the real key on demo data and tune the prompt.

- [ ] **H10. Voice router**: once Pranam pushes `app/api/voice.py`, add `app.include_router(voice.router)` in `main.py`.

- [ ] **H11. (T+5:00–6:00) Hardening for demo**: full demo flow 3× from an empty DB, fix whatever breaks. Write `backend/README.md`
  (run commands, env vars). Optional only if the hackathon requires a URL: deploy backend to Railway (Dockerfile or Nixpacks, volume on `data/`).

**Skip:** auth, multi-tenancy, migrations, Celery/Redis, embeddings, Word/Excel parsing, alerts, history UI, compare endpoint.
