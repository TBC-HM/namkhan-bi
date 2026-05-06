-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503152205
-- Name:    rate_shop_comp_sets_restructure
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Delete phantom sets that depended on Cloudbeds API data we don't actually have
-- competitor_property rows + their FKs (no rates exist yet — table is empty)
DELETE FROM revenue.competitor_property 
WHERE set_id IN (
  SELECT set_id FROM revenue.competitor_set 
  WHERE set_name IN ('Cloudbeds PMS comp set', 'Booking.com Rate Insights')
);

DELETE FROM revenue.competitor_set
WHERE set_name IN ('Cloudbeds PMS comp set', 'Booking.com Rate Insights');

-- Rename existing manual set to Local
UPDATE revenue.competitor_set
SET set_name = 'Local — manual (Luang Prabang)',
    notes = 'You-curated competitor set in Luang Prabang. Populated via app upload path.',
    updated_at = now()
WHERE set_name = 'Manual strategic peers';

-- Rename existing combined AI-proposed set to Local AI-proposed
UPDATE revenue.competitor_set
SET set_name = 'Local — AI proposed (Luang Prabang)',
    notes = 'Comp candidates proposed by comp-discovery agent. Each entry must be approved via governance.proposals before activation.',
    updated_at = now()
WHERE set_name = 'AI proposed (local + regional)';

-- Add the two missing sets: Regional manual + Regional AI-proposed
INSERT INTO revenue.competitor_set (property_id, set_name, set_type, source, is_active, is_primary, notes)
VALUES
  (260955, 'Regional — manual (SE Asia)', 'manual', 'user_upload', true, false,
   'You-curated regional competitor set across SE Asia. Populated via app upload path.'),
  (260955, 'Regional — AI proposed (SE Asia)', 'ai_proposed', 'agent_discovery', true, false,
   'Regional comp candidates proposed by comp-discovery agent. Each entry must be approved via governance.proposals before activation.');

-- Add Namkhan as is_self=true to the two new sets
INSERT INTO revenue.competitor_property (
  set_id, property_name, star_rating, rooms, city, country,
  is_self, is_active, scrape_priority, notes
)
SELECT 
  cs.set_id,
  'The Namkhan', 4, 20, 'Luang Prabang', 'Laos',
  true, true, 1,
  'Self-reference row. Rate-shop agent scrapes our public OTA prices on same channels as comp set.'
FROM revenue.competitor_set cs
WHERE cs.set_name IN ('Regional — manual (SE Asia)', 'Regional — AI proposed (SE Asia)')
  AND NOT EXISTS (
    SELECT 1 FROM revenue.competitor_property cp
    WHERE cp.set_id = cs.set_id AND cp.is_self = true
  );
