-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260429211837
-- Name:    phase1_07_agent_components
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- =====================================================================
-- Phase 1.7 — Agent components (prompts, secrets, KPI view, triggers, tools)
-- Adds versioned prompts, knowledge refs, tools registry, schedule triggers,
-- secrets reference, and a health KPI view.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. AGENT_PROMPTS — versioned, immutable history, one current per agent
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS governance.agent_prompts (
  prompt_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id             uuid NOT NULL REFERENCES governance.agents(agent_id) ON DELETE CASCADE,
  version              int NOT NULL,
  is_current           boolean DEFAULT false,
  -- Prompt content
  system_prompt        text NOT NULL,
  user_prompt_template text,
  output_schema        jsonb,                          -- expected proposal structure (json schema)
  variables            jsonb DEFAULT '{}'::jsonb,      -- [{name, type, default, label, owner_editable}]
  -- Knowledge & context
  knowledge_refs       jsonb DEFAULT '[]'::jsonb,      -- [{kind:'doc'|'view'|'kpi'|'corpus', ref:'<id_or_name>'}]
  input_sources        jsonb DEFAULT '[]'::jsonb,      -- [{kind:'sql_view'|'api'|'table_query', spec:{}}]
  -- Tools
  tools_enabled        text[] DEFAULT '{}'::text[],    -- e.g. {cloudbeds_read, cloudbeds_rate_update, send_email, post_review_reply}
  -- Model config
  model_id             text NOT NULL,                  -- e.g. claude-sonnet-4-7 | gemini-2.0-flash
  temperature          numeric DEFAULT 0.2,
  max_tokens           int DEFAULT 4000,
  top_p                numeric,
  -- Guardrails
  guardrails           jsonb DEFAULT '{}'::jsonb,      -- {confidence_min, never_irreversible_without_consent, mandate_check:true}
  -- Audit
  change_note          text,
  created_by           uuid REFERENCES auth.users(id),
  created_at           timestamptz DEFAULT now(),
  effective_from       timestamptz DEFAULT now(),
  effective_to         timestamptz,
  UNIQUE (agent_id, version)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_prompts_one_current
  ON governance.agent_prompts(agent_id) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_agent_prompts_agent ON governance.agent_prompts(agent_id, version DESC);

-- ---------------------------------------------------------------------
-- 2. AGENT_SECRETS — references Supabase Vault, never store raw values
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS governance.agent_secrets (
  id              bigserial PRIMARY KEY,
  agent_id        uuid NOT NULL REFERENCES governance.agents(agent_id) ON DELETE CASCADE,
  key             text NOT NULL,                      -- e.g. CLOUDBEDS_API_KEY, MAKE_WEBHOOK_PRICING
  vault_secret_id uuid,                                -- references vault.secrets(id)
  scope           text,                                -- read | write | admin
  notes           text,
  created_at      timestamptz DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  UNIQUE (agent_id, key)
);

-- ---------------------------------------------------------------------
-- 3. AGENT_TOOLS_CATALOG — registry of every tool an agent can call
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS governance.tools_catalog (
  tool_code      text PRIMARY KEY,
  category       text,                                 -- read | write | external_api | notification | finance
  name           text NOT NULL,
  description    text,
  input_schema   jsonb,                                -- json schema for params
  output_schema  jsonb,
  side_effect    text CHECK (side_effect IN ('none','read','write','external','financial')),
  reversible     boolean DEFAULT true,
  requires_consent boolean DEFAULT true,
  cost_estimate  text,
  is_active      boolean DEFAULT true,
  created_at     timestamptz DEFAULT now()
);

INSERT INTO governance.tools_catalog (tool_code, category, name, side_effect, reversible, requires_consent) VALUES
  ('cloudbeds_read',          'read',          'Cloudbeds: read reservations / rates / guests', 'read',     true,  false),
  ('cloudbeds_rate_update',   'write',         'Cloudbeds: update rate / availability',         'write',    true,  true),
  ('cloudbeds_post_charge',   'write',         'Cloudbeds: post charge to folio',               'financial',false, true),
  ('cloudbeds_send_message',  'external_api',  'Cloudbeds: send guest message',                 'external', false, true),
  ('supabase_read',           'read',          'Supabase: read any view',                       'read',     true,  false),
  ('supabase_write_proposal', 'write',         'Supabase: insert proposal (no live action)',    'write',    true,  false),
  ('make_webhook_call',       'external_api',  'Make.com: trigger scenario webhook',            'external', false, true),
  ('email_send',              'external_api',  'Send transactional email via Gmail',            'external', false, true),
  ('whatsapp_send',           'external_api',  'Send WhatsApp Business message',                'external', false, true),
  ('review_post_reply',       'external_api',  'Post review reply (Booking.com / Google)',      'external', false, true),
  ('docusign_send',           'external_api',  'Send envelope for e-signature',                 'external', true,  true),
  ('quickbooks_post_journal', 'write',         'QuickBooks: post journal entry',                'financial',false, true),
  ('bank_initiate_payment',   'write',         'Bank: initiate payment',                        'financial',false, true),
  ('drive_read_doc',          'read',          'Google Drive: read document',                   'read',     true,  false),
  ('drive_write_doc',         'write',         'Google Drive: create / update document',        'write',    true,  false)
ON CONFLICT (tool_code) DO NOTHING;

-- ---------------------------------------------------------------------
-- 4. AGENT_TRIGGERS — schedule + event-driven invocations
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS governance.agent_triggers (
  trigger_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      uuid NOT NULL REFERENCES governance.agents(agent_id) ON DELETE CASCADE,
  trigger_type  text NOT NULL CHECK (trigger_type IN ('cron','webhook','event','manual')),
  cron_expr     text,                                 -- when trigger_type='cron'
  event_kind    text,                                 -- when trigger_type='event': new_review | new_reservation | nightly_close | mandate_breach | etc.
  webhook_path  text,                                 -- when trigger_type='webhook'
  is_active     boolean DEFAULT true,
  last_fired_at timestamptz,
  config        jsonb DEFAULT '{}'::jsonb,
  notes         text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_triggers_active ON governance.agent_triggers(agent_id) WHERE is_active = true;

-- ---------------------------------------------------------------------
-- 5. Extend agent_runs to FK the prompt version that produced it
-- ---------------------------------------------------------------------
ALTER TABLE governance.agent_runs
  ADD COLUMN IF NOT EXISTS prompt_id uuid REFERENCES governance.agent_prompts(prompt_id),
  ADD COLUMN IF NOT EXISTS triggered_by_trigger_id uuid REFERENCES governance.agent_triggers(trigger_id),
  ADD COLUMN IF NOT EXISTS budget_used_usd numeric DEFAULT 0;

-- ---------------------------------------------------------------------
-- 6. Extend agents with monthly budget + summary fields
-- ---------------------------------------------------------------------
ALTER TABLE governance.agents
  ADD COLUMN IF NOT EXISTS monthly_budget_usd numeric,
  ADD COLUMN IF NOT EXISTS month_to_date_cost_usd numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approval_rate numeric,         -- approved / (approved+rejected)
  ADD COLUMN IF NOT EXISTS roi_realized_usd numeric DEFAULT 0;

-- ---------------------------------------------------------------------
-- 7. AGENT KPI VIEW — health dashboard per agent
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW governance.v_agent_health AS
SELECT
  a.agent_id,
  a.code,
  a.name,
  a.pillar,
  a.status,
  a.monthly_budget_usd,
  a.month_to_date_cost_usd,
  -- Run stats (last 30d)
  (SELECT count(*) FROM governance.agent_runs ar WHERE ar.agent_id = a.agent_id AND ar.started_at > now() - interval '30 days') AS runs_30d,
  (SELECT count(*) FROM governance.agent_runs ar WHERE ar.agent_id = a.agent_id AND ar.started_at > now() - interval '30 days' AND ar.status = 'success') AS success_30d,
  (SELECT count(*) FROM governance.agent_runs ar WHERE ar.agent_id = a.agent_id AND ar.started_at > now() - interval '30 days' AND ar.status = 'failed') AS failed_30d,
  (SELECT coalesce(sum(ar.cost_usd),0) FROM governance.agent_runs ar WHERE ar.agent_id = a.agent_id AND ar.started_at > now() - interval '30 days') AS cost_30d_usd,
  (SELECT coalesce(sum(ar.tokens_in+ar.tokens_out),0) FROM governance.agent_runs ar WHERE ar.agent_id = a.agent_id AND ar.started_at > now() - interval '30 days') AS tokens_30d,
  -- Proposal stats
  (SELECT count(*) FROM governance.proposals p WHERE p.agent_id = a.agent_id AND p.created_at > now() - interval '30 days') AS proposals_30d,
  (SELECT count(*) FROM governance.proposals p WHERE p.agent_id = a.agent_id AND p.status = 'pending') AS proposals_pending,
  (SELECT count(*) FROM governance.proposals p WHERE p.agent_id = a.agent_id AND p.status = 'approved' AND p.created_at > now() - interval '30 days') AS approved_30d,
  (SELECT count(*) FROM governance.proposals p WHERE p.agent_id = a.agent_id AND p.status = 'rejected' AND p.created_at > now() - interval '30 days') AS rejected_30d,
  -- Outcomes
  (SELECT coalesce(sum(po.actual_impact_usd),0) FROM governance.proposal_outcomes po
     JOIN governance.proposals p ON p.proposal_id = po.proposal_id
     WHERE p.agent_id = a.agent_id AND po.measured_at > now() - interval '30 days') AS realized_impact_30d_usd,
  -- Current prompt
  (SELECT version FROM governance.agent_prompts ap WHERE ap.agent_id = a.agent_id AND ap.is_current = true LIMIT 1) AS current_prompt_version,
  a.last_run_at,
  a.last_success_at,
  a.last_error,
  a.updated_at
FROM governance.agents a;

GRANT SELECT ON governance.v_agent_health TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 8. Trigger: enforce only one is_current=true per agent
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION governance.set_current_prompt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_current THEN
    UPDATE governance.agent_prompts
       SET is_current = false, effective_to = now()
     WHERE agent_id = NEW.agent_id AND prompt_id <> NEW.prompt_id AND is_current = true;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_set_current_prompt ON governance.agent_prompts;
CREATE TRIGGER trg_set_current_prompt BEFORE INSERT OR UPDATE ON governance.agent_prompts
  FOR EACH ROW WHEN (NEW.is_current = true) EXECUTE FUNCTION governance.set_current_prompt();

-- ---------------------------------------------------------------------
-- 9. RLS + grants
-- ---------------------------------------------------------------------
ALTER TABLE governance.agent_prompts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance.agent_secrets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance.tools_catalog   ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance.agent_triggers  ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON governance.agent_prompts, governance.tools_catalog, governance.agent_triggers TO authenticated;
GRANT ALL ON governance.agent_prompts, governance.agent_secrets, governance.tools_catalog, governance.agent_triggers TO service_role;
GRANT ALL ON SEQUENCE governance.agent_secrets_id_seq TO service_role;

DROP TRIGGER IF EXISTS trg_triggers_updated ON governance.agent_triggers;
CREATE TRIGGER trg_triggers_updated BEFORE UPDATE ON governance.agent_triggers
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

COMMENT ON TABLE governance.agent_prompts IS 'Versioned, immutable history of agent prompts. One is_current=true per agent.';
COMMENT ON TABLE governance.agent_secrets IS 'References to Supabase Vault. Never store raw secret values here.';
COMMENT ON TABLE governance.tools_catalog IS 'Registry of every tool any agent may call. Tools added here, then enabled per agent.';
COMMENT ON TABLE governance.agent_triggers IS 'Cron, webhook, event, manual triggers per agent.';
COMMENT ON VIEW governance.v_agent_health IS 'Per-agent 30-day health metrics: runs, cost, proposals, outcomes.';
