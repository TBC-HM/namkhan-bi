-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505191414
-- Name:    cockpit_foundation_tables_with_rls
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Cockpit live state tables (Phase 2 of cockpit setup)
-- Source: cockpit-setup/supabase/01-tables.sql + RLS enables for namkhan-pms parity

-- Tickets: every email/voice request flows through here
CREATE TABLE IF NOT EXISTS cockpit_tickets (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL,
  arm TEXT NOT NULL,
  intent TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'parsing',
  email_subject TEXT,
  email_body TEXT,
  parsed_summary TEXT,
  pr_url TEXT,
  preview_url TEXT,
  github_issue_url TEXT,
  iterations INTEGER NOT NULL DEFAULT 0,
  closed_at TIMESTAMPTZ,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON cockpit_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_arm ON cockpit_tickets(arm);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON cockpit_tickets(created_at DESC);

-- Decisions: ADRs and significant agent choices
CREATE TABLE IF NOT EXISTS cockpit_decisions (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ticket_id BIGINT REFERENCES cockpit_tickets(id),
  arm TEXT,
  title TEXT NOT NULL,
  decision TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  alternatives_considered TEXT,
  superseded_by BIGINT REFERENCES cockpit_decisions(id),
  adr_url TEXT
);
CREATE INDEX IF NOT EXISTS idx_decisions_ticket ON cockpit_decisions(ticket_id);
CREATE INDEX IF NOT EXISTS idx_decisions_created_at ON cockpit_decisions(created_at DESC);

-- Incidents: anything that breaks
CREATE TABLE IF NOT EXISTS cockpit_incidents (
  id BIGSERIAL PRIMARY KEY,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  severity INTEGER NOT NULL,
  symptom TEXT NOT NULL,
  root_cause TEXT,
  fix TEXT,
  auto_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  rollback_attempted BOOLEAN NOT NULL DEFAULT FALSE,
  mttr_minutes INTEGER,
  notified_at TIMESTAMPTZ,
  source TEXT,
  metadata JSONB
);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON cockpit_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_detected ON cockpit_incidents(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_unresolved ON cockpit_incidents(detected_at) WHERE resolved_at IS NULL;

-- KPI snapshots: daily metrics
CREATE TABLE IF NOT EXISTS cockpit_kpi_snapshots (
  date DATE PRIMARY KEY,
  uptime_pct NUMERIC(5,2),
  error_rate NUMERIC(6,4),
  lighthouse_perf INTEGER,
  lighthouse_seo INTEGER,
  lighthouse_a11y INTEGER,
  security_red INTEGER,
  security_warn INTEGER,
  performance_warn INTEGER,
  open_prs INTEGER,
  open_incidents INTEGER,
  deploys_today INTEGER,
  deploy_success_rate_7d NUMERIC(5,2),
  vercel_usage_pct NUMERIC(5,2),
  supabase_usage_pct NUMERIC(5,2),
  raw_data JSONB
);
CREATE INDEX IF NOT EXISTS idx_kpi_date ON cockpit_kpi_snapshots(date DESC);

-- Audit log: who/what/when for every agent action
CREATE TABLE IF NOT EXISTS cockpit_audit_log (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  agent TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  ticket_id BIGINT REFERENCES cockpit_tickets(id),
  metadata JSONB,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  reasoning TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON cockpit_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_agent ON cockpit_audit_log(agent);

-- Trigger to keep updated_at fresh on cockpit_tickets
CREATE OR REPLACE FUNCTION cockpit_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cockpit_tickets_updated_at ON cockpit_tickets;
CREATE TRIGGER cockpit_tickets_updated_at
  BEFORE UPDATE ON cockpit_tickets
  FOR EACH ROW
  EXECUTE FUNCTION cockpit_set_updated_at();

-- Enable RLS on all cockpit tables (matches project security posture).
-- No policies added: service_role bypasses RLS by default in Supabase, so
-- API routes work as expected; anon and authenticated correctly get nothing.
ALTER TABLE cockpit_tickets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cockpit_decisions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE cockpit_incidents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE cockpit_kpi_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE cockpit_audit_log     ENABLE ROW LEVEL SECURITY;

-- Comments for future operators
COMMENT ON TABLE cockpit_tickets       IS 'Cockpit ops: every email/voice/cron/webhook request. RLS enabled, service_role only.';
COMMENT ON TABLE cockpit_decisions     IS 'Cockpit ops: ADRs and significant agent choices. RLS enabled, service_role only.';
COMMENT ON TABLE cockpit_incidents     IS 'Cockpit ops: production incidents (severity 1-4). RLS enabled, service_role only.';
COMMENT ON TABLE cockpit_kpi_snapshots IS 'Cockpit ops: daily uptime/perf/security KPI rollup. RLS enabled, service_role only.';
COMMENT ON TABLE cockpit_audit_log     IS 'Cockpit ops: who/what/when for every agent action. RLS enabled, service_role only.';
