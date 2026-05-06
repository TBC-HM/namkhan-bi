-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504225021
-- Name:    marketing_gbp_snapshots_2026_05_04
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Daily Google Business Profile snapshot (one row per scrape).
-- Stores aggregate rating + review_count + photo_count + a sample of recent
-- reviews. Individual reviews continue to flow into marketing.reviews via
-- (source='google', source_review_id=hash).

CREATE TABLE IF NOT EXISTS marketing.gbp_snapshots (
  snapshot_id      bigserial PRIMARY KEY,
  property_id      bigint NOT NULL DEFAULT 260955,
  snapshot_date    date NOT NULL,
  place_rating     numeric(3,2),
  review_count     integer,
  photo_count      integer,
  source           text NOT NULL DEFAULT 'nimble' CHECK (source IN ('nimble','places_api','manual')),
  sample_reviews   jsonb,
  raw_url          text,
  raw_md_sample    text,
  agent_run_id     text,
  scraped_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gbp_snapshots_property_date_source UNIQUE (property_id, snapshot_date, source)
);

CREATE INDEX IF NOT EXISTS gbp_snapshots_date_idx
  ON marketing.gbp_snapshots (property_id, snapshot_date DESC);

ALTER TABLE marketing.gbp_snapshots ENABLE ROW LEVEL SECURITY;

-- Read: anon + authenticated (these are public-grade aggregates).
DROP POLICY IF EXISTS gbp_snap_read ON marketing.gbp_snapshots;
CREATE POLICY gbp_snap_read ON marketing.gbp_snapshots
  FOR SELECT TO anon, authenticated
  USING (true);

GRANT SELECT ON marketing.gbp_snapshots TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON marketing.gbp_snapshots TO service_role;
GRANT USAGE, SELECT ON SEQUENCE marketing.gbp_snapshots_snapshot_id_seq TO service_role;

-- Public proxy view so /marketing page can read with anon key.
CREATE OR REPLACE VIEW public.v_gbp_latest AS
  SELECT DISTINCT ON (property_id)
    property_id, snapshot_date, place_rating, review_count, photo_count,
    sample_reviews, source, scraped_at
  FROM marketing.gbp_snapshots
  ORDER BY property_id, snapshot_date DESC, scraped_at DESC;

CREATE OR REPLACE VIEW public.v_gbp_history AS
  SELECT property_id, snapshot_date, place_rating, review_count, photo_count, source, scraped_at
  FROM marketing.gbp_snapshots
  ORDER BY property_id, snapshot_date DESC;

GRANT SELECT ON public.v_gbp_latest, public.v_gbp_history TO anon, authenticated, service_role;