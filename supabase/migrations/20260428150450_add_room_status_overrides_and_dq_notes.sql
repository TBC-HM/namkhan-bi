-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260428150450
-- Name:    add_room_status_overrides_and_dq_notes
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- =============================================================================
-- Operational overrides table: lets us pin facts that the PMS gets wrong
-- (Lao front-desk staff occasionally press wrong buttons; until DQ agent v2
-- crawls and detects, we override here.)
-- =============================================================================
CREATE TABLE IF NOT EXISTS operational_overrides (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,        -- 'room', 'reservation', 'transaction', etc.
  entity_id TEXT NOT NULL,
  override_type TEXT NOT NULL,      -- 'permanently_closed', 'always_complimentary', etc.
  reason TEXT,
  set_by TEXT DEFAULT 'paul',
  effective_from DATE DEFAULT CURRENT_DATE,
  effective_to DATE,                -- NULL = forever
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_op_override_lookup
  ON operational_overrides(entity_type, entity_id, override_type) WHERE is_active = true;

-- Pin Tent 7 as permanently closed
INSERT INTO operational_overrides
  (entity_type, entity_id, override_type, reason, set_by)
VALUES
  ('room', '508412-1', 'permanently_closed',
   'Tent 7 retired permanently. Confirmed by owner 2026-04-28.',
   'paul')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- DQ notes table: parking issues for the future DQ agent
-- =============================================================================
CREATE TABLE IF NOT EXISTS dq_known_issues (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,           -- 'low', 'medium', 'high'
  description TEXT NOT NULL,
  detection_query TEXT,             -- SQL that surfaces affected rows
  fix_owner TEXT,                   -- 'pms_user_education', 'sync_code', 'agent_v2'
  status TEXT DEFAULT 'open',       -- 'open', 'parked', 'fixed', 'wontfix'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO dq_known_issues (category, severity, description, fix_owner, status, notes) VALUES
  ('PMS_USER_ERROR', 'medium',
   'Lao front-desk operators sometimes press wrong buttons in Cloudbeds (wrong category, wrong rate plan, wrong room). This produces garbage data that needs to be detected and flagged.',
   'agent_v2', 'parked',
   'Future DQ agent will crawl historical data, detect anomalies (e.g. F&B charge with wrong category, transactions on wrong reservation, impossible rate vs ADR delta), and surface fix list daily. Strict rules to define then.'),
  ('MARKET_SEGMENT_NULL', 'medium',
   '82% of historical reservations have NULL market_segment in PMS.',
   'pms_user_education', 'open',
   'Front desk SOP must require segment tag on every booking. Surface in DQ tab.'),
  ('UNCATEGORIZED_ITEMS', 'low',
   '6 items in Cloudbeds have no categoryID. Plus ~5% transactions monthly fall through USALI map.',
   'pms_user_education', 'open',
   'Categorize in Cloudbeds Settings → Items.'),
  ('HOUSEKEEPING_SCOPE_MISSING', 'high',
   'getHousekeepingStatus API returns scope-blocked. Cannot show OOO/OOS rooms or cleanliness data.',
   'cloudbeds_support_ticket', 'open',
   'Open ticket with Cloudbeds support, request housekeeping:read scope on key.'),
  ('TENT_7_CLOSED', 'low',
   'Tent 7 (room_id 508412-1) is permanently closed per owner directive 2026-04-28. Inventory denominator = 19, not 20.',
   'operational_override', 'fixed',
   'Pinned in operational_overrides table. mv_kpi_today already uses is_active filter.');

GRANT SELECT ON operational_overrides TO anon, authenticated;
GRANT SELECT ON dq_known_issues TO anon, authenticated;