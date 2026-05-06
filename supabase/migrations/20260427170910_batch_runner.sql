-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427170910
-- Name:    batch_runner
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Run a wave: fire N pages, wait, collect, repeat W waves
CREATE OR REPLACE FUNCTION cb_run_waves(
  p_entity text,
  p_waves int DEFAULT 5,
  p_per_wave int DEFAULT 3,
  p_wave_delay_s int DEFAULT 2
)
RETURNS TABLE(wave int, fired int, collected int, failed int) AS $$
DECLARE
  w int;
  f int;
  cresult record;
  pending_count int;
BEGIN
  FOR w IN 1..p_waves LOOP
    -- Check if anything pending
    SELECT COUNT(*) INTO pending_count 
    FROM sync_request_queue WHERE entity = p_entity AND status = 'pending';
    EXIT WHEN pending_count = 0;
    
    -- Fire
    SELECT cb_fire_batch(p_entity, p_per_wave) INTO f;
    
    -- Wait for HTTP
    PERFORM pg_sleep(p_wave_delay_s);
    
    -- Collect
    SELECT * INTO cresult FROM cb_collect(p_entity);
    
    wave := w;
    fired := f;
    collected := cresult.collected;
    failed := cresult.failed;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Retry failed (rate-limited) requests
CREATE OR REPLACE FUNCTION cb_retry_failed(p_entity text)
RETURNS int AS $$
DECLARE
  n int;
BEGIN
  UPDATE sync_request_queue 
  SET status = 'pending', request_id = NULL, http_status = NULL, 
      error_msg = NULL, fired_at = NULL, received_at = NULL
  WHERE entity = p_entity AND status = 'failed';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
