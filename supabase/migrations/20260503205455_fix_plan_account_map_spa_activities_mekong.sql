-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503205455
-- Name:    fix_plan_account_map_spa_activities_mekong
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Re-tag Spa/Activities/Mekong Cruise budget account_codes (mis-mapped to 'Other Operated').
-- These were collapsing $155k of dept-specific budget into Other Operated, leaving Spa/Activities/MC rows showing 'xx' on /finance/pnl.
UPDATE plan.account_map SET usali_dept = 'Spa'
  WHERE account_code IN ('708070','631103','606103','606300');
UPDATE plan.account_map SET usali_dept = 'Activities'
  WHERE account_code IN ('708040','631104','606102');
UPDATE plan.account_map SET usali_dept = 'Mekong Cruise'
  WHERE account_code IN ('708050','631105');

COMMENT ON TABLE plan.account_map IS 'Budget account → USALI dept mapping. Fixed 2026-05-03: Spa/Activities/Mekong Cruise account codes (708070/708040/708050/631103/631104/631105/606102/606103/606300) re-tagged from Other Operated to their real depts.';
