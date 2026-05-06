-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502230637
-- Name:    phase1_15a_social_accounts_platforms_extend
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Original constraint missed major OTAs. Replace with extended list.
ALTER TABLE marketing.social_accounts
  DROP CONSTRAINT IF EXISTS social_accounts_platform_check;

ALTER TABLE marketing.social_accounts
  ADD CONSTRAINT social_accounts_platform_check
  CHECK (platform = ANY (ARRAY[
    -- Social
    'instagram','facebook','tiktok','youtube','linkedin','x','threads','pinterest',
    -- Reviews
    'tripadvisor','google_business','trustpilot',
    -- OTAs
    'booking','expedia','agoda','hotels_com','trip_com','airbnb','despegar',
    -- Brand programs
    'slh','hilton_honors',
    -- Messaging
    'whatsapp_business','line_oa','wechat_oa'
  ]));

COMMENT ON CONSTRAINT social_accounts_platform_check ON marketing.social_accounts IS
  'Allowed platforms grouped by purpose: social, reviews, OTAs, brand programs, messaging.';