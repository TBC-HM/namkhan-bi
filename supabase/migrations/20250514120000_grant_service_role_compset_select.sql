-- Grant SELECT on compset tables and views to service_role
-- This removes the need for anon-client workarounds on the compset page

-- Grant on tables
GRANT SELECT ON revenue.competitor_rate_matrix TO service_role;
GRANT SELECT ON revenue.competitor_rates TO service_role;
GRANT SELECT ON revenue.competitor_rate_plans TO service_role;

-- Grant on all existing v_compset_* views
DO $$
DECLARE
  view_record RECORD;
BEGIN
  FOR view_record IN
    SELECT table_name
    FROM information_schema.views
    WHERE table_schema = 'revenue'
      AND table_name ILIKE 'v_compset_%'
  LOOP
    EXECUTE format('GRANT SELECT ON revenue.%I TO service_role', view_record.table_name);
  END LOOP;
END $$;

-- Note: For any new v_compset_* views created in the future,
-- you must manually grant SELECT to service_role or re-run this migration block.
-- service_role bypasses RLS by default, so no RLS policies need adjustment.
