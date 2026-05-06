-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505184135
-- Name:    marketing_social_accounts_polymorphic_metric
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Polymorphic metric on marketing.social_accounts so OTAs/listing platforms
-- (booking/expedia/tripadvisor/google_business) can carry review_count + rating
-- in the same table as IG/FB/TT/YT followers, without breaking existing reads.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audience_metric_kind' AND typnamespace = 'marketing'::regnamespace) THEN
    CREATE TYPE marketing.audience_metric_kind AS ENUM ('followers','reviews','impressions','subscribers');
  END IF;
END$$;

ALTER TABLE marketing.social_accounts
  ADD COLUMN IF NOT EXISTS metric_kind     marketing.audience_metric_kind NOT NULL DEFAULT 'followers',
  ADD COLUMN IF NOT EXISTS metric_value    integer        NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS secondary_value numeric(4,2),
  ADD COLUMN IF NOT EXISTS last_sync_status text,
  ADD COLUMN IF NOT EXISTS last_sync_error  text;

COMMENT ON COLUMN marketing.social_accounts.metric_kind  IS 'What metric_value/secondary_value mean: followers (IG/FB/TT), subscribers (YT), reviews (count + avg_rating), impressions (Google Business).';
COMMENT ON COLUMN marketing.social_accounts.metric_value IS 'Primary count: follower/subscriber/review count.';
COMMENT ON COLUMN marketing.social_accounts.secondary_value IS 'Secondary scalar: avg_rating when metric_kind=reviews.';

-- Re-classify the listing platforms
UPDATE marketing.social_accounts SET metric_kind = 'reviews'
  WHERE platform IN ('booking','expedia','tripadvisor','google_business');
UPDATE marketing.social_accounts SET metric_kind = 'subscribers'
  WHERE platform = 'youtube';
-- IG/FB/TT default to 'followers' (column default) — already correct.

-- Backfill metric_value from legacy followers (no-op when all zero, but
-- preserves anything that was hand-entered).
UPDATE marketing.social_accounts SET metric_value = COALESCE(followers, 0)
  WHERE metric_value = 0 AND followers IS NOT NULL AND followers > 0;

-- For OTA/listing rows, attempt a one-shot backfill from marketing.reviews
-- (count + avg_rating per source). Maps platform → reviews.source.
WITH agg AS (
  SELECT
    CASE
      WHEN source IN ('booking_com','booking') THEN 'booking'
      WHEN source = 'expedia'                  THEN 'expedia'
      WHEN source = 'tripadvisor'              THEN 'tripadvisor'
      WHEN source IN ('google','google_business','google_maps') THEN 'google_business'
      ELSE NULL
    END AS platform,
    COUNT(*)::int                       AS n,
    ROUND(AVG(rating_norm)::numeric, 2) AS avg_r
  FROM marketing.reviews
  WHERE rating_norm IS NOT NULL
  GROUP BY 1
)
UPDATE marketing.social_accounts s
   SET metric_value    = a.n,
       secondary_value = a.avg_r,
       last_synced_at  = COALESCE(s.last_synced_at, NOW())
  FROM agg a
 WHERE s.platform = a.platform
   AND a.platform IS NOT NULL
   AND s.metric_kind = 'reviews';

-- Compatibility view so existing TS getSocialAccounts() keeps reading
-- followers, while new UI can read metric_kind + metric_value.
CREATE OR REPLACE VIEW marketing.v_social_accounts AS
SELECT
  id, platform, handle, url, display_name,
  metric_kind, metric_value, secondary_value,
  -- legacy aliases for back-compat
  CASE WHEN metric_kind IN ('followers','subscribers') THEN metric_value ELSE 0 END AS followers,
  following, posts,
  last_synced_at, last_sync_status, last_sync_error,
  notes, active, updated_at
FROM marketing.social_accounts
ORDER BY platform;

GRANT SELECT ON marketing.v_social_accounts TO anon, authenticated, service_role;
