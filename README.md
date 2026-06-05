# EntraGuard AI

**Agentic Identity Threat Investigator for Microsoft Entra ID.**

Detect, explain, and respond to identity threats using AI-powered Zero Trust analysis, grounded in authoritative Microsoft and MITRE knowledge via Foundry IQ.

EntraGuard AI ingests Microsoft Graph sign-in logs (interactive + non-interactive),
retrieves grounding from Foundry IQ, reasons about each event with an LLM, proposes
specific Entra remediations, and routes them through a Teams-styled approval card
for a human to review. Every action — agent, human, or system — is captured in an
append-only audit log with the cited sources.

> **Submitted to**: Microsoft Agents League Hackathon 2026 — **🧠 Reasoning Agents** track + **💡 Best Use of IQ Tools**.
> Live demo: https://entraguard-ai.vercel.app

---

## 👋 For judges — evaluate in 5 minutes

1. **Open the live demo**: https://entraguard-ai.vercel.app/dashboard
2. **Click "Investigate with EntraGuard AI"** on the priority queue (Priya Shah / Moscow). You'll see the agent run its four-phase pipeline: heuristic signals → Foundry IQ retrieval → LLM reasoning → action synthesis. The reasoning trace panel shows each phase with timings. Citations include real Microsoft Learn, MITRE ATT&CK, and CISA links; the ones the agent grounded its reasoning on are badged "cited by agent" with a why-quote.
3. **Approve one of the Teams Adaptive Cards** ("Disable account"). The simulated Microsoft Graph remediation runs; check `/audit` to see the chronological story (ingest → knowledge retrieval → investigation → human approval → system execution).
4. **Do the contrast**: open the Mark Olsen / Stockholm sign-in (`/sign-ins`) and Investigate. Score in the 20s, verdict benign, no aggressive actions — proves the agent isn't a geo rule engine.

**Key code paths to review:**
- `src/lib/foundry/retrieve.ts` — Foundry IQ client (Azure AI Search agentic-retrieval REST, `api-version=2026-04-01`) with bundled fallback
- `src/lib/risk/heuristics.ts` — deterministic pre-flight signals
- `src/lib/ai/{prompts,schema,investigate}.ts` — Azure OpenAI structured reasoning with Zod
- `src/app/api/investigate/route.ts` — orchestrates the four phases, persists timings + citations
- `src/components/{citation-list,reasoning-trace,teams-adaptive-card}.tsx` — the UI that makes the agentic story visible

### A note on running modes

The Foundry IQ client and the Azure OpenAI client are both real, configurable, and shipped. The public demo runs with **deterministic fallbacks** (a bundled corpus of real Microsoft Learn / MITRE / CISA sources scored against the same signals; a deterministic risk-scoring engine) so the demo costs nothing to run, never breaks on stage, and produces identical-shape output regardless of which path executes. The UI is explicit about which path is in use via labeled badges:

| Badge | Path |
|---|---|
| `Foundry IQ · live` | Real Azure AI Search agentic-retrieval call |
| `Foundry IQ · bundled` | Deterministic scoring over bundled threat-intel sources |
| `gpt-4o` (or similar) | Real Azure OpenAI structured-output call |
| `heuristic-fallback` | Deterministic risk-scoring engine |

To run against live Foundry IQ + Azure OpenAI, set the `FOUNDRY_IQ_*` and `AZURE_OPENAI_*` env vars listed in `.env.local.example`. The request shape (`POST /knowledgebases/{kb}/retrieve?api-version=2026-04-01`) is the documented Azure AI Search agentic-retrieval endpoint that powers Foundry IQ.

The fallbacks are a deliberate **reliability decision** — see the Audit log section in the demo. Every investigation row records `knowledge_source` and `model` so it's auditable which path produced each result.

---

## Stack

- **Next.js 15** (App Router, TypeScript, React 19)
- **Supabase** (Postgres + RLS) for sign-ins, investigations, approvals, audit
- **Azure OpenAI** (`gpt-4o`) via the Vercel AI SDK for the reasoning step
- **Foundry IQ** (Azure AI Search agentic retrieval) for grounding the agent's reasoning in cited, authoritative sources
- **Tailwind + shadcn/ui + framer-motion** for the dark "Defender XDR" UI
- **Deploys to Vercel**

## How the agent reasons (multi-step)

Every investigation runs four phases, surfaced in the UI as a reasoning trace:

1. **Heuristic signals** — deterministic pre-flight (`src/lib/risk/heuristics.ts`) computes the active risk signals: privileged user, unusual geography, off-hours access, unmanaged device, legacy auth, Tor IP, MFA satisfied, etc.
2. **Knowledge retrieval (Foundry IQ)** — `src/lib/foundry/retrieve.ts` builds a natural-language query from the active signals and calls the Foundry IQ knowledge base (Azure AI Search agentic-retrieval endpoint). Returns ranked citations with snippets from Microsoft Learn, MITRE ATT&CK, and CISA advisories.
3. **LLM reasoning** — Azure OpenAI receives the sign-in event, the user's 30-day baseline, the heuristic signals, and the retrieved sources. Returns a structured verdict, score, reasoning, and the subset of sources it actually grounded its conclusion on.
4. **Action synthesis** — the model proposes 0–3 remediation actions from a fixed Microsoft Graph remediation enum (disable account, revoke sessions, force password reset, require MFA, review privileged activity, notify user).

### Why this matters

- Without Foundry IQ, the model's reasoning is opinion; with Foundry IQ, every assertion is traceable to a real Microsoft, MITRE, or CISA document.
- The agent is honest about what it cited: only sources the model explicitly references appear with a "cited by agent" badge in the UI.
- When Foundry IQ isn't configured, the same shape is preserved by scoring a bundled set of real public threat-intel sources — clearly labeled as `Foundry IQ · bundled fallback` so judges can distinguish live retrieval from the deterministic fallback.

## Quick start (local)

```bash
pnpm install
cp .env.local.example .env.local       # fill in values (see below)
pnpm tsx scripts/seed.ts               # load fixtures into Supabase
pnpm dev
```

Open `http://localhost:3000`. The app redirects to `/dashboard`.

### Required environment variables

| Variable | What | Required? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project API URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (RLS is open for the hackathon) | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (optional — only needed if you tighten RLS) | No |
| `AZURE_OPENAI_RESOURCE` | Resource name (subdomain of `openai.azure.com`) | Optional* |
| `AZURE_OPENAI_API_KEY` | API key | Optional* |
| `AZURE_OPENAI_DEPLOYMENT` | Deployment name, default `gpt-4o` | Optional* |
| `AZURE_OPENAI_API_VERSION` | Default `2024-10-21` | Optional |
| `FOUNDRY_IQ_ENDPOINT` | Azure AI Search resource URL hosting your Foundry IQ knowledge base, e.g. `https://my-search.search.windows.net` | Optional† |
| `FOUNDRY_IQ_KNOWLEDGE_BASE` | Knowledge base name | Optional† |
| `FOUNDRY_IQ_API_KEY` | `api-key` for the Azure AI Search endpoint | Optional† |
| `FOUNDRY_IQ_API_VERSION` | Default `2026-04-01` | Optional |
| `DEMO_OPERATOR_EMAIL` | Whose name appears as the approver in the audit log | Optional |
| `DEMO_USE_CACHE` | Set `false` to force re-run AI on every investigation | Optional |
| `DEMO_FALLBACK_ON_ERROR` | Set `false` to surface Azure errors instead of falling back to heuristics | Optional |

*If Azure OpenAI is not configured (or errors out), EntraGuard AI automatically
falls back to a deterministic heuristic scoring engine in
`src/lib/risk/heuristics.ts`. The demo works either way — the model badge on
the investigation page shows `heuristic-fallback` when AI is unavailable.

†If Foundry IQ isn't configured, retrieval falls back to scoring a bundled
set of real public sources in `src/lib/foundry/sources.ts`. The investigation
page shows `Foundry IQ · bundled fallback` so it's clear which path produced
the citations.

## What's in the box

### Pages

- `/dashboard` — KPIs, today's priority queue, "Review today's privileged sign-in activity" hero CTA, recent audit activity
- `/sign-ins` — Filterable table of all sign-in events (Graph shape preserved)
- `/sign-ins/[id]` — Decoded view + raw Microsoft Graph JSON
- `/investigations/[id]` — **The hero page.** Animated risk gauge, AI reasoning with typewriter reveal, Teams-style Adaptive Cards for each recommended action, signal chips, raw Graph response
- `/approvals` — Pending approval queue
- `/audit` — Append-only event log (agent / human / system)

### API routes

- `POST /api/investigate` — Run an AI investigation against a sign-in
- `POST /api/approvals/[id]/decision` — Approve or reject a recommended action; on approve, runs the simulator and writes the audit entry
- `POST /api/demo/reset` — Wipe + reseed fixtures

### Fixture cases

The seed data tells a coherent story across 6 users and 12 sign-ins:

| Case | User | What should happen |
|---|---|---|
| **HERO** Moscow / Tor / unmanaged / MFA bypassed | Priya Shah (Global Admin) | Score ~94, recommend disable + revoke + reset |
| Borderline travel — Stockholm vs Oslo baseline, managed iPhone, MFA OK | Mark Olsen (Exchange Admin) | Score ~25 — benign (proves nuance) |
| Off-hours but otherwise clean — Berlin 02:47 | Lena Fischer | Score ~45 — review/notify |
| Normal control | David Chen | < 10 |
| Normal control | Sara Ahmed | < 10 |
| Legacy non-interactive (POP3) from new geo (Lagos) | svc-reporting | High — flag legacy auth + new geo |
| Baseline history (5 sign-ins over 14d) | — | Populate the "30-day baseline" the AI sees |

## Demo script (~4 minutes)

1. Open `/dashboard`. Point at the KPIs and the priority queue.
2. Click **Review today's privileged sign-in activity**.
3. Investigation page loads: gauge animates to ~94, AI reasoning streams in citing Moscow + Tor + unmanaged + legacy MFA bypass.
4. Three Teams Adaptive Cards fade in: Disable account (critical), Revoke sessions (high), Force password reset (high).
5. Click **Approve** on "Disable account." Card transitions to executing → green checkmark.
6. Navigate to `/audit`. Walk through the chronological story: ingest → investigate → recommend → approve → execute, each with actor + payload.
7. **Bonus contrast**: open the Mark Olsen / Stockholm sign-in and run an investigation. Score lands in the 20s, verdict benign — proves the AI is nuanced, not a geo rule engine.

Between demos: bottom-right **Reset demo** button wipes and reseeds.

## Architecture

```
fixtures/*.json  ──(seed.ts)──▶  Supabase
                                    │
                                    ▼
                  ┌─ heuristics.ts (pre-flight signals)
                  │
                  ▼
              Azure OpenAI ──▶ Investigation + Recommended Actions
              (or heuristic                    │
               fallback)                       ▼
                                       Approvals (pending)
                                                │
                                                ▼ human approves
                                       Simulators (fake Graph PATCH)
                                                │
                                                ▼
                                       Audit log (append-only)
```

## Project layout

```
src/
├── app/
│   ├── (app)/                # sidebar shell
│   │   ├── dashboard/
│   │   ├── sign-ins/
│   │   ├── investigations/[id]/   # HERO page — gauge, reasoning, citations, trace, action cards
│   │   ├── approvals/
│   │   └── audit/
│   └── api/
│       ├── investigate/      # orchestrates the 4-phase reasoning loop
│       ├── approvals/[id]/decision/
│       └── demo/reset/
├── components/
│   ├── ui/                   # shadcn primitives
│   ├── teams-adaptive-card.tsx
│   ├── risk-gauge.tsx
│   ├── reasoning-stream.tsx
│   ├── typewriter-reasoning.tsx
│   ├── citation-list.tsx     # Foundry IQ citations with "cited by agent" highlights
│   ├── reasoning-trace.tsx   # multi-step trace (heuristics → retrieval → LLM → actions)
│   ├── sign-in-table.tsx
│   ├── app-sidebar.tsx
│   ├── app-header.tsx
│   └── demo-reset-button.tsx
└── lib/
    ├── ai/        # client.ts, prompts.ts, schema.ts, investigate.ts, heuristic-fallback.ts
    ├── foundry/   # types.ts, retrieve.ts, sources.ts (Foundry IQ client + bundled fallback)
    ├── db/        # types.ts, queries.ts
    ├── graph/     # types.ts
    ├── remediation/simulators.ts
    ├── risk/      # heuristics.ts, baseline.ts
    └── supabase/  # server.ts, browser.ts, admin.ts

fixtures/          # users.json, sign_ins.json
scripts/           # seed.ts
supabase/migrations/
  20260605000000_init.sql
  20260605120000_foundry_iq.sql
```

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import into Vercel.
3. Add the env vars listed above in Project Settings → Environment Variables (Production + Preview).
4. Deploy. The Supabase migration is already applied to the linked project.
5. First time only: hit `POST /api/demo/reset` against the deployed URL to seed fixtures.
