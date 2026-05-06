-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503184428
-- Name:    flag_detector_helpers_v2
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


CREATE OR REPLACE FUNCTION revenue.fn_event_context(p_stay_date DATE)
RETURNS TEXT[] LANGUAGE sql STABLE AS $$
  SELECT COALESCE(ARRAY_AGG(DISTINCT ce.type_code), ARRAY[]::TEXT[])
  FROM marketing.calendar_events ce
  WHERE p_stay_date BETWEEN ce.date_start AND ce.date_end
    AND ce.applies_to_rate_shop = true;
$$;

CREATE OR REPLACE FUNCTION revenue.fn_escalate_severity(p_severity TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_severity
    WHEN 'info' THEN 'low' WHEN 'low' THEN 'medium'
    WHEN 'medium' THEN 'high' WHEN 'high' THEN 'critical'
    WHEN 'critical' THEN 'critical' END;
$$;
