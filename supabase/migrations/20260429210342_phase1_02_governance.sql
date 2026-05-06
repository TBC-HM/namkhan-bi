-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260429210342
-- Name:    phase1_02_governance
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- =====================================================================
-- Phase 1.2 — `governance` schema
-- Agents, mandates, proposals, consent, authority limits, breaches
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS governance;
COMMENT ON SCHEMA governance IS 'Agent registry, mandates, proposals/consent flow, authority limits';

-- ---------------------------------------------------------------------
-- 1. AGENTS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS governance.agents (
  agent_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id        bigint REFERENCES public.hotels(property_id),
  code               text UNIQUE NOT NULL,                 -- snapshot_agent | pricing_agent | review_agent | etc.
  name               text NOT NULL,
  pillar             text CHECK (pillar IN ('revenue','operations','guest','finance','knowledge','meta')),
  description        text,
  service_user_id    uuid REFERENCES auth.users(id),       -- agent's identity for audit
  status             text DEFAULT 'planned' CHECK (status IN ('planned','beta','active','paused','retired')),
  schedule_cron      text,                                  -- e.g. */15 * * * *
  schedule_human     text,                                  -- "every 15 min", "every 6h"
  model_id           text,                                  -- gemini-2.0-flash | claude-3-5-sonnet | etc.
  prompt_version     text,
  config             jsonb DEFAULT '{}'::jsonb,
  last_run_at        timestamptz,
  last_success_at    timestamptz,
  last_error         text,
  avg_confidence     numeric,
  total_runs         int DEFAULT 0,
  total_proposals    int DEFAULT 0,
  approved_proposals int DEFAULT 0,
  net_value_modeled  numeric DEFAULT 0,
  net_value_actual   numeric DEFAULT 0,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agents_status ON governance.agents(status);

-- Seed 24 agents from the v9 mockup. status reflects what's actually live.
INSERT INTO governance.agents (code, name, pillar, status, schedule_human, description) VALUES
  -- Revenue
  ('snapshot_agent',   'Snapshot Agent',   'revenue',    'active', 'every 15 min', 'Daily house snapshot: arrivals, departures, in-house, open folios'),
  ('pricing_agent',    'Pricing Agent',    'revenue',    'active', 'every 15 min', 'Rate parity, OTA undercut detection, modeled rate moves'),
  ('forecast_agent',   'Forecast Agent',   'revenue',    'active', 'every 6h',     '14/30/90-day pickup forecast vs LY and budget'),
  ('lead_scoring_agent','Lead Scoring Agent','revenue',  'active', 'on email',     'Triages book@ inbox, scores leads, drafts proposals in Cloudbeds'),
  ('compset_agent',    'Comp Set Agent',   'revenue',    'planned','daily',        'Competitor rate scrape and benchmarking'),
  ('channel_agent',    'Channel Agent',    'revenue',    'planned','every 6h',     'Channel mix optimization vs commission cost'),
  ('marketing_agent',  'Autoblog Agent',   'revenue',    'planned','weekly',       'Marketing content draft, social posts, SEO'),
  -- Operations
  ('inventory_agent',  'Inventory Agent',  'operations', 'planned','daily',        'F&B receiving, par levels, low stock'),
  ('food_cost_agent',  'Food Cost Agent',  'operations', 'planned','daily',        'Recipe vs theoretical cost vs actual'),
  ('menu_agent',       'Menu Agent',       'operations', 'planned','weekly',       'Allergen, pricing, mix engineering'),
  ('maintenance_agent','Maintenance Agent','operations', 'planned','daily',        'Preventive schedule, ticket triage'),
  ('housekeeping_agent','Housekeeping Agent','operations','planned','daily',       'Room status, QA scoring, supply usage'),
  ('recruiting_agent', 'Recruiting Agent', 'operations', 'planned','weekly',       'Job descriptions, candidate sourcing'),
  ('rota_agent',       'Rota Agent',       'operations', 'planned','weekly',       'Shift planning, gap detection'),
  -- Guest
  ('review_agent',     'Review Agent',     'guest',      'active', 'on review',    'Drafts replies within tone & comp authority'),
  ('recovery_agent',   'Recovery Agent',   'guest',      'planned','on complaint', 'Service recovery flow, comp gestures'),
  ('concierge_agent',  'Concierge Agent',  'guest',      'planned','on arrival',   'Pre-arrival, in-stay touchpoints'),
  ('nps_agent',        'NPS Agent',        'guest',      'planned','daily',        'NPS dispatch + driver analysis'),
  -- Finance
  ('variance_agent',   'Variance Agent',   'finance',    'active', 'daily',        'Reconciliation: PMS vs POS vs bank, unallocated lines'),
  ('cashflow_agent',   'Cashflow Agent',   'finance',    'active', 'daily',        '13-week rolling cashflow forecast'),
  ('usali_reporter',   'USALI Reporter',   'finance',    'planned','monthly',      'Month-end USALI 11th edition pack'),
  ('payroll_agent',    'Payroll Agent',    'finance',    'planned','monthly',      'Payroll prep, gratuity allocation'),
  -- Knowledge / Meta
  ('sop_agent',        'SOP Agent',        'knowledge',  'planned','weekly',       'SOP review cadence, staleness detection'),
  ('compliance_agent', 'Compliance Agent', 'knowledge',  'planned','daily',        'License/permit expiry alerts')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS governance.agent_runs (
  run_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      uuid NOT NULL REFERENCES governance.agents(agent_id),
  property_id   bigint REFERENCES public.hotels(property_id),
  started_at    timestamptz DEFAULT now(),
  finished_at   timestamptz,
  status        text DEFAULT 'running' CHECK (status IN ('running','success','partial','failed','timeout')),
  duration_ms   int,
  input         jsonb,
  output        jsonb,
  proposals_created int DEFAULT 0,
  tokens_in     int,
  tokens_out    int,
  cost_usd      numeric,
  error_message text,
  trace_url     text
);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent ON governance.agent_runs(agent_id, started_at DESC);

-- ---------------------------------------------------------------------
-- 2. MANDATES & RULES
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS governance.mandates (
  mandate_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   bigint REFERENCES public.hotels(property_id),
  code          text UNIQUE NOT NULL,
  name          text NOT NULL,
  description   text,
  category      text,                                -- pricing | service | financial | hr | compliance | brand
  status        text DEFAULT 'active' CHECK (status IN ('draft','active','paused','retired')),
  version       int DEFAULT 1,
  effective_from date DEFAULT current_date,
  effective_to  date,
  source_doc_id uuid REFERENCES docs.documents(doc_id),
  set_by        uuid REFERENCES auth.users(id),
  set_at        timestamptz DEFAULT now(),
  notes         text,
  raw           jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Seed core mandates from v9 mockup
INSERT INTO governance.mandates (code, name, category, description) VALUES
  ('adr_floor',           'ADR Floor',                 'pricing', 'Average daily rate must not fall below threshold'),
  ('promo_ceiling',       'Promo Ceiling',             'pricing', 'No promo deeper than threshold without owner consent'),
  ('comp_authority',      'Comp Authority',            'service', 'Per-role comp authority limits'),
  ('capex_threshold',     'CapEx Threshold',           'financial','CapEx above threshold requires owner approval'),
  ('qa_floor',            'QA Score Floor',            'service', 'Department QA scores below threshold trigger remediation'),
  ('cancellation_ceiling','Cancellation Rate Ceiling', 'pricing', 'Cancellation rate above threshold triggers review'),
  ('review_response_sla', 'Review Response SLA',       'service', 'Reviews must be responded to within X hours')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS governance.mandate_rules (
  rule_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_id    uuid NOT NULL REFERENCES governance.mandates(mandate_id) ON DELETE CASCADE,
  rule_type     text NOT NULL CHECK (rule_type IN ('numeric_floor','numeric_ceiling','boolean','enum_in','enum_not_in','expression')),
  applies_to    text,                                 -- e.g. 'rate_plan' | 'role:hod' | 'currency:USD'
  numeric_value numeric,
  text_value    text,
  list_value    text[],
  expression    text,                                  -- raw SQL or JSONLogic
  unit          text,                                  -- USD | LAK | %
  severity      text DEFAULT 'breach' CHECK (severity IN ('warn','breach','block')),
  notes         text
);

CREATE TABLE IF NOT EXISTS governance.mandate_breaches (
  breach_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_id       uuid NOT NULL REFERENCES governance.mandates(mandate_id),
  property_id      bigint REFERENCES public.hotels(property_id),
  detected_at      timestamptz DEFAULT now(),
  detected_by      text,                              -- agent code or 'system' or user uuid
  entity_type      text,
  entity_id        text,
  observed_value   text,
  expected_value   text,
  severity         text,
  status           text DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved','waived','ignored')),
  resolved_at      timestamptz,
  resolved_by      uuid REFERENCES auth.users(id),
  resolution_notes text
);
CREATE INDEX IF NOT EXISTS idx_breaches_open ON governance.mandate_breaches(status) WHERE status = 'open';

-- Authority limits per role
CREATE TABLE IF NOT EXISTS governance.authority_limits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   bigint REFERENCES public.hotels(property_id),
  role_code     text NOT NULL,                       -- soft FK to app.roles.code
  limit_type    text NOT NULL,                       -- comp | discount | capex | refund | rate_override
  amount        numeric NOT NULL,
  currency      text DEFAULT 'USD',
  per_period    text,                                -- per_event | per_day | per_month
  notes         text,
  effective_from date DEFAULT current_date,
  effective_to  date,
  set_by        uuid REFERENCES auth.users(id),
  set_at        timestamptz DEFAULT now(),
  UNIQUE (property_id, role_code, limit_type, effective_from)
);

INSERT INTO governance.authority_limits (role_code, limit_type, amount, currency, per_period, notes) VALUES
  ('line_staff', 'comp',        20,  'USD', 'per_event', 'Frontline guest gestures'),
  ('supervisor', 'comp',        40,  'USD', 'per_event', 'Per v9 mockup'),
  ('hod',        'comp',        100, 'USD', 'per_event', NULL),
  ('gm',         'comp',        500, 'USD', 'per_event', NULL),
  ('gm',         'capex',       5000,'USD', 'per_event', 'Per v9 mockup'),
  ('owner',      'capex',       999999999,'USD','per_event','Unlimited')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 3. PROPOSALS (consent queue) & DECISIONS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS governance.proposals (
  proposal_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id        bigint REFERENCES public.hotels(property_id),
  agent_id           uuid REFERENCES governance.agents(agent_id),
  agent_run_id       uuid REFERENCES governance.agent_runs(run_id),
  pillar             text,
  category           text,                              -- pricing | reply | reconciliation | maintenance | hr | etc.
  headline           text NOT NULL,
  body_markdown      text,
  rationale          text,
  proposed_action    jsonb NOT NULL DEFAULT '{}'::jsonb,  -- structured: what to do, where, params
  modeled_impact_usd numeric,
  modeled_impact_lak numeric,
  confidence         numeric CHECK (confidence BETWEEN 0 AND 1),
  reversibility      text CHECK (reversibility IN ('reversible','partial','irreversible')),
  within_mandate     boolean DEFAULT true,
  mandate_breaches   text[],
  priority           text DEFAULT 'med' CHECK (priority IN ('low','med','high','urgent')),
  sla_hours          int,
  status             text DEFAULT 'pending' CHECK (status IN ('pending','approved','adjusted','rejected','deferred','expired','executed','reverted')),
  expires_at         timestamptz,
  executed_at        timestamptz,
  executed_by        uuid REFERENCES auth.users(id),
  external_action_ref text,                              -- e.g. Cloudbeds rate update id
  evidence_doc_ids   uuid[] DEFAULT '{}'::uuid[],
  raw                jsonb DEFAULT '{}'::jsonb,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proposals_pending ON governance.proposals(status, priority, created_at DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_proposals_agent ON governance.proposals(agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS governance.proposal_decisions (
  id                bigserial PRIMARY KEY,
  proposal_id       uuid NOT NULL REFERENCES governance.proposals(proposal_id) ON DELETE CASCADE,
  decision          text NOT NULL CHECK (decision IN ('approved','adjusted','rejected','deferred')),
  decided_by        uuid REFERENCES auth.users(id),
  decided_at        timestamptz DEFAULT now(),
  adjusted_action   jsonb,
  reason            text,
  ip                inet
);
CREATE INDEX IF NOT EXISTS idx_decisions_proposal ON governance.proposal_decisions(proposal_id);

-- Post-execution actuals (close the loop)
CREATE TABLE IF NOT EXISTS governance.proposal_outcomes (
  id                 bigserial PRIMARY KEY,
  proposal_id        uuid NOT NULL REFERENCES governance.proposals(proposal_id) ON DELETE CASCADE,
  measured_at        timestamptz DEFAULT now(),
  window_days        int,
  actual_impact_usd  numeric,
  actual_impact_lak  numeric,
  variance_pct       numeric,
  notes              text,
  measured_by        text                              -- agent code or user
);

-- ---------------------------------------------------------------------
-- 4. RLS + grants + triggers
-- ---------------------------------------------------------------------
ALTER TABLE governance.agents              ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance.agent_runs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance.mandates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance.mandate_rules       ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance.mandate_breaches    ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance.authority_limits    ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance.proposals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance.proposal_decisions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance.proposal_outcomes   ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_agents_updated ON governance.agents;
CREATE TRIGGER trg_agents_updated BEFORE UPDATE ON governance.agents
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

DROP TRIGGER IF EXISTS trg_mandates_updated ON governance.mandates;
CREATE TRIGGER trg_mandates_updated BEFORE UPDATE ON governance.mandates
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

DROP TRIGGER IF EXISTS trg_proposals_updated ON governance.proposals;
CREATE TRIGGER trg_proposals_updated BEFORE UPDATE ON governance.proposals
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

GRANT USAGE ON SCHEMA governance TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA governance TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA governance TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA governance TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA governance GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA governance GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA governance GRANT ALL ON SEQUENCES TO service_role;
