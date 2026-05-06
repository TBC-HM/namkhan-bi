-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503174205
-- Name:    compset_agent_scrape_plans_and_rankings
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Update compset_agent config to also scrape rate plans + rankings
UPDATE governance.agents
SET runtime_settings = runtime_settings || jsonb_build_object(
  'scrape_dimensions', jsonb_build_array(
    'rates',          -- core rate per stay date
    'rate_plans',     -- all rate plans offered (Flex/Non-Ref/Early Bird/Promo)
    'reviews',        -- review score + count
    'rankings'        -- platform position for given search context
  ),
  'ranking_search_contexts', jsonb_build_array(
    jsonb_build_object('destination', 'Luang Prabang, Laos', 'sort_order', 'recommended', 'filters', '{}'),
    jsonb_build_object('destination', 'Luang Prabang, Laos', 'sort_order', 'price_asc', 'filters', '{"stars":[4,5]}'),
    jsonb_build_object('destination', 'Luang Prabang, Laos', 'sort_order', 'rating', 'filters', '{}')
  ),
  'ranking_frequency', 'weekly',  -- rankings don't shift daily, weekly is enough
  'rate_plan_capture_min_plans', 2  -- expect at least 2 plans (e.g. flex + non-ref) per room/date
)
WHERE code = 'compset_agent';

-- Verify
SELECT runtime_settings->'scrape_dimensions' AS dims, 
       runtime_settings->'ranking_search_contexts' AS contexts
FROM governance.agents WHERE code = 'compset_agent';
