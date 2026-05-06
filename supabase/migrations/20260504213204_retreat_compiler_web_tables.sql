-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504213204
-- Name:    retreat_compiler_web_tables
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE TABLE IF NOT EXISTS web.sites (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text NOT NULL UNIQUE,
  domain            text NOT NULL UNIQUE,
  property_id       text NOT NULL DEFAULT 'namkhan',
  site_type         text NOT NULL CHECK (site_type IN ('root','retreat','series','campaign','landing')),
  parent_site_id    uuid REFERENCES web.sites(id) ON DELETE SET NULL,
  theme_pack        text NOT NULL DEFAULT 'namkhan',
  brand_tokens      jsonb DEFAULT '{}',
  default_seo_jsonb jsonb DEFAULT '{}',
  favicon_url       text,
  og_image_url      text,
  ga4_id            text,
  meta_pixel_id     text,
  klaviyo_account_id text,
  is_active         boolean NOT NULL DEFAULT true,
  deployed_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS set_web_sites_updated_at ON web.sites;
CREATE TRIGGER set_web_sites_updated_at BEFORE UPDATE ON web.sites
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX IF NOT EXISTS idx_web_sites_active ON web.sites(is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS web.pages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           uuid NOT NULL REFERENCES web.sites(id) ON DELETE CASCADE,
  slug              text NOT NULL,
  full_path         text NOT NULL,
  page_type         text NOT NULL CHECK (page_type IN ('home','retreat','series','post','campaign_landing','legal','about','contact','press','faq','sitemap')),
  title             text NOT NULL,
  h1                text,
  meta_description  text,
  hero_jsonb        jsonb,
  body_md           text,
  modules_jsonb     jsonb DEFAULT '[]',
  seo_jsonb         jsonb DEFAULT '{}',
  og_jsonb          jsonb DEFAULT '{}',
  schema_org_jsonb  jsonb,
  canonical_url     text,
  status            text NOT NULL CHECK (status IN ('draft','review','live','archived')) DEFAULT 'draft',
  published_at      timestamptz,
  scheduled_for     timestamptz,
  expires_at        timestamptz,
  ab_test_id        uuid,
  ab_variant        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(site_id, full_path)
);
DROP TRIGGER IF EXISTS set_web_pages_updated_at ON web.pages;
CREATE TRIGGER set_web_pages_updated_at BEFORE UPDATE ON web.pages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX IF NOT EXISTS idx_web_pages_site_path ON web.pages(site_id, full_path);
CREATE INDEX IF NOT EXISTS idx_web_pages_live ON web.pages(site_id, page_type) WHERE status = 'live';

CREATE TABLE IF NOT EXISTS web.retreats (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            uuid NOT NULL REFERENCES compiler.runs(id) ON DELETE RESTRICT,
  variant_id        uuid NOT NULL REFERENCES compiler.variants(id) ON DELETE RESTRICT,
  site_id           uuid REFERENCES web.sites(id) ON DELETE SET NULL,
  slug              text NOT NULL UNIQUE,
  name              text NOT NULL,
  tagline           text,
  arrival_window_from date NOT NULL,
  arrival_window_to   date NOT NULL,
  spots_total       int NOT NULL,
  spots_booked      int NOT NULL DEFAULT 0,
  spots_remaining   int GENERATED ALWAYS AS (spots_total - spots_booked) STORED,
  price_usd_from    numeric NOT NULL,
  series_slug       text REFERENCES content.series(slug) ON DELETE SET NULL,
  hero_asset_id     uuid,
  gallery_asset_ids uuid[],
  status            text NOT NULL CHECK (status IN ('draft','published','sold_out','expired','cancelled')) DEFAULT 'draft',
  seo_jsonb         jsonb DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CHECK(arrival_window_to >= arrival_window_from)
);
DROP TRIGGER IF EXISTS set_web_retreats_updated_at ON web.retreats;
CREATE TRIGGER set_web_retreats_updated_at BEFORE UPDATE ON web.retreats
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX IF NOT EXISTS idx_web_retreats_status ON web.retreats(status, arrival_window_from);
CREATE INDEX IF NOT EXISTS idx_web_retreats_series ON web.retreats(series_slug);

CREATE TABLE IF NOT EXISTS web.retreats_versions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retreat_id        uuid NOT NULL REFERENCES web.retreats(id) ON DELETE CASCADE,
  run_id            uuid NOT NULL REFERENCES compiler.runs(id) ON DELETE RESTRICT,
  version           int NOT NULL,
  parent_version_id uuid REFERENCES web.retreats_versions(id) ON DELETE SET NULL,
  superseded_at     timestamptz,
  supersedes_url_redirect boolean DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(retreat_id, version)
);

CREATE TABLE IF NOT EXISTS web.series (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text NOT NULL UNIQUE REFERENCES content.series(slug) ON DELETE CASCADE,
  site_id           uuid REFERENCES web.sites(id) ON DELETE SET NULL,
  hub_page_id       uuid REFERENCES web.pages(id) ON DELETE SET NULL,
  total_retreats_run int NOT NULL DEFAULT 0,
  total_alumni      int NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS set_web_series_updated_at ON web.series;
CREATE TRIGGER set_web_series_updated_at BEFORE UPDATE ON web.series
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS web.posts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           uuid NOT NULL REFERENCES web.sites(id) ON DELETE CASCADE,
  slug              text NOT NULL,
  title             text NOT NULL,
  author_name       text,
  author_avatar_url text,
  excerpt           text,
  body_md           text,
  hero_asset_id     uuid,
  series_slug       text REFERENCES content.series(slug) ON DELETE SET NULL,
  related_retreat_ids uuid[],
  tags              text[] DEFAULT '{}',
  reading_time_min  int,
  status            text NOT NULL CHECK (status IN ('draft','review','live','archived')) DEFAULT 'draft',
  published_at      timestamptz,
  klaviyo_synced_at timestamptz,
  seo_jsonb         jsonb DEFAULT '{}',
  og_jsonb          jsonb DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(site_id, slug)
);
DROP TRIGGER IF EXISTS set_web_posts_updated_at ON web.posts;
CREATE TRIGGER set_web_posts_updated_at BEFORE UPDATE ON web.posts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX IF NOT EXISTS idx_web_posts_live ON web.posts(site_id, published_at DESC) WHERE status = 'live';
CREATE INDEX IF NOT EXISTS idx_web_posts_series ON web.posts(series_slug);
CREATE INDEX IF NOT EXISTS idx_web_posts_tags ON web.posts USING gin(tags);

CREATE TABLE IF NOT EXISTS web.campaigns (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  slug              text NOT NULL UNIQUE,
  campaign_type     text NOT NULL CHECK (campaign_type IN ('launch','nurture','reactivation','seasonal','evergreen','ad')),
  channel           text NOT NULL CHECK (channel IN ('email','paid_search','paid_social','organic','referral','direct')),
  target_audience_jsonb jsonb DEFAULT '{}',
  goal              text NOT NULL CHECK (goal IN ('lead','booking','nps','revenue')),
  goal_target       int,
  goal_value_usd    numeric,
  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  utm_content_default text,
  utm_term_default  text,
  budget_usd        numeric,
  spent_usd         numeric DEFAULT 0,
  starts_at         timestamptz,
  ends_at           timestamptz,
  linked_retreat_id uuid REFERENCES web.retreats(id) ON DELETE SET NULL,
  linked_series_slug text REFERENCES content.series(slug) ON DELETE SET NULL,
  klaviyo_flow_id   text,
  meta_campaign_id  text,
  google_ads_campaign_id text,
  status            text NOT NULL CHECK (status IN ('draft','scheduled','live','paused','completed')) DEFAULT 'draft',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS set_web_campaigns_updated_at ON web.campaigns;
CREATE TRIGGER set_web_campaigns_updated_at BEFORE UPDATE ON web.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX IF NOT EXISTS idx_web_campaigns_status ON web.campaigns(status, starts_at);

CREATE TABLE IF NOT EXISTS web.campaign_pages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       uuid NOT NULL REFERENCES web.campaigns(id) ON DELETE CASCADE,
  page_id           uuid NOT NULL REFERENCES web.pages(id) ON DELETE CASCADE,
  variant           text NOT NULL CHECK (variant IN ('A','B','C')),
  traffic_split_pct int NOT NULL DEFAULT 33,
  visits            int NOT NULL DEFAULT 0,
  conversions       int NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, variant)
);
DROP TRIGGER IF EXISTS set_web_campaign_pages_updated_at ON web.campaign_pages;
CREATE TRIGGER set_web_campaign_pages_updated_at BEFORE UPDATE ON web.campaign_pages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS web.ab_tests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  hypothesis        text,
  page_id           uuid REFERENCES web.pages(id) ON DELETE CASCADE,
  metric            text NOT NULL,
  started_at        timestamptz,
  ended_at          timestamptz,
  winner_variant    text,
  statistical_significance numeric,
  status            text NOT NULL CHECK (status IN ('running','stopped','inconclusive','winner_chosen')) DEFAULT 'running',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS set_web_ab_tests_updated_at ON web.ab_tests;
CREATE TRIGGER set_web_ab_tests_updated_at BEFORE UPDATE ON web.ab_tests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS web.subscribers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text NOT NULL UNIQUE,
  first_name        text,
  last_name         text,
  phone             text,
  country           text,
  source_page_id    uuid REFERENCES web.pages(id) ON DELETE SET NULL,
  source_campaign_id uuid REFERENCES web.campaigns(id) ON DELETE SET NULL,
  utm_jsonb         jsonb DEFAULT '{}',
  lifecycle_stage   text NOT NULL CHECK (lifecycle_stage IN ('new','engaged','qualified','customer','alumni','churned','unsubscribed')) DEFAULT 'new',
  interest_series   text[] DEFAULT '{}',
  language          text NOT NULL DEFAULT 'en',
  klaviyo_id        text,
  klaviyo_synced_at timestamptz,
  last_email_open_at timestamptz,
  last_email_click_at timestamptz,
  booking_count     int NOT NULL DEFAULT 0,
  ltv_usd           numeric NOT NULL DEFAULT 0,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS set_web_subscribers_updated_at ON web.subscribers;
CREATE TRIGGER set_web_subscribers_updated_at BEFORE UPDATE ON web.subscribers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX IF NOT EXISTS idx_web_subscribers_lifecycle ON web.subscribers(lifecycle_stage, last_email_open_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_subscribers_interest ON web.subscribers USING gin(interest_series);

CREATE TABLE IF NOT EXISTS web.consents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id     uuid NOT NULL REFERENCES web.subscribers(id) ON DELETE CASCADE,
  consent_type      text NOT NULL CHECK (consent_type IN ('marketing','analytics','cookies','whatsapp','sms')),
  granted           boolean NOT NULL,
  granted_at        timestamptz,
  revoked_at        timestamptz,
  ip_hash           text,
  user_agent        text,
  page_id           uuid REFERENCES web.pages(id) ON DELETE SET NULL,
  double_opt_in_token text UNIQUE,
  double_opt_in_confirmed_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_web_consents_sub ON web.consents(subscriber_id);

CREATE TABLE IF NOT EXISTS web.email_sends (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       uuid REFERENCES web.campaigns(id) ON DELETE SET NULL,
  subscriber_id     uuid NOT NULL REFERENCES web.subscribers(id) ON DELETE CASCADE,
  klaviyo_message_id text,
  sent_at           timestamptz,
  delivered_at      timestamptz,
  opened_at         timestamptz,
  clicked_at        timestamptz,
  bounced_at        timestamptz,
  unsubscribed_at   timestamptz,
  revenue_attributed_usd numeric NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_web_email_sends_sub ON web.email_sends(subscriber_id, sent_at DESC);

CREATE TABLE IF NOT EXISTS web.events (
  id                bigserial PRIMARY KEY,
  session_id        text,
  subscriber_id     uuid REFERENCES web.subscribers(id) ON DELETE SET NULL,
  event_type        text NOT NULL CHECK (event_type IN ('page_view','lead_capture','cta_click','video_play','scroll_depth','booking_start','booking_complete','configure_quote','configure_save','campaign_landing')),
  page_id           uuid REFERENCES web.pages(id) ON DELETE SET NULL,
  retreat_id        uuid REFERENCES web.retreats(id) ON DELETE SET NULL,
  campaign_id       uuid REFERENCES web.campaigns(id) ON DELETE SET NULL,
  ip_hash           text,
  country           text,
  device            text,
  referrer_url      text,
  value_usd         numeric,
  properties_jsonb  jsonb,
  occurred_at       timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_web_events_occurred ON web.events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_events_type ON web.events(event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_events_session ON web.events(session_id, occurred_at);

CREATE TABLE IF NOT EXISTS web.pages_history (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id           uuid NOT NULL REFERENCES web.pages(id) ON DELETE CASCADE,
  edited_by         uuid,
  field_path        text NOT NULL,
  value_before      jsonb,
  value_after       jsonb,
  edit_type         text NOT NULL CHECK (edit_type IN ('live','compile','rollback')),
  reverted_from_id  uuid REFERENCES web.pages_history(id) ON DELETE SET NULL,
  edited_at         timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_web_pages_history_page ON web.pages_history(page_id, edited_at DESC);

CREATE TABLE IF NOT EXISTS web.configurations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retreat_id        uuid NOT NULL REFERENCES web.retreats(id) ON DELETE CASCADE,
  share_token       text NOT NULL UNIQUE,
  config_jsonb      jsonb NOT NULL,
  total_usd         numeric NOT NULL,
  created_by_email  text,
  ip_hash           text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  converted_to_booking_id uuid
);
CREATE INDEX IF NOT EXISTS idx_web_configurations_token ON web.configurations(share_token);
CREATE INDEX IF NOT EXISTS idx_web_configurations_retreat ON web.configurations(retreat_id);