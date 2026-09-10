-- Every assertion must return true AFTER the migration. Run it BEFORE to see it fail.
SELECT
  (SELECT count(*) FROM information_schema.tables
     WHERE table_schema='standards'
       AND table_name IN ('sources','requirements','atoms','atom_sources','sop_coverage')) = 5
    AS all_tables_present,
  -- tenant-neutral by design: only sop_coverage may carry property_id
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema='standards' AND column_name='property_id') = 1
    AS only_coverage_is_tenant_scoped,
  -- L5: no anon anywhere on the new public bridges
  (SELECT count(*) FROM information_schema.role_table_grants
     WHERE table_schema='public' AND grantee='anon'
       AND table_name IN ('v_standards_atoms','v_standards_requirements','v_standards_gap')) = 0
    AS anon_locked_out,
  -- The two TENANT-NEUTRAL views are readable by authenticated...
  (SELECT count(*) FROM information_schema.role_table_grants
     WHERE table_schema='public' AND grantee='authenticated' AND privilege_type='SELECT'
       AND table_name IN ('v_standards_atoms','v_standards_requirements')) = 2
    AS neutral_views_readable,
  -- ...but the gap view exposes property_id with no filter, so authenticated must
  -- NOT reach it. Callers use fn_standards_gap_summary(bigint) instead.
  (SELECT count(*) FROM information_schema.role_table_grants
     WHERE table_schema='public' AND grantee='authenticated' AND privilege_type='SELECT'
       AND table_name = 'v_standards_gap') = 0
    AS gap_view_not_tenant_readable;
