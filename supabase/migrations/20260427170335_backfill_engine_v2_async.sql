-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427170335
-- Name:    backfill_engine_v2_async
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


DROP FUNCTION IF EXISTS cb_call(text);
DROP FUNCTION IF EXISTS cb_get_response(bigint, int);

-- Stage table: pending requests for paginated pulls
CREATE TABLE IF NOT EXISTS sync_request_queue (
  id bigserial PRIMARY KEY,
  entity text NOT NULL,
  page_number int NOT NULL,
  url text NOT NULL,
  request_id bigint,
  status text NOT NULL DEFAULT 'pending', -- pending|fired|received|processed|failed
  http_status int,
  rows_returned int,
  total_rows int,
  fired_at timestamptz,
  received_at timestamptz,
  error_msg text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_srq_status ON sync_request_queue(status);
CREATE INDEX IF NOT EXISTS idx_srq_entity ON sync_request_queue(entity);

-- Plan a paginated pull: insert N pages into queue
CREATE OR REPLACE FUNCTION cb_plan_pages(p_entity text, p_base_url text, p_total int, p_page_size int DEFAULT 100)
RETURNS int AS $$
DECLARE
  total_pages int;
  i int;
  separator text;
BEGIN
  total_pages := CEIL(p_total::numeric / p_page_size);
  separator := CASE WHEN p_base_url LIKE '%?%' THEN '&' ELSE '?' END;
  
  FOR i IN 1..total_pages LOOP
    INSERT INTO sync_request_queue(entity, page_number, url, status)
    VALUES(
      p_entity,
      i,
      p_base_url || separator || 'pageNumber=' || i || '&pageSize=' || p_page_size,
      'pending'
    );
  END LOOP;
  
  RETURN total_pages;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fire next batch of pending requests (rate-limited: max 4/sec)
CREATE OR REPLACE FUNCTION cb_fire_batch(p_entity text, p_batch_size int DEFAULT 4)
RETURNS int AS $$
DECLARE
  rec record;
  rid bigint;
  fired int := 0;
BEGIN
  FOR rec IN 
    SELECT id, url FROM sync_request_queue 
    WHERE entity = p_entity AND status = 'pending'
    ORDER BY page_number 
    LIMIT p_batch_size
  LOOP
    SELECT net.http_get(url := rec.url, headers := cb_auth_header(), timeout_milliseconds := 60000) INTO rid;
    UPDATE sync_request_queue SET request_id = rid, status = 'fired', fired_at = now() WHERE id = rec.id;
    fired := fired + 1;
  END LOOP;
  RETURN fired;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Collect responses for fired requests
CREATE OR REPLACE FUNCTION cb_collect(p_entity text)
RETURNS TABLE(collected int, still_pending int, failed int) AS $$
DECLARE
  rec record;
  resp record;
  collected_n int := 0;
  failed_n int := 0;
BEGIN
  FOR rec IN
    SELECT q.id, q.request_id, q.url
    FROM sync_request_queue q
    WHERE q.entity = p_entity AND q.status = 'fired'
  LOOP
    SELECT r.status_code, r.content, r.error_msg INTO resp
    FROM net._http_response r WHERE r.id = rec.request_id;
    
    IF resp.status_code IS NOT NULL THEN
      IF resp.status_code = 200 THEN
        UPDATE sync_request_queue SET 
          status = 'received',
          http_status = resp.status_code,
          received_at = now(),
          rows_returned = COALESCE(jsonb_array_length((resp.content::jsonb)->'data'), 0),
          total_rows = ((resp.content::jsonb)->>'total')::int
        WHERE id = rec.id;
        collected_n := collected_n + 1;
      ELSE
        UPDATE sync_request_queue SET 
          status = 'failed',
          http_status = resp.status_code,
          received_at = now(),
          error_msg = LEFT(resp.content::text, 500)
        WHERE id = rec.id;
        failed_n := failed_n + 1;
      END IF;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT 
    collected_n,
    (SELECT COUNT(*)::int FROM sync_request_queue WHERE entity = p_entity AND status = 'fired'),
    failed_n;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
