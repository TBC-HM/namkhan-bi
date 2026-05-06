-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427182957
-- Name:    kpi_data_coverage
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Track when each subdept first appeared, so SDLY skills can flag pre-coverage zeros
CREATE OR REPLACE VIEW kpi.v_data_coverage AS
SELECT 
  usali_dept,
  usali_subdept,
  MIN(service_date) AS first_tx_date,
  MAX(service_date) AS latest_tx_date,
  COUNT(*) AS total_tx,
  CASE 
    WHEN MIN(service_date) > '2025-01-01' THEN 'PARTIAL_PRE_' || TO_CHAR(MIN(service_date),'YYYY_MM')
    ELSE 'OK'
  END AS coverage_flag
FROM transactions
WHERE usali_dept NOT IN ('Tax','Fee','Adjustment')
  AND service_date IS NOT NULL
GROUP BY usali_dept, usali_subdept;
