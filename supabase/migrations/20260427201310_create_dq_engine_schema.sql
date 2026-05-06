-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427201310
-- Name:    create_dq_engine_schema
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE SCHEMA IF NOT EXISTS dq;

-- Rule registry
CREATE TABLE IF NOT EXISTS dq.rules (
  rule_id text PRIMARY KEY,
  rule_name text NOT NULL,
  category text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('CRITICAL','WARNING','INFO')),
  description text,
  threshold numeric,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Violation log (every check that fails)
CREATE TABLE IF NOT EXISTS dq.violations (
  violation_id bigserial PRIMARY KEY,
  rule_id text NOT NULL REFERENCES dq.rules(rule_id),
  detected_at timestamptz DEFAULT now(),
  entity_type text,
  entity_id text,
  severity text NOT NULL,
  details jsonb,
  resolved_at timestamptz,
  resolved_by text,
  resolution_notes text
);

CREATE INDEX IF NOT EXISTS ix_dq_violations_rule ON dq.violations(rule_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS ix_dq_violations_unresolved ON dq.violations(detected_at DESC) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_dq_violations_severity ON dq.violations(severity, detected_at DESC) WHERE resolved_at IS NULL;

-- Run log (each time the rule engine runs)
CREATE TABLE IF NOT EXISTS dq.run_log (
  run_id bigserial PRIMARY KEY,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  rules_checked int,
  violations_found int,
  status text DEFAULT 'running'
);

-- Seed all rules
INSERT INTO dq.rules (rule_id, rule_name, category, severity, description, threshold) VALUES
('R-001', 'No reservations modified in last 6 hours', 'Pipeline Freshness', 'WARNING', 'Cloudbeds reservation sync may be stale', NULL),
('R-002', 'No transactions posted in last 24 hours', 'Pipeline Freshness', 'WARNING', 'POS transactions sync may be stale', NULL),
('R-003', 'daily_metrics missing for yesterday', 'Pipeline Freshness', 'CRITICAL', 'Yesterday should have daily_metrics row', NULL),
('R-004', 'Reservation has no rooms', 'Data Integrity', 'WARNING', 'Reservation exists with zero room nights', NULL),
('R-005', 'Reservation total != sum of rooms', 'Data Integrity', 'WARNING', 'Reservation total_amount mismatches sum of room nights × rate', 0.05),
('R-006', 'Negative room rate', 'Data Integrity', 'CRITICAL', 'Reservation has negative or zero rate', NULL),
('R-007', 'Check-in date after check-out', 'Data Integrity', 'CRITICAL', 'Reservation check-in > check-out', NULL),
('R-008', 'Stay length > 30 nights', 'Data Integrity', 'WARNING', 'Unusual long-term stay needs verification', 30),
('R-009', 'Future-dated transaction', 'Data Integrity', 'WARNING', 'Transaction with date > today', NULL),
('R-010', 'Transaction missing item_category', 'Data Quality', 'INFO', 'POS row has empty item_category_name', NULL),
('R-011', 'Spa transaction before Oct 25 2025', 'Data Quality', 'INFO', 'Spa POS pre-rollout — expected gap', NULL),
('R-012', 'Activities transaction before Nov 8 2025', 'Data Quality', 'INFO', 'Activities POS pre-rollout — expected gap', NULL),
('R-013', 'Cloudbeds vs QB rooms gap > 5% (VAT-adj)', 'Reconciliation', 'WARNING', 'Cloudbeds_net / 1.21 vs QB_rooms gap >5%', 0.05),
('R-014', 'Cloudbeds vs QB rooms gap > 15% (VAT-adj)', 'Reconciliation', 'CRITICAL', 'Major reconciliation gap requires investigation', 0.15),
('R-015', 'Daily occupancy > 100%', 'Logic Check', 'CRITICAL', 'Occupancy cannot exceed 100% — overbooking or data error', 1.0),
('R-016', 'Daily occupancy = 0% on weekday', 'Logic Check', 'WARNING', 'Suspicious zero occupancy — closed or sync issue', NULL),
('R-017', 'ADR drop > 30% MoM', 'Trend Anomaly', 'WARNING', 'Abrupt ADR drop — pricing error or segmentation shift', 0.30),
('R-018', 'Revenue drop > 50% MoM', 'Trend Anomaly', 'CRITICAL', 'Major revenue collapse needs investigation', 0.50),
('R-019', 'Same guest_name with different guest_id', 'Data Integrity', 'INFO', 'Possible duplicate guest record', NULL),
('R-020', 'Booking source not in sources table', 'Data Integrity', 'WARNING', 'Reservation source orphan', NULL),
('R-021', 'QB account_code missing in chart', 'Data Integrity', 'CRITICAL', 'QB transaction references unknown account', NULL),
('R-022', 'plan.lines orphan account_code', 'Data Integrity', 'WARNING', 'Budget line for non-existent account', NULL),
('R-023', 'Sync queue stuck > 1 hour', 'Pipeline Health', 'CRITICAL', 'Sync request pending too long', NULL),
('R-024', 'Sync error rate > 10%', 'Pipeline Health', 'WARNING', 'Many failed syncs indicate API/network issue', 0.10),
('R-025', 'FX rate stale > 7 days', 'Data Freshness', 'WARNING', 'No new FX rate posted in 7 days', NULL),
('R-026', 'P&L Net Income out of bounds', 'Logic Check', 'WARNING', 'Net income outside expected range for property', NULL),
('R-027', 'Budget vs Actual variance > 50%', 'Budget Variance', 'INFO', 'Major budget deviation', 0.50),
('R-028', 'Cloudbeds API key health check failed', 'Pipeline Health', 'CRITICAL', 'Authentication or connection error', NULL),
('R-029', 'Daily metrics older than 48h for past dates', 'Data Freshness', 'WARNING', 'Past data hasn''t been refreshed recently', NULL),
('R-030', 'GL transaction LAK row missing FX rate', 'Data Integrity', 'WARNING', 'LAK transaction posted on date with no FX rate', NULL),
('H-001', 'Reservation with same arrival/departure date', 'Heuristic', 'INFO', 'Day-use or zero-night anomaly', NULL),
('H-002', 'OTA channel >70% of revenue', 'Heuristic', 'WARNING', 'Channel concentration risk', 0.70),
('H-003', 'Cancellation rate > 25%', 'Heuristic', 'WARNING', 'High cancellation indicates pricing or experience issue', 0.25)
ON CONFLICT (rule_id) DO UPDATE SET 
  rule_name = EXCLUDED.rule_name,
  description = EXCLUDED.description,
  threshold = EXCLUDED.threshold;