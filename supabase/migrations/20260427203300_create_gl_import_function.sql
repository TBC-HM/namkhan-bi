-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427203300
-- Name:    create_gl_import_function
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Server-side bulk loader for QB Detail rows
CREATE OR REPLACE FUNCTION gl.import_qb_detail(
  p_payload jsonb,
  p_source_file text DEFAULT 'QB_Detail_2025'
)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_inserted int;
BEGIN
  INSERT INTO gl.transactions 
    (txn_date, txn_type, txn_number, posting, section_account, line_account, 
     party_name, location, class, description, amount_native, currency_native, 
     fx_rate, amount_usd, source_file, source_row)
  SELECT 
    (j->>'d')::date, 
    j->>'t', 
    j->>'n', 
    TRUE, 
    j->>'s', 
    j->>'l',
    NULLIF(j->>'pn',''), 
    NULLIF(j->>'loc',''), 
    NULLIF(j->>'c',''), 
    NULLIF(j->>'desc',''),
    (j->>'a')::numeric, 
    'USD', 
    1.0, 
    (j->>'a')::numeric,
    p_source_file, 
    (j->>'sr')::int
  FROM jsonb_array_elements(p_payload) j;
  
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;