-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503172122
-- Name:    competitor_reviews_per_channel
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Reviews are per-channel (BDC score ≠ Agoda score ≠ Trip score)
-- One row per property × channel × shop date
CREATE TABLE IF NOT EXISTS revenue.competitor_reviews (
  review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id UUID NOT NULL REFERENCES revenue.competitor_property(comp_id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('booking','agoda','expedia','trip','google','tripadvisor','direct')),
  shop_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  review_score NUMERIC(3,1) CHECK (review_score BETWEEN 0 AND 10),  -- BDC/Agoda use /10, normalize all to 0-10
  review_count INT CHECK (review_count >= 0),
  review_label TEXT,  -- "Wonderful", "Exceptional", "Very good" etc
  
  raw JSONB,
  agent_run_id UUID REFERENCES governance.agent_runs(run_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE (comp_id, channel, shop_date)
);

CREATE INDEX idx_reviews_comp_channel ON revenue.competitor_reviews(comp_id, channel, shop_date DESC);

ALTER TABLE revenue.competitor_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_read" ON revenue.competitor_reviews FOR SELECT USING (true);

COMMENT ON TABLE revenue.competitor_reviews IS 'Per-channel review scores and counts. Scraped alongside rates by compset_agent. One row per property × channel × shop date.';

-- View: latest reviews per property × channel for the table display
CREATE OR REPLACE VIEW revenue.competitor_reviews_latest AS
SELECT DISTINCT ON (comp_id, channel)
  comp_id, channel, review_score, review_count, review_label, shop_date
FROM revenue.competitor_reviews
ORDER BY comp_id, channel, shop_date DESC;

-- View: aggregate review for property (weighted by count, used as primary display metric)
CREATE OR REPLACE VIEW revenue.competitor_reviews_summary AS
WITH latest AS (
  SELECT DISTINCT ON (comp_id, channel)
    comp_id, channel, review_score, review_count
  FROM revenue.competitor_reviews
  WHERE review_score IS NOT NULL AND review_count > 0
  ORDER BY comp_id, channel, shop_date DESC
)
SELECT
  comp_id,
  ROUND((SUM(review_score * review_count) / NULLIF(SUM(review_count), 0))::numeric, 1) AS weighted_score,
  SUM(review_count) AS total_reviews,
  COUNT(*) AS channels_with_reviews,
  jsonb_object_agg(channel, jsonb_build_object('score', review_score, 'count', review_count)) AS by_channel
FROM latest
GROUP BY comp_id;

COMMENT ON VIEW revenue.competitor_reviews_summary IS 'One row per property: weighted average review score across channels + total review count. Used as primary review metric in compset table.';
