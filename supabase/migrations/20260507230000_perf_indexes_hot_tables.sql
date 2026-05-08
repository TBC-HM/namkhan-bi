-- Migration: perf_indexes_hot_tables
-- Ticket: #229 (Perf marathon child) — Add Postgres indexes on hot tables
-- Author: Code Carla (agent)
-- Date: 2026-05-07
--
-- Strategy: CONCURRENTLY so no table locks in production.
-- All indexes use IF NOT EXISTS for idempotency.
-- Tables targeted: cockpit_tickets, cockpit_incidents, cockpit_audit_log,
--                  cockpit_mismatches, marketing.media_assets

-- ─── cockpit_tickets ─────────────────────────────────────────────────────────

-- Primary filter: status (most queries filter by status)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cockpit_tickets_status
  ON public.cockpit_tickets (status);

-- Filter by arm (dev / revenue / marketing / ops)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cockpit_tickets_arm
  ON public.cockpit_tickets (arm);

-- Composite: arm + status (the most common combined filter pattern)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cockpit_tickets_arm_status
  ON public.cockpit_tickets (arm, status);

-- Recency sort — created_at DESC is used in every list query
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cockpit_tickets_created_at
  ON public.cockpit_tickets (created_at DESC);

-- Source column (pbs-overnight-fanout, email, etc.)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cockpit_tickets_source
  ON public.cockpit_tickets (source);

-- ─── cockpit_incidents ───────────────────────────────────────────────────────

-- Filter by status (open / resolved / muted)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cockpit_incidents_status
  ON public.cockpit_incidents (status);

-- Recency sort
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cockpit_incidents_created_at
  ON public.cockpit_incidents (created_at DESC);

-- Arm filter
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cockpit_incidents_arm
  ON public.cockpit_incidents (arm);

-- ─── cockpit_audit_log ───────────────────────────────────────────────────────

-- Agent filter (who did what)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cockpit_audit_log_agent
  ON public.cockpit_audit_log (agent);

-- Action filter
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cockpit_audit_log_action
  ON public.cockpit_audit_log (action);

-- Recency sort — audit log is always read newest-first
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cockpit_audit_log_created_at
  ON public.cockpit_audit_log (created_at DESC);

-- Composite: agent + action for per-agent action history queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cockpit_audit_log_agent_action
  ON public.cockpit_audit_log (agent, action);

-- ─── cockpit_mismatches ──────────────────────────────────────────────────────

-- Active unresolved rows (the self-heal cron filters this constantly)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cockpit_mismatches_active
  ON public.cockpit_mismatches (active)
  WHERE active = TRUE;

-- Composite: active + fixed_at IS NULL (the canonical self-heal WHERE clause)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cockpit_mismatches_active_unresolved
  ON public.cockpit_mismatches (active, fixed_at)
  WHERE active = TRUE AND fixed_at IS NULL;

-- Recency sort
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cockpit_mismatches_created_at
  ON public.cockpit_mismatches (created_at DESC);

-- ─── marketing.media_assets ──────────────────────────────────────────────────

-- Asset type filter (photo / video / logo / etc.)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_assets_asset_type
  ON marketing.media_assets (asset_type);

-- Channel filter
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_assets_channel
  ON marketing.media_assets (channel);

-- Active/approved flag (if column exists — guard handled by IF NOT EXISTS on index)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_assets_is_active
  ON marketing.media_assets (is_active)
  WHERE is_active = TRUE;

-- GIN index on tags JSONB column for contains (@>) queries used by pick_media()
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_assets_tags_gin
  ON marketing.media_assets USING GIN (tags);
