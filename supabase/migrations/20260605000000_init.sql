-- EntraGuard AI initial schema
-- Tables: users, sign_ins, investigations, recommended_actions, approvals, audit_log

create extension if not exists "pgcrypto";

-- ============================================================
-- USERS
-- ============================================================
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  upn text not null unique,
  display_name text not null,
  job_title text,
  department text,
  is_privileged boolean not null default false,
  privileged_role text,
  usual_country text,
  usual_city text,
  usual_device_os text,
  usual_hours_start int,
  usual_hours_end int,
  created_at timestamptz not null default now()
);

create index if not exists users_upn_idx on public.users (upn);

-- ============================================================
-- SIGN-INS
-- ============================================================
create table if not exists public.sign_ins (
  id uuid primary key default gen_random_uuid(),
  graph_id text not null unique,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at_event timestamptz not null,
  is_interactive boolean not null,
  ip_address text,
  country text,
  city text,
  is_tor_or_anon boolean not null default false,
  client_app text,
  device_os text,
  device_browser text,
  is_compliant_device boolean,
  is_managed_device boolean,
  mfa_detail text,
  conditional_access_status text,
  risk_level_aggregated text,
  risk_state text,
  resource_display_name text,
  application_display_name text,
  status_code int,
  status_failure_reason text,
  raw_json jsonb not null,
  ingested_at timestamptz not null default now()
);

create index if not exists sign_ins_user_idx on public.sign_ins (user_id);
create index if not exists sign_ins_event_time_idx on public.sign_ins (created_at_event desc);
create index if not exists sign_ins_interactive_idx on public.sign_ins (is_interactive);

-- ============================================================
-- INVESTIGATIONS
-- ============================================================
create table if not exists public.investigations (
  id uuid primary key default gen_random_uuid(),
  sign_in_id uuid not null references public.sign_ins(id) on delete cascade,
  risk_score int not null check (risk_score between 0 and 100),
  verdict text not null check (verdict in ('benign','suspicious','malicious')),
  summary text not null,
  reasoning text not null,
  signals jsonb not null default '[]'::jsonb,
  citations jsonb not null default '[]'::jsonb,
  phase_timings jsonb not null default '[]'::jsonb,
  knowledge_source text,  -- 'foundry-iq' | 'bundled-fallback' | null
  model text not null,
  prompt_tokens int,
  completion_tokens int,
  latency_ms int,
  cached boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists investigations_sign_in_idx on public.investigations (sign_in_id);
create index if not exists investigations_score_idx on public.investigations (risk_score desc);

-- ============================================================
-- RECOMMENDED ACTIONS
-- ============================================================
create table if not exists public.recommended_actions (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  action_type text not null check (action_type in (
    'force_password_reset',
    'require_mfa',
    'disable_account',
    'revoke_sessions',
    'review_privileged_activity',
    'notify_user',
    'no_action'
  )),
  rationale text not null,
  severity text not null check (severity in ('low','medium','high','critical')),
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists recommended_actions_inv_idx on public.recommended_actions (investigation_id);

-- ============================================================
-- APPROVALS
-- ============================================================
create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.recommended_actions(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected','executed','failed')),
  decided_by text,
  decided_at timestamptz,
  decision_reason text,
  executed_at timestamptz,
  execution_result jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists approvals_action_idx on public.approvals (action_id);
create index if not exists approvals_status_idx on public.approvals (status);

-- ============================================================
-- AUDIT LOG
-- ============================================================
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  actor_kind text not null check (actor_kind in ('agent','human','system')),
  event_type text not null,
  subject_kind text,
  subject_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_subject_idx on public.audit_log (subject_kind, subject_id);

-- ============================================================
-- RLS: enabled with open policies (hackathon, no real auth)
-- ============================================================
alter table public.users enable row level security;
alter table public.sign_ins enable row level security;
alter table public.investigations enable row level security;
alter table public.recommended_actions enable row level security;
alter table public.approvals enable row level security;
alter table public.audit_log enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'users' and policyname = 'open all') then
    create policy "open all" on public.users for all to anon, authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'sign_ins' and policyname = 'open all') then
    create policy "open all" on public.sign_ins for all to anon, authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'investigations' and policyname = 'open all') then
    create policy "open all" on public.investigations for all to anon, authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'recommended_actions' and policyname = 'open all') then
    create policy "open all" on public.recommended_actions for all to anon, authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'approvals' and policyname = 'open all') then
    create policy "open all" on public.approvals for all to anon, authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'audit_log' and policyname = 'open all') then
    create policy "open all" on public.audit_log for all to anon, authenticated using (true) with check (true);
  end if;
end $$;
