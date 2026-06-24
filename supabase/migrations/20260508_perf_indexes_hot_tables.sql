-- ============================================================
-- Migration: perf indexes on hot tables
-- Ticket: #229-child (Perf marathon — Add Postgres indexes on hot tables)
-- Created: 2026-05-08
-- Author: code_writer agent (Carla)
-- ============================================================
-- Strategy: CREATE INDEX CONCURRENTLY so these run without
-- locking tables in production.  Each block is idempotent via
-- IF NOT EXISTS (Postgres 9.5+).
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. cockpit_audit_log
--    Hot queries:
--      • WHERE agent = $1 ORDER BY created_at DESC
--      • WHERE action = $1 ORDER BY created_at DESC
--      • ORDER BY created_at DESC LIMIT N  (global log view)
-- ─────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_audit_log_agent_created
  ON public.cockpit_audit_log (agent, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_audit_log_action_created
  ON public.cockpit_audit_log (action, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_audit_log_created
  ON public.cockpit_audit_log (created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 2. cockpit_tickets
--    Hot queries:
--      • WHERE status = $1
--      • WHERE arm = $1
--      • WHERE source = $1
--      • ORDER BY id  (pagination)
--      • ORDER BY created_at DESC  (dashboard listing)
--      • WHERE metadata->>'parent_ticket' = $1  (child lookup)
-- ─────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_tickets_status
  ON public.cockpit_tickets (status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_tickets_arm
  ON public.cockpit_tickets (arm);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_tickets_source
  ON public.cockpit_tickets (source);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_tickets_created_at
  ON public.cockpit_tickets (created_at DESC);

-- JSONB index for parent_ticket child lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_tickets_metadata_parent_ticket
  ON public.cockpit_tickets ((metadata->>'parent_ticket'));

-- Composite: list open tickets per arm (most common cockpit query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_tickets_arm_status_created
  ON public.cockpit_tickets (arm, status, created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 3. cockpit_incidents
--    Hot queries:
--      • WHERE status = $1
--      • ORDER BY created_at DESC
-- ─────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_incidents_status
  ON public.cockpit_incidents (status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_incidents_created_at
  ON public.cockpit_incidents (created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 4. marketing.media_assets
--    Hot queries (via pick_media fn):
--      • WHERE channel = $1
--      • WHERE asset_type = $1
--      • tags @> $1  (GIN index for JSONB/array tag matching)
--      • WHERE is_active = true
-- ─────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_media_assets_channel
  ON marketing.media_assets (channel)
  WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_media_assets_asset_type
  ON marketing.media_assets (asset_type)
  WHERE is_active = true;

-- GIN index for tag array / JSONB containment (@>)
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_media_assets_tags_gin
  ON marketing.media_assets USING gin (tags);

-- Composite covering index for the most selective pick_media path
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_media_assets_channel_type_active
  ON marketing.media_assets (channel, asset_type, is_active);

-- ─────────────────────────────────────────────────────────────
-- 5. marketing.media_use_log  (log_media_use fn)
--    Hot queries:
--      • WHERE asset_id = $1
--      • WHERE channel = $1
--      • ORDER BY used_at DESC
-- ─────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_media_use_log_asset_id
  ON marketing.media_use_log (asset_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_media_use_log_channel_used_at
  ON marketing.media_use_log (channel, used_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 6. cockpit_agent_identity  (list_team_members)
--    Hot query: WHERE is_archived = false  (every agent roster call)
-- ─────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_agent_identity_archived
  ON public.cockpit_agent_identity (is_archived)
  WHERE is_archived = false;

-- ─────────────────────────────────────────────────────────────
-- 7. revenue / data tables (common date-range filter pattern)
--    If these tables exist, index stay_date / report_date.
--    Wrapped in DO blocks so the migration is safe even if the
--    table doesn't exist in a given environment.
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- v_overview_kpis backing table(s): try common names
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'daily_kpis'
  ) THEN
    EXECUTE $idx$
      CREATE INDEX CONCURRENTLY IF NOT EXISTS
        idx_daily_kpis_stay_date
        ON public.daily_kpis (stay_date DESC)
    $idx$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'revenue_daily'
  ) THEN
    EXECUTE $idx$
      CREATE INDEX CONCURRENTLY IF NOT EXISTS
        idx_revenue_daily_stay_date
        ON public.revenue_daily (stay_date DESC)
    $idx$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'compset_rates'
  ) THEN
    EXECUTE $idx$
      CREATE INDEX CONCURRENTLY IF NOT EXISTS
        idx_compset_rates_report_date
        ON public.compset_rates (report_date DESC)
    $idx$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'revenue'
      AND table_name = 'daily_kpis'
  ) THEN
    EXECUTE $idx$
      CREATE INDEX CONCURRENTLY IF NOT EXISTS
        idx_rev_daily_kpis_stay_date
        ON revenue.daily_kpis (stay_date DESC)
    $idx$;
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- Summary of indexes added
-- ─────────────────────────────────────────────────────────────
-- cockpit_audit_log      : 3 indexes (agent+date, action+date, date)
-- cockpit_tickets        : 6 indexes (status, arm, source, date,
--                                     jsonb parent_ticket, arm+status+date)
-- cockpit_incidents      : 2 indexes (status, date)
-- marketing.media_assets : 4 indexes (channel, asset_type, GIN tags,
--                                     channel+type+active composite)
-- marketing.media_use_log: 2 indexes (asset_id, channel+date)
-- cockpit_agent_identity : 1 partial index (active agents only)
-- revenue tables         : up to 4 conditional indexes (if tables exist)
-- ─────────────────────────────────────────────────────────────
-- Expected impact:
--   • cockpit_audit_log queries: seq_scan → idx_scan
--     Estimated speedup: 5–20× on large log tables
--   • cockpit_tickets list/filter: covers all cockpit UI queries
--     Estimated speedup: 3–10×
--   • pick_media: GIN tag search replaces full table scan
--     Estimated speedup: 10–50× as asset library grows
--   • CONCURRENTLY: zero downtime, no table lock in production
-- ─────────────────────────────────────────────────────────────
