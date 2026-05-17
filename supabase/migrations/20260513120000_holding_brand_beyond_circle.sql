-- 20260513120000_holding_brand_beyond_circle.sql
-- PBS Apple note #31 (2026-05-13): introduce the Holding scope row.
--
-- The Beyond Circle is the holding-level brand (Felix is its AI CEO).
-- Per the existing property.brand pattern, this seeds a row for the
-- sentinel property_id = 0 so any consumer that reads property.brand
-- by property_id resolves to the canonical Beyond Circle palette.
--
-- Roles + hex values were extracted from the live site
-- (https://thebeyondcircle.com/) on 2026-05-13 via Chrome DevTools
-- evaluate_script on the rendered DOM:
--   accent      #F7AC67  (peach/amber — H1 heading + button bg)
--   primary     #002428  (deep teal-black — H2 + page ink)
--   secondary   #29818D  (teal — links, motif accents)
--   background  #F0F8FF  (alice-white — page canvas)
--   surface     #FFFFFF  (cards / panels)
--   ink         #001C22  (strongest text)
--   neutral     #4A6770  (muted text)
--
-- The CSS-side tokens are mirrored in styles/globals.css under the
-- :root[data-property='holding'] selector so the page renders before
-- this row is read — but this row remains the source of truth and
-- powers any future ThemeInjector-driven flows.

-- Holding registry row (no PMS, no credentials — Felix surface only).
-- core.properties already exists from the multitenant phase 2.1
-- migration; the holding row uses property_id = 0 as the sentinel.
INSERT INTO core.properties
  (property_id, code, name, pms_provider, pms_property_id, base_currency, timezone, status)
VALUES
  (0, 'holding', 'Beyond Circle', 'none', NULL, 'USD', 'Europe/London', 'active')
ON CONFLICT (property_id) DO UPDATE
  SET code = EXCLUDED.code,
      name = EXCLUDED.name,
      pms_provider = EXCLUDED.pms_provider,
      base_currency = EXCLUDED.base_currency,
      timezone = EXCLUDED.timezone,
      status = EXCLUDED.status,
      updated_at = now();

-- Brand seed. property.brand is the table read by
-- app/h/[property_id]/layout.tsx — using INSERT ... ON CONFLICT so the
-- migration is idempotent on re-runs and safe to apply over an existing
-- row authored manually.
INSERT INTO property.brand (property_id, brand_palette, logo_url)
VALUES (
  0,
  '[
    {"name": "Peach",        "hex": "#F7AC67", "role": "accent",     "usage": "headlines, primary CTA bg"},
    {"name": "Deep Teal",    "hex": "#002428", "role": "primary",    "usage": "page ink, h2"},
    {"name": "Teal",         "hex": "#29818D", "role": "secondary",  "usage": "links, motif"},
    {"name": "Alice White",  "hex": "#F0F8FF", "role": "background", "usage": "page canvas"},
    {"name": "Paper",        "hex": "#FFFFFF", "role": "surface",    "usage": "cards, panels"},
    {"name": "Ink",          "hex": "#001C22", "role": "neutral_dark","usage": "strongest text"},
    {"name": "Slate",        "hex": "#4A6770", "role": "neutral",    "usage": "muted text"},
    {"name": "Mist",         "hex": "#E4EFF6", "role": "neutral_light","usage": "elevated surface"}
  ]'::jsonb,
  NULL
)
ON CONFLICT (property_id) DO UPDATE
  SET brand_palette = EXCLUDED.brand_palette,
      logo_url = COALESCE(property.brand.logo_url, EXCLUDED.logo_url);

COMMENT ON COLUMN property.brand.brand_palette IS
  'Array of color objects: [{name, hex, role, usage}]. Roles: primary, secondary, accent, background, surface, neutral, neutral_dark, neutral_light. Holding (property_id=0) carries the Beyond Circle palette.';
