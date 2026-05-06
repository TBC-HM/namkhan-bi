-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427173042
-- Name:    queue_drainer
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Single drain step: collect what's done, fire next batch, retry failed
CREATE OR REPLACE FUNCTION cb_drain_step(p_entity text, p_batch int DEFAULT 25)
RETURNS jsonb AS $$
DECLARE
  collected_n int;
  fired_n int;
  retried_n int;
  pending_n int;
  fired_status int;
  received_status int;
  failed_status int;
BEGIN
  -- 1. Collect responses for anything already fired
  SELECT collected, failed INTO collected_n, failed_status
  FROM cb_collect(p_entity);
  
  -- 2. Retry rate-limited failures (push back into pending)
  SELECT cb_retry_failed(p_entity) INTO retried_n;
  
  -- 3. Fire next batch (only if nothing currently fired)
  SELECT COUNT(*) INTO fired_status FROM sync_request_queue 
    WHERE entity = p_entity AND status = 'fired';
  
  IF fired_status = 0 THEN
    SELECT cb_fire_batch(p_entity, p_batch) INTO fired_n;
  ELSE
    fired_n := 0;
  END IF;
  
  -- 4. Status summary
  SELECT COUNT(*) INTO pending_n FROM sync_request_queue 
    WHERE entity = p_entity AND status = 'pending';
  SELECT COUNT(*) INTO received_status FROM sync_request_queue 
    WHERE entity = p_entity AND status = 'received';
  
  RETURN jsonb_build_object(
    'collected', collected_n,
    'failed_this_step', failed_status,
    'retried', retried_n,
    'fired', fired_n,
    'pending', pending_n,
    'received_total', received_status,
    'currently_fired', fired_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
