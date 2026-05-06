-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503154250
-- Name:    local_comp_set_replace_with_booking_10
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Replace the 7 existing comps in Local set with the 10 from Booking.com Competitor Comparison
-- Self-row (Namkhan) preserved untouched.

-- Step 1: delete existing non-self comps
DELETE FROM revenue.competitor_property
WHERE set_id = 'cec443e9-e63c-4786-9e86-905120101542'
  AND is_self = false;

-- Step 2: insert the 10 from Booking's competitor comparison view
INSERT INTO revenue.competitor_property (
  set_id, property_name, star_rating, rooms, city, country,
  is_active, is_self, scrape_priority, notes
)
VALUES
  -- Ranked order from Booking's screenshot
  ('cec443e9-e63c-4786-9e86-905120101542', 'Maison Dalabua',                                    4, NULL, 'Luang Prabang', 'Laos', true, false, 2, 'Booking comp #1 (review 9.5). Boutique. Likely no Trip/Traveloka — verify.'),
  ('cec443e9-e63c-4786-9e86-905120101542', 'The Belle Rive Boutique Hotel',                    4, NULL, 'Luang Prabang', 'Laos', true, false, 3, 'Booking comp #2 (review 9.5). Boutique. Likely no functional direct booking engine.'),
  ('cec443e9-e63c-4786-9e86-905120101542', 'Burasari Heritage Luang Prabang',                  4, NULL, 'Luang Prabang', 'Laos', true, false, 2, 'Booking comp #3 (review 9.1).'),
  ('cec443e9-e63c-4786-9e86-905120101542', 'U Luang Prabang',                                  4, NULL, 'Luang Prabang', 'Laos', true, false, 2, 'Booking comp #4 (review 8.8). U Hotels chain — direct booking engine likely available.'),
  ('cec443e9-e63c-4786-9e86-905120101542', '3 Nagas Luang Prabang - MGallery',                 4, 15,   'Luang Prabang', 'Laos', true, false, 1, 'Booking comp #5 (review 9.0). MGallery (Accor). Direct via all.accor.com.'),
  ('cec443e9-e63c-4786-9e86-905120101542', 'Homm Souvannaphoum Luang Prabang',                 4, NULL, 'Luang Prabang', 'Laos', true, false, 1, 'Booking comp #6 (review 9.3). Banyan Group. Direct booking via banyangroup or Homm site.'),
  ('cec443e9-e63c-4786-9e86-905120101542', 'Satri House',                                       4, 31,   'Luang Prabang', 'Laos', true, false, 2, 'Booking comp #7 (review 8.9). Was in previous comp set.'),
  ('cec443e9-e63c-4786-9e86-905120101542', 'Sofitel Luang Prabang',                             5, 25,   'Luang Prabang', 'Laos', true, false, 1, 'Booking comp #8 (review 8.9). Accor luxury. Direct via all.accor.com.'),
  ('cec443e9-e63c-4786-9e86-905120101542', 'The Luang Say Residence',                           4, NULL, 'Luang Prabang', 'Laos', true, false, 3, 'Booking comp #9 (review 8.9). Boutique. Likely no Trip/Traveloka — verify.'),
  ('cec443e9-e63c-4786-9e86-905120101542', 'The Grand Luang Prabang Affiliated by Meliá',      5, NULL, 'Luang Prabang', 'Laos', true, false, 1, 'Booking comp #10 (review 8.5). Meliá. Direct via melia.com.');

-- Verify
SELECT 
  cp.property_name, 
  cp.star_rating, 
  cp.scrape_priority,
  cp.is_self
FROM revenue.competitor_property cp
WHERE cp.set_id = 'cec443e9-e63c-4786-9e86-905120101542'
  AND cp.is_active = true
ORDER BY cp.is_self DESC, cp.scrape_priority, cp.property_name;
