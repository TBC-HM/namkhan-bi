-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427214123
-- Name:    create_qb_import_staging_table
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Staging table for QB JSONB chunks — accept multiple chunks then process
CREATE TABLE IF NOT EXISTS gl.qb_import_staging (
  chunk_id int PRIMARY KEY,
  payload jsonb NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','processed','error')),
  rows_count int,
  error_msg text,
  staged_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

-- Process all pending chunks in one server-side call
CREATE OR REPLACE FUNCTION gl.process_qb_staging(p_source_file text DEFAULT 'QB_Detail_2025')
RETURNS TABLE(chunk_id int, rows_inserted int, status text)
LANGUAGE plpgsql
AS $$
DECLARE
  c RECORD;
  v_inserted int;
BEGIN
  FOR c IN SELECT s.chunk_id, s.payload FROM gl.qb_import_staging s 
           WHERE s.status = 'pending' ORDER BY s.chunk_id
  LOOP
    BEGIN
      v_inserted := gl.import_qb_detail(c.payload, p_source_file);
      
      UPDATE gl.qb_import_staging 
      SET status = 'processed', rows_count = v_inserted, processed_at = now()
      WHERE gl.qb_import_staging.chunk_id = c.chunk_id;
      
      RETURN QUERY SELECT c.chunk_id, v_inserted, 'processed'::text;
    EXCEPTION WHEN OTHERS THEN
      UPDATE gl.qb_import_staging 
      SET status = 'error', error_msg = SQLERRM, processed_at = now()
      WHERE gl.qb_import_staging.chunk_id = c.chunk_id;
      
      RETURN QUERY SELECT c.chunk_id, 0, ('error: ' || SQLERRM)::text;
    END;
  END LOOP;
END;
$$;