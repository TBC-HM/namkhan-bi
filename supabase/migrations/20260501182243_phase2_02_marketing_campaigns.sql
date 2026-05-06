-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260501182243
-- Name:    phase2_02_marketing_campaigns
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Phase 2 · Campaign workflow tables
-- Adds 2 enums, 3 tables, 1 view, RLS policies. Seeds 17 templates.

-- Enums --------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE marketing.campaign_channel AS ENUM (
    'instagram_post','instagram_carousel','instagram_reel','instagram_story',
    'facebook_post','tiktok','email_header','email_full',
    'booking_com_gallery','expedia_gallery','agoda_gallery','slh_gallery',
    'website_hero','pdf_offer','print_poster','blog_header','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE marketing.campaign_status AS ENUM (
    'draft','curating','composing','pending_approval','approved',
    'scheduled','published','archived','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- campaign_templates -------------------------------------------------
CREATE TABLE IF NOT EXISTS marketing.campaign_templates (
  template_id          serial PRIMARY KEY,
  channel              marketing.campaign_channel NOT NULL,
  name                 text NOT NULL,
  aspect_ratio         text NOT NULL,
  output_width         int NOT NULL,
  output_height        int NOT NULL,
  min_assets           int NOT NULL DEFAULT 1,
  max_assets           int NOT NULL DEFAULT 1,
  caption_max_chars    int,
  hashtag_max          int,
  license_filter       text[] DEFAULT '{}',
  logo_position        text DEFAULT 'bottom-right',
  template_json        jsonb DEFAULT '{}'::jsonb,
  is_active            bool NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- campaigns ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS marketing.campaigns (
  campaign_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text NOT NULL,
  channel              marketing.campaign_channel NOT NULL,
  template_id          int REFERENCES marketing.campaign_templates(template_id),
  brief_text           text,
  vibe_tags            text[] DEFAULT '{}',
  caption              text,
  hashtags             text[] DEFAULT '{}',
  status               marketing.campaign_status NOT NULL DEFAULT 'draft',
  scheduled_at         timestamptz,
  published_at         timestamptz,
  external_post_url    text,
  performance_json     jsonb,
  approved_by          uuid,
  approved_at          timestamptz,
  created_by           uuid,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status   ON marketing.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_channel  ON marketing.campaigns(channel);
CREATE INDEX IF NOT EXISTS idx_campaigns_sched    ON marketing.campaigns(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_creator  ON marketing.campaigns(created_by);

-- campaign_assets (M2M with slot order) ------------------------------
CREATE TABLE IF NOT EXISTS marketing.campaign_assets (
  campaign_id          uuid NOT NULL REFERENCES marketing.campaigns(campaign_id) ON DELETE CASCADE,
  slot_order           int  NOT NULL,
  asset_id             uuid NOT NULL REFERENCES marketing.media_assets(asset_id),
  caption_per_slot     text,
  alt_text_per_slot    text,
  final_render_path    text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, slot_order)
);

CREATE INDEX IF NOT EXISTS idx_campaign_assets_asset ON marketing.campaign_assets(asset_id);

-- v_campaign_calendar view -------------------------------------------
CREATE OR REPLACE VIEW marketing.v_campaign_calendar AS
SELECT
  c.campaign_id,
  c.name,
  c.channel,
  c.status,
  COALESCE(c.scheduled_at, c.published_at, c.created_at) AS calendar_at,
  c.scheduled_at,
  c.published_at,
  c.created_at,
  (SELECT count(*) FROM marketing.campaign_assets ca WHERE ca.campaign_id = c.campaign_id) AS asset_count,
  c.created_by,
  c.brief_text,
  c.vibe_tags,
  c.caption,
  c.hashtags,
  c.template_id
FROM marketing.campaigns c
WHERE c.status NOT IN ('archived','cancelled');

-- updated_at triggers ------------------------------------------------
CREATE OR REPLACE FUNCTION marketing.tg_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_campaigns_updated_at ON marketing.campaigns;
CREATE TRIGGER tg_campaigns_updated_at
  BEFORE UPDATE ON marketing.campaigns
  FOR EACH ROW EXECUTE FUNCTION marketing.tg_campaigns_updated_at();

DROP TRIGGER IF EXISTS tg_campaign_templates_updated_at ON marketing.campaign_templates;
CREATE TRIGGER tg_campaign_templates_updated_at
  BEFORE UPDATE ON marketing.campaign_templates
  FOR EACH ROW EXECUTE FUNCTION marketing.tg_campaigns_updated_at();

-- RLS ----------------------------------------------------------------
ALTER TABLE marketing.campaigns          ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing.campaign_assets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing.campaign_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read campaigns" ON marketing.campaigns;
CREATE POLICY "auth read campaigns" ON marketing.campaigns
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth write campaigns" ON marketing.campaigns;
CREATE POLICY "auth write campaigns" ON marketing.campaigns
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth read campaign_assets" ON marketing.campaign_assets;
CREATE POLICY "auth read campaign_assets" ON marketing.campaign_assets
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth write campaign_assets" ON marketing.campaign_assets;
CREATE POLICY "auth write campaign_assets" ON marketing.campaign_assets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth read templates" ON marketing.campaign_templates;
CREATE POLICY "auth read templates" ON marketing.campaign_templates
  FOR SELECT TO authenticated USING (true);

-- anonymous read for the BI dashboard (single-property pilot phase, no auth yet)
DROP POLICY IF EXISTS "anon read campaigns" ON marketing.campaigns;
CREATE POLICY "anon read campaigns" ON marketing.campaigns
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon read campaign_assets" ON marketing.campaign_assets;
CREATE POLICY "anon read campaign_assets" ON marketing.campaign_assets
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon read templates" ON marketing.campaign_templates;
CREATE POLICY "anon read templates" ON marketing.campaign_templates
  FOR SELECT TO anon USING (true);

-- Grant view access (authenticator role uses these views via PostgREST)
GRANT USAGE ON SCHEMA marketing TO anon, authenticated;
GRANT SELECT ON marketing.v_campaign_calendar TO anon, authenticated;
GRANT SELECT ON marketing.campaign_templates TO anon, authenticated;