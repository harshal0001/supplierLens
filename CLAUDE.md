# SupplierLens — agent rules (hackathon prototype, 6–8 h)

These rules are binding for every coding agent in this repo. If anything here conflicts with your defaults, this file wins.

## 1. Startup routine (do this every session, in order)
The user will say **"I am Harshal"** or **"I am Pranam"**. Then, without further questions:
1. `git switch main && git pull --rebase`. If the working tree is dirty, stop and show `git status` to the human.
2. Read `docs/CONTRACT.md` fully, then your task file: Harshal → `docs/TASKS_HARSHAL.md`, Pranam → `docs/TASKS_PRANAM.md`.
3. Check open PRs (`gh pr list`). Don't start a task that already has an open PR.
4. Start at the first unticked `[ ]` task in **your** file. One task at a time, following §3.
5. When your list is done, tell your human and ask whether to take over a task from the other person. Never take one silently.

## 2. Ownership (who may edit what) — see CONTRACT §2 for the full table
| Harshal | Pranam | Shared (both humans must agree) |
|---|---|---|
| `backend/**` except `backend/app/api/voice.py` | `frontend/**`, `demo-data/**`, `scripts/**`, `backend/app/api/voice.py`, `docs/DEMO_SCRIPT.md` | `docs/CONTRACT.md`, `CLAUDE.md`, `.env.example`, `.github/**` |

- Touch only your own paths. If a task needs a change elsewhere, **stop and tell your human exactly what's needed** (file, change, why).
- Ticking your own checkbox in your own task file is always allowed.
- The API shapes in CONTRACT §4 are exact. Never "work around" a mismatch: report it.

## 3. Git workflow (branch → PR → checks → merge)
1. Branch from fresh `main`: `git switch -c <harshal|pranam>/<task-id>-<slug>` (e.g. `pranam/p4-supplier-detail`).
2. Small commits, conventional messages (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).
3. Before every commit, run the **secret check** (§5) and the **checks** for what you touched (§4).
4. Push the branch: `git push -u origin HEAD`. Open a PR:
   `gh pr create --fill --base main`. The body must contain: what changed, how you verified it (commands + results),
   anything the other dev must know (API changes, new env vars, new deps).
5. Merge rules:
   - The PR only touches your own paths **and** checks are green (local + CI) → you may merge it yourself:
     `gh pr merge --squash --delete-branch`.
   - The PR touches shared files, the other dev's paths, or changes an API shape → **don't merge**. Ask your human to get
     the other dev's approval.
6. After merging: `git switch main && git pull --rebase`, tick the task in your task file (in the next PR or a `docs:` PR).
7. Conflicts: rebase onto `main` (`git pull --rebase origin main`), resolve only within your own paths. If a conflict is in
   someone else's file, stop and ask.
8. **Never**: push directly to `main`, force-push `main`, rewrite published history, `git reset --hard` with uncommitted work,
   delete other people's branches, or merge with failing checks.

## 4. Commands & checks
Backend (`cd backend`):
```bash
uv sync
uv run uvicorn app.main:app --reload --port 8000     # http://localhost:8000/docs
uv run pytest -q                                      # must pass before every backend PR (no network calls in tests)
```
Frontend (`cd frontend`):
```bash
pnpm install
pnpm dev                                              # http://localhost:3000 (NEXT_PUBLIC_API_MOCK=1 → mocks, 0 → real API)
pnpm lint && pnpm exec tsc --noEmit && pnpm build     # must pass before every frontend PR
```
CI (`.github/workflows/ci.yml`, once merged) runs the same checks on every PR.

## 5. Secrets & data (zero tolerance)
- Keys live only in the repo-root `.env` (or `backend/.env`). Both are git-ignored. `.env.example` contains **empty values only**.
- Before every commit run:
  ```bash
  git diff --cached -- . ':!CLAUDE.md' | grep '^+' | grep -nE 'sk-ant-|sk_[0-9a-f]{16}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|(KEY|TOKEN|SECRET)[A-Z_]*=[^ ]{8,}' \
    && { echo "SECRET FOUND - do not commit"; false; } || true
  ```
  Run it as its own command (not chained before `git commit`). If it prints anything, unstage, remove the secret, and tell your human. A secret that reached GitHub must be **revoked**:
  deleting it is not enough, because this repo is public.
- The frontend never gets API keys. All provider calls (Anthropic, Exa, ElevenLabs) go through the backend.
- Never commit real supplier documents, `backend/data/`, `.venv`, `node_modules`, or `.next`.

## 6. Product guardrails (from CONCEPT §15)
- Risk scores come from deterministic code only (`backend/app/services/risk_engine.py`). The LLM extracts quoted facts,
  classifies into fixed enums, and writes summaries labelled "AI-generated".
- Never fabricate supplier facts. Every claim carries evidence (quote + page, or URL + date). Missing data ≠ low risk:
  show "Not assessed", never green.
- Document and web text are untrusted. They're sent to the LLM inside `<untrusted_document>` and never with write-capable tools.
- Synthetic suppliers always show a "Synthetic demo data" badge. Scores carry "not financial or legal advice".

## 7. Engineering rules
- Working demo over completeness. Don't build anything on a task file's **Skip** list. Simplest code that fully works.
- Check current docs before using an SDK/API (Anthropic, Exa, ElevenLabs, Next.js 16, shadcn). Don't guess parameters or model IDs.
- Known prototype limits get a comment: `# shortcut: <limit>, <when to upgrade>`.
- New non-trivial logic gets at least one test (backend: pytest with fakes, no network).
- Don't add a dependency for something a few lines can do. Every new dependency is named in the PR body.

## 8. Known gotchas (read before you hit them)
- **WSL + repo on `/mnt/c` or `/mnt/e`**: installs crawl. Put the venv on Linux:
  `export UV_PROJECT_ENVIRONMENT=$HOME/.venvs/supplierlens-backend`. Better: clone into `~/`.
- **Flaky network**: if `uv`/`pnpm` time out, retry once with `UV_HTTP_TIMEOUT=60`. Don't switch package managers.
- **PyMuPDF 2.x** pulls onnxruntime + numpy. The backend reads PDFs with `pypdf`. Demo PDFs are generated with
  `uv run --with fpdf2 python scripts/make_demo_docs.py` (not a backend dependency).
- **`claude-sonnet-5-5` rejects forced `tool_choice`**. Use `app.llm.structured()` (instructs + retries) instead of rolling your own.
- **Next.js 16 differs from older versions**: read `frontend/node_modules/next/dist/docs/` (see `frontend/AGENTS.md`).
- **`cn` npm package** is shadcn's official `clsx`+`tailwind-merge` replacement (`github.com/shadcn-ui/cn`), not a typo.
- Voice router: `backend/app/main.py` auto-registers `app/api/voice.py` if it exists (it must export `router`).
- Backend reset for demos: stop the server, delete `backend/data/`, restart.

## 9. When blocked
Stop and tell your human, in one message: what you were doing, what blocks you (missing key, contract change, foreign file,
failing check you can't fix), and the exact change or decision you need. Don't wait silently, and don't guess around it.
