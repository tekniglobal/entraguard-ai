# EntraGuard AI

**Agentic Identity Threat Investigator for Microsoft Entra ID.**

Detect, explain, and respond to identity threats using AI-powered Zero Trust analysis.

EntraGuard AI ingests Microsoft Graph sign-in logs (interactive + non-interactive),
reasons about each event with an LLM, proposes specific Entra remediations, and
routes them through a Teams-styled approval card for a human to review. Every
action — agent, human, or system — is captured in an append-only audit log.

## Stack

- **Next.js 15** (App Router, TypeScript, React 19)
- **Supabase** (Postgres + RLS) for sign-ins, investigations, approvals, audit
- **Azure OpenAI** (`gpt-4o`) via the Vercel AI SDK for the reasoning agent
- **Tailwind + shadcn/ui + framer-motion** for the dark "Defender XDR" UI
- **Deploys to Vercel**

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
| `DEMO_OPERATOR_EMAIL` | Whose name appears as the approver in the audit log | Optional |
| `DEMO_USE_CACHE` | Set `false` to force re-run AI on every investigation | Optional |
| `DEMO_FALLBACK_ON_ERROR` | Set `false` to surface Azure errors instead of falling back to heuristics | Optional |

*If Azure OpenAI is not configured (or errors out), EntraGuard AI automatically
falls back to a deterministic heuristic scoring engine in
`src/lib/risk/heuristics.ts`. The demo works either way — the model badge on
the investigation page shows `heuristic-fallback` when AI is unavailable.

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
│   │   ├── investigations/[id]/   # HERO page
│   │   ├── approvals/
│   │   └── audit/
│   └── api/
│       ├── investigate/
│       ├── approvals/[id]/decision/
│       └── demo/reset/
├── components/
│   ├── ui/                   # shadcn primitives
│   ├── teams-adaptive-card.tsx
│   ├── risk-gauge.tsx
│   ├── reasoning-stream.tsx
│   ├── typewriter-reasoning.tsx
│   ├── sign-in-table.tsx
│   ├── app-sidebar.tsx
│   ├── app-header.tsx
│   └── demo-reset-button.tsx
└── lib/
    ├── ai/        # client.ts, prompts.ts, schema.ts, investigate.ts, heuristic-fallback.ts
    ├── db/        # types.ts, queries.ts
    ├── graph/     # types.ts
    ├── remediation/simulators.ts
    ├── risk/      # heuristics.ts, baseline.ts
    └── supabase/  # server.ts, browser.ts, admin.ts

fixtures/          # users.json, sign_ins.json
scripts/           # seed.ts
supabase/migrations/20260605000000_init.sql
```

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import into Vercel.
3. Add the env vars listed above in Project Settings → Environment Variables (Production + Preview).
4. Deploy. The Supabase migration is already applied to the linked project.
5. First time only: hit `POST /api/demo/reset` against the deployed URL to seed fixtures.
