# SupplierLens backend

FastAPI + SQLite + Claude + Exa. API contract: `../docs/CONTRACT.md`.

## Run
```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000     # http://localhost:8000/docs
uv run pytest -q                                      # 40 tests, no network
```
Keys are read from the repo-root `.env` (or `backend/.env`, which overrides it). See `../.env.example`.
Data lives in `backend/data/` (SQLite `app.db` + `uploads/`). Delete the folder to reset the demo.

WSL with the repo on `/mnt/c` or `/mnt/e`: put the venv on the Linux filesystem or installs crawl:
`export UV_PROJECT_ENVIRONMENT=$HOME/.venvs/supplierlens-backend`.

## How it works
- `POST /api/suppliers/{id}/analyze` starts a background run: **process_documents** (pypdf text → page chunks →
  Claude extracts facts, each with a verbatim quote that is checked against the PDF, so unverifiable facts are dropped) →
  **external_research** (Exa → Claude Haiku classifies into fixed signal types, excerpt must be in the source) →
  **score** (`services/risk_engine.py`, deterministic rules + formula from CONTRACT §5) → **recommend** (rule-based
  action plan + labelled AI summary). Web research failing doesn't fail the run.
- `POST /api/assistant/query`: Claude tool-use loop over read-only tools (`services/assistant.py`). Only evidence ids
  actually returned by tools are kept as citations.

## Prototype shortcuts
No auth/tenancy · SQLite · in-process background tasks (a restart marks runs as failed) · keyword document search ·
per-process rate limit (20/min/IP on the assistant). Each one is marked `shortcut:` in the code.
