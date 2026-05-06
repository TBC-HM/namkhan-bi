-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504212901
-- Name:    retreat_compiler_content_tables
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE TABLE IF NOT EXISTS content.series (
  slug              text PRIMARY KEY,
  name              text NOT NULL,
  name_lo           text,
  description_md    text,
  color_token       text,
  lunar_aware       boolean NOT NULL DEFAULT false,
  default_themes    text[] NOT NULL DEFAULT '{}',
  photo_urls        text[] NOT NULL DEFAULT '{}',
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS set_content_series_updated_at ON content.series;
CREATE TRIGGER set_content_series_updated_at BEFORE UPDATE ON content.series
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS content.lunar_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date        date NOT NULL UNIQUE,
  event_type        text NOT NULL CHECK (event_type IN ('full_moon','new_moon','first_quarter','last_quarter')),
  event_time_local  time,
  lunar_phase_pct   numeric,
  buddhist_holiday  text,
  description       text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lunar_events_date ON content.lunar_events(event_date);

CREATE TABLE IF NOT EXISTS content.usali_categories (
  slug              text PRIMARY KEY,
  display_name      text NOT NULL,
  usali_section     text NOT NULL,
  usali_department  text,
  is_revenue_center boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content.legal_pages (
  slug              text PRIMARY KEY,
  title             text NOT NULL,
  body_md           text NOT NULL,
  version           text NOT NULL,
  effective_date    date NOT NULL,
  supersedes_version text,
  language          text NOT NULL DEFAULT 'en',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS set_content_legal_pages_updated_at ON content.legal_pages;
CREATE TRIGGER set_content_legal_pages_updated_at BEFORE UPDATE ON content.legal_pages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();