-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260501182411
-- Name:    phase2_04_public_marketing_views
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Public-schema views that mirror marketing.* so the Next.js app can read via
-- supabase-js without PostgREST exposed-schemas config changes.
-- All views are SECURITY INVOKER (default) — RLS on the underlying marketing.* tables still applies.

CREATE OR REPLACE VIEW public.mkt_media_assets AS
  SELECT * FROM marketing.media_assets;

CREATE OR REPLACE VIEW public.mkt_media_renders AS
  SELECT * FROM marketing.media_renders;

CREATE OR REPLACE VIEW public.mkt_media_taxonomy AS
  SELECT * FROM marketing.media_taxonomy;

CREATE OR REPLACE VIEW public.mkt_media_tags AS
  SELECT * FROM marketing.media_tags;

CREATE OR REPLACE VIEW public.mkt_media_keywords_free AS
  SELECT * FROM marketing.media_keywords_free;

CREATE OR REPLACE VIEW public.mkt_media_usage_log AS
  SELECT * FROM marketing.media_usage_log;

CREATE OR REPLACE VIEW public.mkt_v_media_ready AS
  SELECT * FROM marketing.v_media_ready;

CREATE OR REPLACE VIEW public.mkt_v_media_by_tier AS
  SELECT * FROM marketing.v_media_by_tier;

CREATE OR REPLACE VIEW public.mkt_v_media_unused_freshness AS
  SELECT * FROM marketing.v_media_unused_freshness;

CREATE OR REPLACE VIEW public.mkt_campaigns AS
  SELECT * FROM marketing.campaigns;

CREATE OR REPLACE VIEW public.mkt_campaign_assets AS
  SELECT * FROM marketing.campaign_assets;

CREATE OR REPLACE VIEW public.mkt_campaign_templates AS
  SELECT * FROM marketing.campaign_templates;

CREATE OR REPLACE VIEW public.mkt_v_campaign_calendar AS
  SELECT * FROM marketing.v_campaign_calendar;

GRANT SELECT ON
  public.mkt_media_assets,
  public.mkt_media_renders,
  public.mkt_media_taxonomy,
  public.mkt_media_tags,
  public.mkt_media_keywords_free,
  public.mkt_media_usage_log,
  public.mkt_v_media_ready,
  public.mkt_v_media_by_tier,
  public.mkt_v_media_unused_freshness,
  public.mkt_campaigns,
  public.mkt_campaign_assets,
  public.mkt_campaign_templates,
  public.mkt_v_campaign_calendar
TO anon, authenticated;