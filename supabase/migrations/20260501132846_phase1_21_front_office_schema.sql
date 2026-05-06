-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260501132846
-- Name:    phase1_21_front_office_schema
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- phase1_21_front_office_schema
-- Front Office (F1) — schema + 9 tables + 3 helper functions + RLS enable + permissive default policies
-- See deploy doc: ~/Desktop/namkhan-bi/to vercel production /deploy-doc-schema-front-office-arrivals-2026-05-01.md
-- DOWN block: drop schema frontoffice cascade; (idempotent — no production rows pre-ingest)

create extension if not exists citext;

create schema if not exists frontoffice;

-- 1. Arrivals board (denormalised view + per-row enrichment state)
create table if not exists frontoffice.arrivals (
  id                    bigserial primary key,
  cloudbeds_reservation_id text not null,
  property_id           int default 260955,
  arrival_date          date not null,
  arrival_window        text check (arrival_window in ('24h','48h','72h','7d','later')) default 'later',
  expected_eta          time,
  eta_source            text check (eta_source in ('manual','composer_reply','flight','driver','none')) default 'none',
  eta_confidence        numeric(3,2),
  party_size            int,
  stay_nights           int,
  stay_window_start     date,
  stay_window_end       date,
  source                text,
  inquiry_type          text,
  language              text,
  contact_email         citext,
  contact_name          text,
  contact_phone         text,
  tier                  text check (tier in ('vip','rep_champion','rep','first','influencer','press')) default 'first',
  tier_score            numeric(3,2),
  flags_jsonb           jsonb not null default '{}',
  assigned_room         text,
  assigned_room_status  text check (assigned_room_status in ('proposed','confirmed','reassigned','pending')) default 'pending',
  status                text check (status in ('booked','triaged','prearr_composed','prearr_sent','prearr_replied','vip_brief_sent','upsell_composed','upsell_sent','upsell_accepted','upsell_declined','room_assigned','checked_in','no_show','cancelled')) default 'booked',
  triaged_at            timestamptz,
  prearr_sent_at        timestamptz,
  vip_brief_sent_at     timestamptz,
  checked_in_at         timestamptz,
  median_checkin_secs   int,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists ix_fo_arrivals_date_window_score on frontoffice.arrivals (arrival_date, arrival_window, tier_score desc);
create index if not exists ix_fo_arrivals_cb_resv on frontoffice.arrivals (cloudbeds_reservation_id);
create index if not exists ix_fo_arrivals_status on frontoffice.arrivals (status);

-- 2. Pre-arrival messages
create table if not exists frontoffice.prearrival_messages (
  id                bigserial primary key,
  arrival_id        bigint not null references frontoffice.arrivals(id) on delete cascade,
  channel           text not null check (channel in ('email','whatsapp')),
  language          text not null,
  composer_agent    text not null default 'pre_arrival_composer',
  body_html         text,
  body_plain        text not null,
  confidence        numeric(3,2),
  status            text not null default 'draft' check (status in ('draft','approved','sent','replied','bounced','archived')),
  approved_by_user_id uuid,
  approved_at       timestamptz,
  sent_at           timestamptz,
  reply_at          timestamptz,
  reply_body        text,
  reply_extracted_eta time,
  reply_extracted_dietary text[],
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists ix_fo_prearr_arrival_status on frontoffice.prearrival_messages (arrival_id, status);

-- 3. Upsell offers
create table if not exists frontoffice.upsell_offers (
  id                bigserial primary key,
  arrival_id        bigint not null references frontoffice.arrivals(id) on delete cascade,
  upsell_type       text not null check (upsell_type in ('room_up','late_checkout','early_checkin','welcome_dinner','spa','activity','transfer','package','other')),
  composer_agent    text not null default 'upsell_composer',
  body_plain        text not null,
  price_usd         numeric(10,2),
  margin_pct        numeric(5,2),
  margin_floor_pct  numeric(5,2),
  expires_at        timestamptz,
  validator_status  text check (validator_status in ('pass','warn','block','override')),
  validator_reason  text,
  confidence        numeric(3,2),
  status            text not null default 'draft' check (status in ('draft','approved','sent','accepted','declined','no_reply','expired','withdrawn')),
  approved_by_user_id uuid,
  approved_at       timestamptz,
  sent_at           timestamptz,
  outcome           text check (outcome in ('accepted','declined','no_reply','expired')),
  outcome_at        timestamptz,
  outcome_value_usd numeric(10,2),
  cloudbeds_charge_id text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists ix_fo_upsell_arrival_status on frontoffice.upsell_offers (arrival_id, status);
create index if not exists ix_fo_upsell_status_sent on frontoffice.upsell_offers (status, sent_at);

-- 4. VIP / repeat 1-pager
create table if not exists frontoffice.vip_briefs (
  id                bigserial primary key,
  arrival_id        bigint not null references frontoffice.arrivals(id) on delete cascade,
  curator_agent     text not null default 'vip_curator',
  prior_visits      int default 0,
  last_visit_date   date,
  favourite_room    text,
  dietary           text[],
  allergies         text[],
  prior_compliments text,
  prior_issues      text,
  ice_breakers      text,
  welcome_plan      text,
  language          text,
  brief_md          text not null,
  status            text not null default 'draft' check (status in ('draft','approved','handed','acknowledged','archived')),
  approved_by_user_id uuid,
  approved_at       timestamptz,
  handed_at         timestamptz,
  acknowledged_by   text[],
  retention_until   date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 5. ETA tracking
create table if not exists frontoffice.eta_tracking (
  id                bigserial primary key,
  arrival_id        bigint not null references frontoffice.arrivals(id) on delete cascade,
  flight_number     text,
  flight_origin     text,
  flight_status     text check (flight_status in ('scheduled','boarding','in_flight','landed','delayed','cancelled','unknown')),
  flight_landed_at  timestamptz,
  driver_id         text,
  driver_ping_at    timestamptz,
  driver_status     text check (driver_status in ('scheduled','dispatched','en_route','arrived','no_show','unknown')),
  reconciled_eta    timestamptz,
  reconciled_confidence numeric(3,2),
  alerts_jsonb      jsonb default '[]',
  updated_at        timestamptz not null default now()
);
create index if not exists ix_fo_eta_arrival on frontoffice.eta_tracking (arrival_id);

-- 6. Compliance docs
create table if not exists frontoffice.compliance_docs (
  id                bigserial primary key,
  arrival_id        bigint not null references frontoffice.arrivals(id) on delete cascade,
  passport_copy_status text check (passport_copy_status in ('not_required','missing','requested','received','verified')) default 'missing',
  passport_copy_url text,
  immigration_form_status text check (immigration_form_status in ('not_required','missing','prefilled','verified')) default 'missing',
  immigration_form_data jsonb,
  gdpr_consent      boolean default false,
  self_service_link_token text unique,
  self_service_link_sent_at timestamptz,
  self_service_link_used_at timestamptz,
  verifier_agent    text not null default 'compliance_verifier',
  status            text check (status in ('green','amber','red')) default 'red',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists ix_fo_compliance_arrival on frontoffice.compliance_docs (arrival_id);

-- 7. Group arrival plans
create table if not exists frontoffice.group_arrival_plans (
  id                bigserial primary key,
  group_block_code  text not null,
  primary_arrival_date date not null,
  rooms_count       int not null,
  nights            int not null,
  cohesion_map_md   text,
  key_handout_sequence_md text,
  bag_delivery_sequence_md text,
  welcome_fnb_slot  timestamptz,
  briefing_room_slot tstzrange,
  language_coverage_check_jsonb jsonb,
  dependencies_jsonb jsonb default '[]',
  coordinator_agent text not null default 'group_coordinator',
  status            text check (status in ('draft','published','executed','archived')) default 'draft',
  approved_by_user_id uuid,
  approved_at       timestamptz,
  published_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 8. Agent runs audit
create table if not exists frontoffice.agent_runs (
  id                bigserial primary key,
  agent_name        text not null,
  triggered_by      text check (triggered_by in ('schedule','event','manual','fire_all')),
  inputs_summary    text,
  output_summary    text,
  affected_arrivals bigint[],
  tokens_in         int,
  tokens_out        int,
  cost_usd          numeric(10,4),
  duration_ms       int,
  outcome           text check (outcome in ('ok','partial','error','blocked_guardrail')),
  error_msg         text,
  created_at        timestamptz not null default now()
);
create index if not exists ix_fo_agent_runs_agent_time on frontoffice.agent_runs (agent_name, created_at desc);

-- 9. Brand voice
create table if not exists frontoffice.brand_voice (
  id                int primary key default 1,
  voice_md          text not null,
  examples_md       text,
  tone_dos          text[],
  tone_donts        text[],
  occasion_lines    jsonb,
  language_overrides jsonb,
  updated_at        timestamptz not null default now(),
  updated_by        uuid
);
insert into frontoffice.brand_voice (id, voice_md) values
  (1, '-- Seed from sales.brand_voice when /sales schema lands; otherwise enter the canonical Namkhan voice doc here.')
on conflict (id) do nothing;

-- ============================================================
-- Helper functions (stubs; full impl arrives with ingest wiring)
-- ============================================================

-- Refresh arrivals board (stub — returns 0 until wired to cloudbeds.reservations cron)
create or replace function frontoffice.refresh_arrivals_board(p_horizon_days int default 7)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_count int := 0;
begin
  return v_count;
end $$;

-- Decay multiplier for decision-queue ranking
create or replace function frontoffice.arrival_decay(p_arrival_id bigint, p_decision_type text)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when p_decision_type = 'vip_brief' then
      greatest(0, 1 - (extract(epoch from (now() - (select arrival_date::timestamp from frontoffice.arrivals where id = p_arrival_id))) / 86400.0))
    when p_decision_type in ('room_up','late_checkout','welcome_dinner','spa','activity','transfer','package') then
      greatest(0, power(0.75, (extract(epoch from ((select arrival_date::timestamp from frontoffice.arrivals where id = p_arrival_id) - now())) / 86400.0)))
    else 1.0
  end
$$;

-- Tier score helper (stub — returns 0 until composer wiring lands)
create or replace function frontoffice.compute_tier_score(p_arrival_id bigint)
returns numeric
language plpgsql
set search_path = public
as $$
declare v_score numeric := 0;
begin
  return v_score;
end $$;

-- ============================================================
-- RLS — enable on all 9 tables; default permissive policies for portal authenticated reads
-- (matches the pattern used by /sales/inquiries; tighten later when role mapping is in)
-- ============================================================

alter table frontoffice.arrivals             enable row level security;
alter table frontoffice.prearrival_messages  enable row level security;
alter table frontoffice.upsell_offers        enable row level security;
alter table frontoffice.vip_briefs           enable row level security;
alter table frontoffice.eta_tracking         enable row level security;
alter table frontoffice.compliance_docs      enable row level security;
alter table frontoffice.group_arrival_plans  enable row level security;
alter table frontoffice.agent_runs           enable row level security;
alter table frontoffice.brand_voice          enable row level security;

-- Default read policies: portal-authenticated users can read; anon can read aggregates
do $$
declare t text;
begin
  for t in select unnest(array[
    'arrivals','prearrival_messages','upsell_offers','vip_briefs',
    'eta_tracking','compliance_docs','group_arrival_plans','agent_runs','brand_voice'
  ]) loop
    execute format('drop policy if exists %I_read_authenticated on frontoffice.%I', t, t);
    execute format('create policy %I_read_authenticated on frontoffice.%I for select to authenticated using (true)', t, t);
  end loop;
end $$;

-- Anon read on agent_runs (audit transparency) and brand_voice (referenced by composers)
drop policy if exists agent_runs_read_anon on frontoffice.agent_runs;
create policy agent_runs_read_anon on frontoffice.agent_runs for select to anon using (true);

drop policy if exists brand_voice_read_anon on frontoffice.brand_voice;
create policy brand_voice_read_anon on frontoffice.brand_voice for select to anon using (true);

-- Anon read on aggregable tables (so the portal can render KPIs/skeletons without a session)
do $$
declare t text;
begin
  for t in select unnest(array[
    'arrivals','prearrival_messages','upsell_offers','eta_tracking','group_arrival_plans'
  ]) loop
    execute format('drop policy if exists %I_read_anon on frontoffice.%I', t, t);
    execute format('create policy %I_read_anon on frontoffice.%I for select to anon using (true)', t, t);
  end loop;
end $$;

-- vip_briefs and compliance_docs intentionally NOT exposed to anon (PII)
-- write paths come later when role mapping lands; for now no insert/update policies = no writes from anon/authenticated
