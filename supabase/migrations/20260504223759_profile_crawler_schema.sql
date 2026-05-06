-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504223759
-- Name:    profile_crawler_schema
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Profile Crawler agent — three-table schema, cross-OTA.
-- crawls    : one row per crawl run per OTA
-- recommendations : agent suggestions per crawl
-- measurements    : link recs to outcomes after 14d

CREATE TABLE IF NOT EXISTS revenue.profile_crawls (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ota_source      text NOT NULL CHECK (ota_source IN (
                    'Booking.com','Expedia','Agoda','Airbnb','Trip.com',
                    'TripAdvisor','Google Business','Direct','Other')),
  page_url        text,
  crawl_date      timestamptz NOT NULL DEFAULT now(),
  status          text NOT NULL DEFAULT 'parsed' CHECK (status IN ('pending','parsed','failed')),
  parser_version  text NOT NULL DEFAULT 'v0-seed',
  -- Snapshot of what was on the profile at crawl time
  metadata        jsonb NOT NULL DEFAULT '{}',  -- {photo_count, description_chars, amenities_count, response_rate_pct, ...}
  scores          jsonb NOT NULL DEFAULT '{}',  -- {search_score, review_score, conversion_pct, cancel_pct, ranking_position, ...}
  raw_storage_path text,
  parse_error     text,
  notes           text
);
CREATE INDEX IF NOT EXISTS ix_profile_crawls_ota_date ON revenue.profile_crawls (ota_source, crawl_date DESC);

CREATE TABLE IF NOT EXISTS revenue.profile_recommendations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_id        uuid NOT NULL REFERENCES revenue.profile_crawls(id) ON DELETE CASCADE,
  ota_source      text NOT NULL,
  category        text NOT NULL CHECK (category IN (
                    'photos','description','amenities','policies','pricing',
                    'response_quality','content_completeness','review_management',
                    'channel_extras','other')),
  severity        text NOT NULL CHECK (severity IN ('critical','warn','info','positive')),
  title           text NOT NULL,
  evidence        text NOT NULL,
  recommendation  text NOT NULL,
  expected_impact text,                                  -- "+0.5pp conversion", "+2 reviews/mo", etc.
  metric_to_watch text,                                  -- e.g. 'conversion_pct', 'review_score'
  baseline_value  numeric,
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open','applied','dismissed','superseded','measured_worked','measured_no_change','measured_regressed')),
  applied_at      timestamptz,
  dismissed_at    timestamptz,
  measure_after   timestamptz,                           -- crawl_date + 14d typically
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_profile_recs_status ON revenue.profile_recommendations (ota_source, status, severity);
CREATE INDEX IF NOT EXISTS ix_profile_recs_measure ON revenue.profile_recommendations (measure_after) WHERE status = 'applied';

CREATE TABLE IF NOT EXISTS revenue.profile_measurements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL REFERENCES revenue.profile_recommendations(id) ON DELETE CASCADE,
  measured_at     timestamptz NOT NULL DEFAULT now(),
  baseline_value  numeric,
  current_value   numeric,
  delta_pct       numeric GENERATED ALWAYS AS (
                    CASE WHEN baseline_value IS NULL OR baseline_value = 0 THEN NULL
                         ELSE ROUND((current_value - baseline_value) / baseline_value * 100, 2)
                    END
                  ) STORED,
  verdict         text NOT NULL CHECK (verdict IN ('worked','no_change','regressed','inconclusive')),
  notes           text
);
CREATE INDEX IF NOT EXISTS ix_profile_meas_rec ON revenue.profile_measurements (recommendation_id, measured_at DESC);

-- Public proxy views (revenue not in pgrst.db_schemas)
DROP VIEW IF EXISTS public.v_profile_crawls CASCADE;
CREATE VIEW public.v_profile_crawls AS SELECT * FROM revenue.profile_crawls;

DROP VIEW IF EXISTS public.v_profile_recommendations CASCADE;
CREATE VIEW public.v_profile_recommendations AS SELECT * FROM revenue.profile_recommendations;

DROP VIEW IF EXISTS public.v_profile_measurements CASCADE;
CREATE VIEW public.v_profile_measurements AS SELECT * FROM revenue.profile_measurements;

-- Latest crawl per OTA
DROP VIEW IF EXISTS public.v_profile_latest_crawl CASCADE;
CREATE VIEW public.v_profile_latest_crawl AS
SELECT DISTINCT ON (ota_source) *
FROM revenue.profile_crawls
WHERE status = 'parsed'
ORDER BY ota_source, crawl_date DESC;

GRANT SELECT ON public.v_profile_crawls, public.v_profile_recommendations,
                public.v_profile_measurements, public.v_profile_latest_crawl
  TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON revenue.profile_crawls, revenue.profile_recommendations, revenue.profile_measurements
  TO service_role;