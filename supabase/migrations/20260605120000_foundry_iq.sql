-- Foundry IQ integration: store retrieved citations + per-phase timings
-- so the investigation UI can show the multi-step reasoning trace and the
-- knowledge sources the agent cited.

alter table public.investigations
  add column if not exists citations jsonb not null default '[]'::jsonb,
  add column if not exists phase_timings jsonb not null default '[]'::jsonb,
  add column if not exists knowledge_source text;

comment on column public.investigations.citations is
  'Array of {title, source, snippet, url, score, anchor_signal} returned by Foundry IQ (or the bundled threat-intel fallback).';
comment on column public.investigations.phase_timings is
  'Array of {phase, started_at, duration_ms, detail} entries describing the agent`s reasoning trace.';
comment on column public.investigations.knowledge_source is
  'foundry-iq | bundled-fallback | null';
