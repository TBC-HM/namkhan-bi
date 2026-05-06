-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260501212650
-- Name:    phase2_compset_schema
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- =====================================================================
-- Migration: phase2_compset_schema
-- Purpose : Real competitor-set tables for /revenue/compset.
--           Replaces hardcoded mockup with one schema that handles all
--           four sources (PMS, BDC Rate Insights, Manual, AI Proposed).
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS revenue;

-- ---------------------------------------------------------------------
-- competitor_set: a named bundle of peer properties
-- ---------------------------------------------------------------------
CREATE TABLE revenue.competitor_set (
  set_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   bigint NOT NULL,
  set_name      text NOT NULL,
  set_type      text NOT NULL CHECK (set_type IN ('manual','pms','bdc_rate_insights','external_feed','ai_proposed')),
  source        text,
  is_primary    boolean DEFAULT false,
  is_active     boolean DEFAULT true,
  notes         text,
  created_by    uuid,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (property_id, set_name)
);
COMMENT ON TABLE revenue.competitor_set IS
  'Named comp set. set_type drives where rates come from.';

-- ---------------------------------------------------------------------
-- competitor_property: a peer hotel inside a set
-- ---------------------------------------------------------------------
CREATE TABLE revenue.competitor_property (
  comp_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id        uuid NOT NULL REFERENCES revenue.competitor_set(set_id) ON DELETE CASCADE,
  property_name text NOT NULL,
  star_rating   smallint CHECK (star_rating BETWEEN 1 AND 5),
  rooms         smallint,
  city          text,
  country       text,
  bdc_url       text,
  bdc_property_id text,
  expedia_url   text,
  google_place_id text,
  is_active     boolean DEFAULT true,
  notes         text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
CREATE INDEX competitor_property_set_idx ON revenue.competitor_property(set_id);

-- ---------------------------------------------------------------------
-- competitor_rates: time-series of observed rates per peer
-- ---------------------------------------------------------------------
CREATE TABLE revenue.competitor_rates (
  rate_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id       uuid NOT NULL REFERENCES revenue.competitor_property(comp_id) ON DELETE CASCADE,
  stay_date     date NOT NULL,
  shop_date     date NOT NULL,
  channel       text,
  rate_lak      numeric,
  rate_usd      numeric,
  currency      text,
  is_available  boolean,
  min_los       smallint,
  occupancy     numeric,
  raw           jsonb,
  source        text,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (comp_id, stay_date, shop_date, channel)
);
CREATE INDEX competitor_rates_stay_idx ON revenue.competitor_rates(stay_date);
CREATE INDEX competitor_rates_shop_idx ON revenue.competitor_rates(shop_date);

-- ---------------------------------------------------------------------
-- Seed: migrate the 5 hardcoded mockup properties to a real "PMS" set
--       so the existing UI keeps showing them, but now from the DB.
--       Then create empty placeholders for the other 3 sources.
-- ---------------------------------------------------------------------
INSERT INTO revenue.competitor_set
  (property_id, set_name, set_type, source, is_primary, notes)
VALUES
  (260955, 'Cloudbeds PMS comp set', 'pms', 'cloudbeds_settings', false,
   'Static config from Cloudbeds Settings → Compset. Not refreshed automatically — Cloudbeds API does not expose a comp-set rates endpoint.'),
  (260955, 'Manual strategic peers', 'manual', 'owner', true,
   'Curated by owner / revenue manager. Source of truth for strategic decisions.'),
  (260955, 'Booking.com Rate Insights', 'bdc_rate_insights', 'booking.com', false,
   'Placeholder. Requires BDC extranet Rate Insights enabled + manual export → import.'),
  (260955, 'AI proposed (local + regional)', 'ai_proposed', 'vertex_ai', false,
   'Placeholder for Phase 4 — Vertex-generated peer suggestions.');

-- Seed PMS set with the 5 properties currently shown in the UI
WITH pms AS (
  SELECT set_id FROM revenue.competitor_set
  WHERE property_id = 260955 AND set_type = 'pms'
)
INSERT INTO revenue.competitor_property
  (set_id, property_name, star_rating, rooms, city, country)
SELECT pms.set_id, v.property_name, v.star_rating, v.rooms, 'Luang Prabang', 'Laos'
FROM pms,
(VALUES
  ('Avani+ Luang Prabang', 5, 53),
  ('3 Nagas Luang Prabang', 4, 15),
  ('Satri House',          4, 31),
  ('Mekong Estate',        4, 12),
  ('Sofitel Luang Prabang',5, 25)
) AS v(property_name, star_rating, rooms);

-- Seed Manual Strategic with the obvious top-end / boutique peers
WITH man AS (
  SELECT set_id FROM revenue.competitor_set
  WHERE property_id = 260955 AND set_type = 'manual'
)
INSERT INTO revenue.competitor_property
  (set_id, property_name, star_rating, rooms, city, country, notes)
SELECT man.set_id, v.property_name, v.star_rating, v.rooms, 'Luang Prabang', 'Laos', v.notes
FROM man,
(VALUES
  ('Rosewood Luang Prabang',          5, 23, 'Top-end direct competitor — hilltop villas'),
  ('Avani+ Luang Prabang',            5, 53, 'Largest 5-star, town centre'),
  ('Satri House',                     4, 31, 'Boutique heritage, Soho-aligned aesthetic'),
  ('Maison Souvannaphoum Hotel',      4, 24, 'Heritage 4-star, central'),
  ('Le Sen Boutique Hotel',           4, 22, 'Comparable scale, riverside'),
  ('3 Nagas Luang Prabang',           4, 15, 'Heritage, town centre, smaller'),
  ('Sofitel Luang Prabang',           5, 25, 'Top-end heritage, brand peer')
) AS v(property_name, star_rating, rooms, notes);

-- ---------------------------------------------------------------------
-- View: v_compset_overview — feeds the source cards on /revenue/compset
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW revenue.v_compset_overview AS
SELECT
  cs.set_id,
  cs.property_id,
  cs.set_name,
  cs.set_type,
  cs.source,
  cs.is_primary,
  cs.is_active,
  COUNT(cp.comp_id) FILTER (WHERE cp.is_active) AS properties_tracked,
  MAX(cr.shop_date)                              AS last_rate_shop,
  CASE
    WHEN MAX(cr.shop_date) IS NULL THEN 'no_data'
    WHEN MAX(cr.shop_date) >= current_date - interval '2 days' THEN 'fresh'
    WHEN MAX(cr.shop_date) >= current_date - interval '14 days' THEN 'aging'
    ELSE 'stale'
  END                                             AS freshness,
  cs.notes,
  cs.updated_at
FROM revenue.competitor_set cs
LEFT JOIN revenue.competitor_property cp ON cp.set_id = cs.set_id
LEFT JOIN revenue.competitor_rates cr    ON cr.comp_id = cp.comp_id
GROUP BY cs.set_id;

COMMENT ON VIEW revenue.v_compset_overview IS
  'One row per comp set with property count + freshness. Feeds /revenue/compset source cards.';

-- ---------------------------------------------------------------------
-- View: v_compset_properties — feeds the table on /revenue/compset
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW revenue.v_compset_properties AS
SELECT
  cp.comp_id,
  cs.set_id,
  cs.set_name,
  cs.set_type,
  cs.property_id,
  cp.property_name,
  cp.star_rating,
  cp.rooms,
  cp.city,
  cp.country,
  cp.bdc_url,
  cp.is_active,
  -- latest observed rate (any channel)
  latest.stay_date  AS latest_stay_date,
  latest.shop_date  AS latest_shop_date,
  latest.rate_usd   AS latest_rate_usd,
  latest.rate_lak   AS latest_rate_lak,
  latest.channel    AS latest_channel,
  -- 30-day forward avg per peer (USD)
  avg30.avg_rate_usd_30d,
  avg30.observations_30d
FROM revenue.competitor_property cp
JOIN revenue.competitor_set cs ON cs.set_id = cp.set_id
LEFT JOIN LATERAL (
  SELECT cr.stay_date, cr.shop_date, cr.rate_usd, cr.rate_lak, cr.channel
  FROM revenue.competitor_rates cr
  WHERE cr.comp_id = cp.comp_id
  ORDER BY cr.shop_date DESC, cr.stay_date DESC
  LIMIT 1
) latest ON TRUE
LEFT JOIN LATERAL (
  SELECT AVG(cr.rate_usd) AS avg_rate_usd_30d, COUNT(*) AS observations_30d
  FROM revenue.competitor_rates cr
  WHERE cr.comp_id = cp.comp_id
    AND cr.stay_date BETWEEN current_date AND current_date + interval '30 days'
    AND cr.is_available = TRUE
) avg30 ON TRUE;

-- ---------------------------------------------------------------------
-- RLS — same pattern as ops.* (anon: deny; authenticated: read)
-- ---------------------------------------------------------------------
ALTER TABLE revenue.competitor_set      ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue.competitor_property ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue.competitor_rates    ENABLE ROW LEVEL SECURITY;

CREATE POLICY compset_set_read       ON revenue.competitor_set
  FOR SELECT TO authenticated USING (true);
CREATE POLICY compset_property_read  ON revenue.competitor_property
  FOR SELECT TO authenticated USING (true);
CREATE POLICY compset_rates_read     ON revenue.competitor_rates
  FOR SELECT TO authenticated USING (true);

-- Owner write policies (you, by user_id, can edit). Replace owner uuid later.
CREATE POLICY compset_set_write       ON revenue.competitor_set
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY compset_property_write  ON revenue.competitor_property
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY compset_rates_write     ON revenue.competitor_rates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Expose for PostgREST
GRANT USAGE ON SCHEMA revenue TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA revenue TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA revenue TO authenticated;
