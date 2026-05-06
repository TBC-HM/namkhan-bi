-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504151923
-- Name:    news_cache_and_alerts_tables
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ============================================================================
-- 1. news.cached_items — refreshed by /api/cron/news every 6h
-- 2. news.cached_flights — refreshed by /api/cron/flights every 4h
-- 3. docs.alerts — daily expiry/missing-data findings, computed by /api/cron/alerts
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS news;

-- News cache (RSS items)
CREATE TABLE IF NOT EXISTS news.cached_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source       text NOT NULL,            -- 'Laotian Times' / 'Vientiane Times'
  title        text NOT NULL,
  link         text NOT NULL UNIQUE,     -- dedup key
  pub_date     timestamptz,
  excerpt      text,
  categories   text[] DEFAULT '{}',
  fetched_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS news_cached_pubdate_idx ON news.cached_items (pub_date DESC NULLS LAST);
GRANT SELECT ON news.cached_items TO authenticated, anon;

-- Flights cache (last refresh window)
CREATE TABLE IF NOT EXISTS news.cached_flights (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airport_icao    text NOT NULL DEFAULT 'VLLB',
  direction       text NOT NULL CHECK (direction IN ('arrival','departure')),
  callsign        text,
  icao24          text,
  origin_airport  text,
  dest_airport    text,
  first_seen      timestamptz,
  last_seen       timestamptz,
  fetched_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS news_flights_seen_idx ON news.cached_flights (direction, last_seen DESC NULLS LAST);
GRANT SELECT ON news.cached_flights TO authenticated, anon;

-- Alerts table (computed daily)
CREATE TABLE IF NOT EXISTS docs.alerts (
  alert_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_kind   text NOT NULL CHECK (alert_kind IN
                  ('expiring_30d','expiring_60d','expiring_90d',
                   'missing_party','missing_dates','low_quality_extract',
                   'duplicate','data_freshness')),
  doc_id       uuid REFERENCES docs.documents(doc_id) ON DELETE CASCADE,
  severity     text NOT NULL CHECK (severity IN ('critical','high','medium','low')),
  message      text NOT NULL,
  details      jsonb DEFAULT '{}'::jsonb,
  resolved_at  timestamptz,
  resolved_by  text,
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS alerts_unresolved_idx ON docs.alerts (severity, alert_kind)
  WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS alerts_doc_idx ON docs.alerts (doc_id);

ALTER TABLE docs.alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alerts_read ON docs.alerts;
CREATE POLICY alerts_read ON docs.alerts FOR SELECT TO authenticated USING (true);
GRANT SELECT ON docs.alerts TO authenticated, anon;

-- Add to schema-overview view so data agent can answer "any open alerts"
CREATE OR REPLACE VIEW public.v_alerts_open AS
SELECT
  a.alert_id, a.alert_kind, a.severity, a.message,
  d.title, d.doc_type, d.external_party, d.valid_until, d.importance,
  a.details, a.created_at
FROM docs.alerts a
LEFT JOIN docs.documents d ON d.doc_id = a.doc_id
WHERE a.resolved_at IS NULL
ORDER BY
  CASE a.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2
                  WHEN 'medium' THEN 3 ELSE 4 END,
  a.created_at DESC;
GRANT SELECT ON public.v_alerts_open TO authenticated, anon;

COMMENT ON TABLE news.cached_items IS 'RSS item cache, refreshed by /api/cron/news every 6h.';
COMMENT ON TABLE news.cached_flights IS 'Flight cache, refreshed by /api/cron/flights every 4h.';
COMMENT ON TABLE docs.alerts IS 'Daily alerts computed by /api/cron/alerts: expiries, missing data, low-quality extracts.';
