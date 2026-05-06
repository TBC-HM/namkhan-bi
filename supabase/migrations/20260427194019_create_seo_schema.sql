-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427194019
-- Name:    create_seo_schema
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE SCHEMA IF NOT EXISTS seo;

-- ───────────────────────────────────────────────────────────────
-- seo.queries_daily — keyword performance from Search Console
-- One row per (date, query, page, country, device)
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo.queries_daily (
  id              bigserial PRIMARY KEY,
  date            date NOT NULL,
  query           text NOT NULL,
  page            text NOT NULL,
  country         text,                  -- ISO-3 lowercase from GSC
  device          text,                  -- DESKTOP / MOBILE / TABLET
  impressions     int NOT NULL DEFAULT 0,
  clicks          int NOT NULL DEFAULT 0,
  ctr             numeric(8,6),          -- 0..1
  avg_position    numeric(6,2),          -- 1.0+
  is_branded      boolean GENERATED ALWAYS AS (lower(query) LIKE '%namkhan%' OR lower(query) LIKE '%nam khan%') STORED,
  imported_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (date, query, page, country, device)
);
CREATE INDEX IF NOT EXISTS idx_seo_queries_date ON seo.queries_daily(date);
CREATE INDEX IF NOT EXISTS idx_seo_queries_query ON seo.queries_daily(query);
CREATE INDEX IF NOT EXISTS idx_seo_queries_page ON seo.queries_daily(page);
CREATE INDEX IF NOT EXISTS idx_seo_queries_branded ON seo.queries_daily(is_branded) WHERE is_branded = TRUE;

-- ───────────────────────────────────────────────────────────────
-- seo.pages_daily — page-level rollup (less granular, faster queries)
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo.pages_daily (
  id              bigserial PRIMARY KEY,
  date            date NOT NULL,
  page            text NOT NULL,
  country         text,
  device          text,
  impressions     int NOT NULL DEFAULT 0,
  clicks          int NOT NULL DEFAULT 0,
  ctr             numeric(8,6),
  avg_position    numeric(6,2),
  imported_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (date, page, country, device)
);
CREATE INDEX IF NOT EXISTS idx_seo_pages_date ON seo.pages_daily(date);
CREATE INDEX IF NOT EXISTS idx_seo_pages_page ON seo.pages_daily(page);

-- ───────────────────────────────────────────────────────────────
-- seo.indexing_status — URL inspection / coverage report
-- One row per URL, updated on each refresh
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo.indexing_status (
  url                  text PRIMARY KEY,
  last_crawled         timestamptz,
  indexing_state       text,             -- INDEXING_ALLOWED / BLOCKED_BY_ROBOTS_TXT / BLOCKED_BY_META_TAG / etc
  coverage_state       text,             -- 'Submitted and indexed' / 'Crawled - currently not indexed' / 'Excluded' / etc
  page_fetch_state     text,             -- SUCCESSFUL / SOFT_404 / NOT_FOUND / ACCESS_DENIED / SERVER_ERROR
  robots_txt_state     text,
  google_canonical     text,             -- canonical URL Google chose
  user_canonical       text,             -- canonical you declared
  is_indexed           boolean,
  last_checked         timestamptz NOT NULL DEFAULT now(),
  notes                text
);
CREATE INDEX IF NOT EXISTS idx_seo_indexing_state ON seo.indexing_status(coverage_state);
CREATE INDEX IF NOT EXISTS idx_seo_indexing_indexed ON seo.indexing_status(is_indexed);

-- ───────────────────────────────────────────────────────────────
-- seo.core_web_vitals — performance + mobile usability
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo.core_web_vitals (
  id              bigserial PRIMARY KEY,
  date            date NOT NULL,
  url_pattern     text NOT NULL,         -- e.g. https://thenamkhan.com/rooms/*
  device          text NOT NULL,         -- MOBILE / DESKTOP
  metric_status   text NOT NULL,         -- GOOD / NEEDS_IMPROVEMENT / POOR
  lcp_ms          int,                   -- Largest Contentful Paint
  inp_ms          int,                   -- Interaction to Next Paint (replaced FID in 2024)
  cls             numeric(6,3),          -- Cumulative Layout Shift
  imported_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (date, url_pattern, device)
);
CREATE INDEX IF NOT EXISTS idx_seo_cwv_status ON seo.core_web_vitals(metric_status) WHERE metric_status <> 'GOOD';

-- ───────────────────────────────────────────────────────────────
-- VIEWS: decision-driving aggregates
-- ───────────────────────────────────────────────────────────────

-- Branded vs generic search performance
CREATE OR REPLACE VIEW seo.v_brand_vs_generic AS
SELECT
  date_trunc('month', date)::date AS month,
  CASE WHEN is_branded THEN 'branded' ELSE 'generic' END AS query_type,
  SUM(impressions) AS impressions,
  SUM(clicks) AS clicks,
  ROUND(SUM(clicks)::numeric / NULLIF(SUM(impressions),0) * 100, 2) AS ctr_pct,
  ROUND(AVG(avg_position)::numeric, 2) AS avg_position,
  COUNT(DISTINCT query) AS distinct_queries
FROM seo.queries_daily
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

-- Top revenue-driving queries (last 30 days)
CREATE OR REPLACE VIEW seo.v_top_queries_30d AS
SELECT
  query,
  SUM(impressions) AS impressions,
  SUM(clicks) AS clicks,
  ROUND(SUM(clicks)::numeric / NULLIF(SUM(impressions),0) * 100, 2) AS ctr_pct,
  ROUND(AVG(avg_position)::numeric, 2) AS avg_position,
  COUNT(DISTINCT page) AS pages_ranking,
  is_branded
FROM seo.queries_daily
WHERE date >= CURRENT_DATE - 30
GROUP BY query, is_branded
HAVING SUM(clicks) >= 1
ORDER BY clicks DESC
LIMIT 200;

-- "Page 2 wedge" — queries at position 4-10 with high impressions
-- These are 1 content tweak away from page 1
CREATE OR REPLACE VIEW seo.v_opportunity_queries AS
SELECT
  query,
  page,
  SUM(impressions) AS impressions_30d,
  SUM(clicks) AS clicks_30d,
  ROUND(AVG(avg_position)::numeric, 2) AS avg_position,
  ROUND(SUM(clicks)::numeric / NULLIF(SUM(impressions),0) * 100, 2) AS ctr_pct,
  CASE
    WHEN AVG(avg_position) BETWEEN 4 AND 10 AND SUM(impressions) >= 100
      THEN 'page_2_wedge'
    WHEN AVG(avg_position) <= 3 AND SUM(clicks)::float / NULLIF(SUM(impressions),0) < 0.02
      THEN 'top_3_low_ctr_fix_meta'
    WHEN AVG(avg_position) BETWEEN 11 AND 20 AND SUM(impressions) >= 200
      THEN 'page_3_high_volume_invest'
    ELSE 'normal'
  END AS opportunity
FROM seo.queries_daily
WHERE date >= CURRENT_DATE - 30
  AND is_branded = FALSE
GROUP BY query, page
HAVING SUM(impressions) >= 50
ORDER BY impressions_30d DESC;

-- Best pages by traffic
CREATE OR REPLACE VIEW seo.v_top_pages_30d AS
SELECT
  page,
  SUM(impressions) AS impressions,
  SUM(clicks) AS clicks,
  ROUND(SUM(clicks)::numeric / NULLIF(SUM(impressions),0) * 100, 2) AS ctr_pct,
  ROUND(AVG(avg_position)::numeric, 2) AS avg_position
FROM seo.pages_daily
WHERE date >= CURRENT_DATE - 30
GROUP BY page
ORDER BY clicks DESC;

-- Crawl health summary
CREATE OR REPLACE VIEW seo.v_crawl_issues AS
SELECT
  COALESCE(coverage_state, 'unknown') AS state,
  COALESCE(page_fetch_state, '-') AS fetch_state,
  COUNT(*) AS affected_urls,
  ARRAY(SELECT url FROM seo.indexing_status s2 
        WHERE s2.coverage_state = s.coverage_state 
          AND COALESCE(s2.page_fetch_state,'-') = COALESCE(s.page_fetch_state,'-')
        ORDER BY s2.last_checked DESC LIMIT 5) AS sample_urls
FROM seo.indexing_status s
WHERE coverage_state IS DISTINCT FROM 'Submitted and indexed'
   OR (page_fetch_state IS NOT NULL AND page_fetch_state <> 'SUCCESSFUL')
GROUP BY coverage_state, page_fetch_state
ORDER BY affected_urls DESC;

-- Country demand from search
CREATE OR REPLACE VIEW seo.v_country_search_demand AS
SELECT
  country,
  date_trunc('month', date)::date AS month,
  SUM(impressions) AS impressions,
  SUM(clicks) AS clicks,
  ROUND(SUM(clicks)::numeric / NULLIF(SUM(impressions),0) * 100, 2) AS ctr_pct,
  ROUND(AVG(avg_position)::numeric, 2) AS avg_position
FROM seo.queries_daily
WHERE country IS NOT NULL
GROUP BY country, 2
ORDER BY 2 DESC, impressions DESC;