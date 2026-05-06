-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502230843
-- Name:    phase1_15b_brand_identity_fields
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Extend property_profile with proper brand identity columns.
-- Single brand_color_hex was naive — real brand kits have palette + typography stack.

ALTER TABLE marketing.property_profile
  ADD COLUMN IF NOT EXISTS brand_palette        jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS brand_typography     jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS brand_logo_variants  jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS brand_assets_url     text;

COMMENT ON COLUMN marketing.property_profile.brand_palette IS
  'Array of color objects: [{name, hex, role, usage}]. Roles: primary, secondary, accent, neutral, dark, light.';
COMMENT ON COLUMN marketing.property_profile.brand_typography IS
  'Object with display, body, accent font specs: {display: {family, weight, source}, body: {...}}';
COMMENT ON COLUMN marketing.property_profile.brand_logo_variants IS
  'URLs for each logo variant: {full, icon, horizontal, favicon, monogram, highlights{...}}';
COMMENT ON COLUMN marketing.property_profile.brand_assets_url IS
  'Link to the brand kit / CI document (PDF, Figma, Drive folder).';