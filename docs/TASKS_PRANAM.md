# Pranam — Frontend + Voice + Demo

You own `frontend/`, `demo-data/`, `scripts/`, `backend/app/api/voice.py`, `docs/DEMO_SCRIPT.md` and the pitch deck. Read
`docs/CONTRACT.md` first. Build against **mock data** in the exact §4 shapes until Harshal says the API is live (≈ T+3:30), then
set `NEXT_PUBLIC_API_MOCK=0`. Work top to bottom and tick `[x]` here when a task is done. After each task: `pnpm lint && pnpm build`,
then follow the branch → PR → merge workflow in `CLAUDE.md` §3. Check the current Next.js 16, shadcn/ui and ElevenLabs docs before using them.

Design: premium B2B, navy + white (CONCEPT §10), clean and data-rich. Risk colours: low green, medium amber, high red,
**not assessed / insufficient data = grey with dashed border, never green**. Labels: "AI-generated" on summaries,
"Synthetic demo data" badge on synthetic suppliers, footer "Risk assessments are based on available evidence, not financial or legal advice."

Layout:
```
frontend/
  app/layout.tsx (sidebar: Dashboard, Suppliers, Assistant)  app/page.tsx (→ /dashboard)
  app/dashboard/page.tsx  app/suppliers/page.tsx  app/suppliers/[id]/page.tsx  app/assistant/page.tsx
  components/{risk,suppliers,voice}/…   lib/types.ts  lib/api.ts  lib/mocks.ts
```

## Tasks

- [x] **P1. Scaffold (≤ 30 min)**: `pnpm create next-app frontend` (TS, App Router, Tailwind, ESLint), `shadcn init` + components (button, card,
  badge, table, dialog, input, select, tabs, progress, sonner, skeleton, tooltip), recharts, lucide-react. Copy CONTRACT §4 TS types into
  `lib/types.ts`. `lib/api.ts`: `api<T>(path, init?)` → base `NEXT_PUBLIC_API_URL`, throws `{status, code, message}` from the error shape,
  and when `NEXT_PUBLIC_API_MOCK=1` returns data from `lib/mocks.ts`. Mocks: 6 suppliers covering low/medium/high/insufficient_data/never analysed,
  one full `RiskAssessment` (one category not assessed), signals, actions, dashboard, an `AssistantAnswer` with 2 citations, and a run whose steps
  advance on each poll. Sidebar layout.

- [ ] **P2. Dashboard** `/dashboard`: KPI cards (total, high, medium, low, not assessed), risk distribution donut (Recharts), top-5 risk table
  (click → supplier), expiring/expired certifications (red if expired), open actions with Approve/Reject buttons (PATCH). Empty state with "Add supplier".

- [ ] **P3. Suppliers** `/suppliers`: table (name + synthetic badge, country, category, criticality, risk badge + score, confidence bar, docs,
  last assessed). Search box (client-side filter). "Add supplier" dialog (name, country ISO-2, website, category, criticality). 409 → inline error.

- [ ] **P4. Supplier detail** `/suppliers/[id]`: header with name, badges, large score gauge (0–100, coloured), classification, confidence +
  coverage ("Based on 3 of 5 risk categories"), **Analyze** button.
  - **Documents card:** drag-and-drop + picker (PDF only, ≤ 20 MB, ≤ 10), document list with status chip/error, "missing documents" callout.
    After upload, auto-start analysis.
  - **Analysis stepper:** polls `GET /api/runs/{id}` every 2 s until done (resume from `latest_run` on page load). Shows the 4 steps;
    a failed external_research shows "Web research unavailable, score based on documents only". On finish, reload risk, signals and actions.
  - **Risk breakdown:** 5 category cards (score, weight, confidence, or "Not assessed, no evidence"), AI summary (labelled), indicators grouped
    by category: label, value, severity bar, basis chip ("From document" / "Web signal · unverified" / "AI interpretation" / "Reference data"),
    expandable evidence: excerpt in quotes + "Page N" link to `/api/documents/{id}/file#page=N` or source URL + date.
  - **Web signals:** cards with title, domain, date, claim, excerpt, verification chip, link.
  - **Action plan:** list with priority, rationale, Approve / Reject / Done.
  - "Ask the assistant about this supplier" button → `/assistant?supplier_id=…`.

- [ ] **P5. Demo data** (do this while waiting on the API, ≈ T+2:00): `scripts/make_demo_docs.py` (run with `uv run --with fpdf2 python scripts/make_demo_docs.py`.
  PDF libs aren't backend deps: the backend uses pypdf for reading) uses fpdf2 to write PDFs to `demo-data/`. Every page has the footer "SYNTHETIC DEMO DATA, NOT A REAL COMPANY". 4 fictional suppliers, e.g.
  - "Alpha Präzisionsteile GmbH": **high**: net loss, revenue −25%, equity ratio 8%, on-time 78%, ISO 9001 expired 2 months ago, criticality high.
  - "Beta Kunststofftechnik GmbH": **medium**: revenue −10%, current ratio 1.2, on-time 91%, ISO 9001 expiring in 30 days.
  - "Gamma Elektronik AG": **low**: healthy financials, on-time 98%, 120 ppm, valid ISO 9001 + IATF 16949.
  - "Delta Logistik GmbH": only a contract with a single-source clause (shows "insufficient data" honestly).
  Write numbers as plain sentences/tables so extraction is easy ("On-time delivery rate: 78.0 %"). Commit the PDFs.
  Then `scripts/seed_demo.py --api http://localhost:8000`: creates the suppliers (`is_synthetic: true`) via the API, uploads PDFs, triggers analyze,
  waits. Re-runnable (skips existing names).

- [ ] **P6. Voice backend** `backend/app/api/voice.py` (`router = APIRouter(prefix="/api/voice")`): `POST /transcribe` (multipart `audio`, ≤ 10 MB,
  mime whitelist) → ElevenLabs Speech-to-Text → `{text}`; `POST /speak` (`{text}` ≤ 2000) → ElevenLabs Text-to-Speech → `StreamingResponse(audio/mpeg)`.
  Use `httpx`, key/voice/models from `app.config.settings` (`elevenlabs_api_key`, `elevenlabs_voice_id`, `elevenlabs_tts_model`, `elevenlabs_stt_model` already exist). Rate-limit with `from app.api.assistant import rate_limit` (`dependencies=[Depends(rate_limit)]`). Raise `app.errors.ProviderError(msg)` for provider failures. Router is auto-registered. Provider error → 502
  `{"error":{"code":"provider_error",...}}`. **Look up current endpoint paths and model IDs in the ElevenLabs docs.** Tell Harshal to register the router.

- [ ] **P7. Assistant page** `/assistant`: chat (messages, citation chips under each answer; click chip → popover with excerpt + page/URL link),
  text input always available, optional supplier picker (preselected from `?supplier_id`), suggested question chips (from CONCEPT §3.5).
  Sends `history` (last 6 turns). `proposed_actions` render as cards with Approve/Reject.
  **Push-to-talk** (`components/voice/PushToTalk.tsx`): click to start/stop (max 60 s, timer + pulsing mic), MediaRecorder (`audio/webm;codecs=opus`,
  fallback `audio/mp4`) → `/api/voice/transcribe` → show transcript → `/api/assistant/query` → show answer → `/api/voice/speak` → play.
  Visible state: Listening… / Transcribing… / Thinking… / Speaking… (with Stop). Mic denied → toast + text fallback. `aria-live` on status.

- [ ] **P8. Switch to real API (⏱ T+3:30)**: `NEXT_PUBLIC_API_MOCK=0`, run `seed_demo.py`, click through every page, fix mismatches (if the
  backend deviates from CONTRACT, tell Harshal; don't work around it silently).

- [ ] **P9. (T+5:00–6:00) Demo + pitch**: `docs/DEMO_SCRIPT.md` with the CONCEPT §12 10-step flow: exact clicks, the 3 voice questions to ask
  ("Which supplier has the highest risk and why?", "What should we do about Alpha?", one in German), expected answers, and a fallback per step
  (pre-seeded data if analysis is slow; typed question if mic fails). 8-slide deck (CONCEPT §14) + 60-second pitch. Record a backup demo video.
  Optional only if a URL is required: deploy frontend to Vercel (root `frontend/`).

**Skip:** login, landing page, settings, analytics page, Excel import, history charts, dark mode.
