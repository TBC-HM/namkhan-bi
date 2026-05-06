-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260501163646
-- Name:    phase2_01_marketing_media_tables
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Core asset table
CREATE TABLE marketing.media_assets (
  asset_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id bigint NOT NULL DEFAULT 260955,
  sha256 text UNIQUE NOT NULL,
  phash text,
  original_filename text NOT NULL,
  asset_type marketing.asset_type NOT NULL,
  mime_type text NOT NULL,
  raw_path text,
  master_path text,
  width_px int,
  height_px int,
  duration_sec numeric,
  file_size_bytes bigint,
  captured_at timestamptz,
  gps_lat numeric,
  gps_lng numeric,
  camera_make text,
  camera_model text,
  lens text,
  photographer text,
  photographer_user_id uuid,
  license_type marketing.license_type NOT NULL DEFAULT 'owned',
  license_expiry date,
  usage_rights text[] DEFAULT ARRAY['web','social_organic','ota','email']::text[],
  do_not_modify bool NOT NULL DEFAULT false,
  has_identifiable_people bool DEFAULT false,
  consent_doc_id uuid,
  status marketing.asset_status NOT NULL DEFAULT 'ingested',
  qc_score numeric,
  qc_flags text[],
  caption text,
  alt_text text,
  room_type_id bigint REFERENCES public.room_types(room_type_id) ON DELETE SET NULL,
  property_area text,
  primary_tier marketing.usage_tier,
  secondary_tiers marketing.usage_tier[],
  ai_confidence numeric,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_assets_status      ON marketing.media_assets(status);
CREATE INDEX idx_media_assets_primary_tier ON marketing.media_assets(primary_tier);
CREATE INDEX idx_media_assets_room_type    ON marketing.media_assets(room_type_id);
CREATE INDEX idx_media_assets_captured     ON marketing.media_assets(captured_at DESC);
CREATE INDEX idx_media_assets_phash        ON marketing.media_assets(phash);
CREATE INDEX idx_media_assets_sec_tiers    ON marketing.media_assets USING GIN (secondary_tiers);
CREATE INDEX idx_media_assets_usage_rights ON marketing.media_assets USING GIN (usage_rights);

-- Render variants
CREATE TABLE marketing.media_renders (
  render_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES marketing.media_assets(asset_id) ON DELETE CASCADE,
  render_purpose marketing.render_purpose NOT NULL,
  width_px int NOT NULL,
  height_px int NOT NULL,
  file_path text NOT NULL,
  file_size_bytes bigint NOT NULL,
  format text NOT NULL,
  duration_sec numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, render_purpose)
);
CREATE INDEX idx_media_renders_asset ON marketing.media_renders(asset_id);

-- Controlled vocabulary
CREATE TABLE marketing.media_taxonomy (
  tag_id serial PRIMARY KEY,
  tag_slug text UNIQUE NOT NULL,
  tag_label text NOT NULL,
  category marketing.taxonomy_category NOT NULL,
  parent_tag_id int REFERENCES marketing.media_taxonomy(tag_id) ON DELETE SET NULL,
  synonyms text[] DEFAULT ARRAY[]::text[],
  is_active bool NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_media_taxonomy_category ON marketing.media_taxonomy(category);
CREATE INDEX idx_media_taxonomy_synonyms ON marketing.media_taxonomy USING GIN (synonyms);

-- Asset ↔ tag join
CREATE TABLE marketing.media_tags (
  asset_id uuid NOT NULL REFERENCES marketing.media_assets(asset_id) ON DELETE CASCADE,
  tag_id int NOT NULL REFERENCES marketing.media_taxonomy(tag_id) ON DELETE CASCADE,
  confidence numeric,
  source text NOT NULL CHECK (source IN ('ai','human','imported')),
  added_by uuid,
  added_at timestamptz DEFAULT now(),
  PRIMARY KEY (asset_id, tag_id)
);
CREATE INDEX idx_media_tags_tag   ON marketing.media_tags(tag_id);
CREATE INDEX idx_media_tags_asset ON marketing.media_tags(asset_id);

-- Free-text keywords (AI overflow when no taxonomy match)
CREATE TABLE marketing.media_keywords_free (
  keyword_id serial PRIMARY KEY,
  asset_id uuid NOT NULL REFERENCES marketing.media_assets(asset_id) ON DELETE CASCADE,
  keyword text NOT NULL,
  source text NOT NULL CHECK (source IN ('ai','human')),
  promoted_to_tag_id int REFERENCES marketing.media_taxonomy(tag_id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_media_keywords_kw    ON marketing.media_keywords_free(keyword);
CREATE INDEX idx_media_keywords_asset ON marketing.media_keywords_free(asset_id);

-- Where each asset has been published
CREATE TABLE marketing.media_usage_log (
  log_id bigserial PRIMARY KEY,
  asset_id uuid NOT NULL REFERENCES marketing.media_assets(asset_id) ON DELETE CASCADE,
  used_in text NOT NULL,
  external_ref text,
  campaign_name text,
  used_at timestamptz NOT NULL DEFAULT now(),
  used_by uuid,
  used_by_agent text
);
CREATE INDEX idx_media_usage_asset ON marketing.media_usage_log(asset_id);
CREATE INDEX idx_media_usage_at    ON marketing.media_usage_log(used_at DESC);
CREATE INDEX idx_media_usage_in    ON marketing.media_usage_log(used_in);

-- Curated sets (lookbooks, OTA submissions, campaigns)
CREATE TABLE marketing.media_collections (
  collection_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  purpose text,
  description text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE marketing.media_collection_items (
  collection_id uuid NOT NULL REFERENCES marketing.media_collections(collection_id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES marketing.media_assets(asset_id) ON DELETE CASCADE,
  display_order int,
  added_at timestamptz DEFAULT now(),
  PRIMARY KEY (collection_id, asset_id)
);

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION marketing.media_assets_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_media_assets_updated
  BEFORE UPDATE ON marketing.media_assets
  FOR EACH ROW EXECUTE FUNCTION marketing.media_assets_set_updated_at();
