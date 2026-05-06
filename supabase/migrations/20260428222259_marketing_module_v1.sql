-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260428222259
-- Name:    marketing_module_v1
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- =============================================================================
-- Marketing module v1
-- Tables: reviews, social_accounts, influencers, media_links
-- Read-only for anon (dashboard reads). Writes via authenticated/service role.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS marketing;

-- 1. REVIEWS — populated by email parser (Make.com / n8n flow)
CREATE TABLE IF NOT EXISTS marketing.reviews (
  id              bigserial PRIMARY KEY,
  source          text NOT NULL,                  -- google, tripadvisor, booking, expedia, agoda, slh, direct
  source_review_id text,                          -- platform's review ID if available, else NULL
  property_id     bigint NOT NULL DEFAULT 260955,
  reviewer_name   text,
  reviewer_country text,
  rating_raw      numeric(4,2),                   -- as given by source (1-5 or 1-10 scale)
  rating_scale    smallint DEFAULT 5,             -- 5 or 10
  rating_norm     numeric(4,2)
                  GENERATED ALWAYS AS (
                    CASE WHEN rating_scale = 10 THEN rating_raw / 2.0
                         ELSE rating_raw END
                  ) STORED,                       -- normalized to 0-5
  title           text,
  body            text,
  language        text,                           -- en, fr, etc
  reviewed_at     timestamptz,                    -- when guest wrote it
  received_at     timestamptz NOT NULL DEFAULT now(),  -- when our parser saw it
  stay_dates      daterange,                     -- check-in/out if available
  reservation_id  bigint,                        -- match on booking ref if possible
  response_status text NOT NULL DEFAULT 'unanswered'
                  CHECK (response_status IN ('unanswered','draft','responded','ignored')),
  responded_at    timestamptz,
  responded_by    text,
  response_text   text,
  is_verified     boolean DEFAULT false,
  raw             jsonb,                         -- full email payload from parser
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_review_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_source        ON marketing.reviews (source);
CREATE INDEX IF NOT EXISTS idx_reviews_received_at   ON marketing.reviews (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_status        ON marketing.reviews (response_status);
CREATE INDEX IF NOT EXISTS idx_reviews_rating_norm   ON marketing.reviews (rating_norm);

-- 2. SOCIAL ACCOUNTS — static config, you fill once
CREATE TABLE IF NOT EXISTS marketing.social_accounts (
  id              bigserial PRIMARY KEY,
  platform        text NOT NULL UNIQUE
                  CHECK (platform IN (
                    'instagram','facebook','tiktok',
                    'google_business','tripadvisor','booking',
                    'youtube','linkedin','x','threads','pinterest'
                  )),
  handle          text,                           -- @thenamkhan
  url             text,                           -- full link
  display_name    text,                           -- "The Namkhan"
  followers       int DEFAULT 0,
  following       int DEFAULT 0,
  posts           int DEFAULT 0,
  last_synced_at  timestamptz,
  notes           text,
  active          boolean DEFAULT true,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 3. INFLUENCERS — manual log of campaigns
CREATE TABLE IF NOT EXISTS marketing.influencers (
  id              bigserial PRIMARY KEY,
  name            text NOT NULL,
  handle          text,
  primary_platform text,                          -- instagram, tiktok, youtube
  reach           int,                            -- followers at time of stay
  niche           text,                           -- travel, luxury, wellness, food
  country         text,
  contact_email   text,
  stay_from       date,
  stay_to         date,
  comp_value_usd  numeric(10,2),                  -- value of comped stay
  paid_fee_usd    numeric(10,2) DEFAULT 0,
  deliverables    text,                           -- "3 reels, 1 grid post, 5 stories"
  delivered       boolean DEFAULT false,
  delivered_links text[],                         -- URLs to actual posts
  estimated_reach int,
  estimated_engagement int,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_influencers_stay_from ON marketing.influencers (stay_from);
CREATE INDEX IF NOT EXISTS idx_influencers_delivered ON marketing.influencers (delivered);

-- 4. MEDIA LINKS — pointers to Drive / Dropbox / wherever assets actually live
CREATE TABLE IF NOT EXISTS marketing.media_links (
  id              bigserial PRIMARY KEY,
  category        text NOT NULL
                  CHECK (category IN (
                    'photos','videos','reels','press_kit',
                    'logos','brand_guide','testimonials','other'
                  )),
  label           text NOT NULL,                  -- "2026 spring photoshoot"
  url             text NOT NULL,                  -- Drive folder or file
  description     text,
  added_by        text,
  added_at        timestamptz NOT NULL DEFAULT now(),
  active          boolean DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_media_category ON marketing.media_links (category);

-- =============================================================================
-- RLS — read-only for anon
-- =============================================================================
ALTER TABLE marketing.reviews          ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing.social_accounts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing.influencers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing.media_links      ENABLE ROW LEVEL SECURITY;

-- Anon read policies (property-scoped where applicable)
CREATE POLICY anon_read ON marketing.reviews
  FOR SELECT TO anon, authenticated
  USING (property_id = 260955);

CREATE POLICY anon_read ON marketing.social_accounts
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY anon_read ON marketing.influencers
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY anon_read ON marketing.media_links
  FOR SELECT TO anon, authenticated
  USING (active = true);

-- Service role can do anything (parser, admin)
GRANT USAGE ON SCHEMA marketing TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA marketing TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA marketing TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA marketing TO service_role;

-- Expose schema via PostgREST so frontend can read it
-- (You'll need to add 'marketing' to API → Exposed schemas in Supabase dashboard)
COMMENT ON SCHEMA marketing IS 'Marketing module: reviews, social, influencers, media links';