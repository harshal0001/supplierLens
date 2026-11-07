# Before the clock starts (Harshal does these, about 20 min)

## 1. API keys (only 3)

| Service | What to do | Env var |
|---|---|---|
| **Anthropic** (console.anthropic.com) | Create key, add ~$20 credit, set a spend limit | `ANTHROPIC_API_KEY` |
| **Exa** (exa.ai) | Create key (free credits are enough) | `EXA_API_KEY` |
| **ElevenLabs** (elevenlabs.io) | Create key with Speech-to-Text + Text-to-Speech access. Voice Library → pick a voice that speaks EN + DE well → copy its **Voice ID** | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` |

Put them in `backend/.env` (copy from `.env.example`). Send the same file to Pranam through a private channel (password manager / direct
message, **never** Git). Only the backend uses keys. The frontend has none.

Not needed for the prototype: OpenAI, Clerk, Postgres, Docker, Redis.

## 2. GitHub
- [ ] Add Pranam as collaborator on `harshal0001/supplierlens` (Settings → Collaborators → Pranam accepts the invite).
- [ ] Push these docs to `main` so both agents see them.

## 3. Each laptop
- [ ] Git, Python 3.12 + [`uv`](https://docs.astral.sh/uv/), Node.js 22 + pnpm (`corepack enable`), your coding agent (Claude Code)
- [ ] Clone the repo, then start the agent **in the repo root** so it reads `CLAUDE.md`
- [ ] WSL users: clone into the Linux home (`~/supplierlens`), not `/mnt/c` or `/mnt/e`. It's much faster
- [ ] Chrome for the demo (mic + MediaRecorder work best there). Allow microphone for `localhost:3000`

## 4. Decide in the first 5 minutes
1. **A real company in the demo?** Our 4 synthetic suppliers have no web presence, so web research finds nothing for them. To show Exa
   working, add one **real public company** live during the demo (only public news, no fake documents). Pick it now and test it once.
2. **Demo on localhost or hosted URL?** Localhost + backup video is safest. Deploy (Vercel + Railway) only if the rules require a link.
3. **Hackathon rules:** check whether a specific stack (e.g. LangGraph) or sponsor tool use is required, and tell your agent if so.
