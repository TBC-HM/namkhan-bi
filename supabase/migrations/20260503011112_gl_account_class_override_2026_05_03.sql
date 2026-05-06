-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503011112
-- Name:    gl_account_class_override_2026_05_03
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Per-account QB class override. Lets the accountant remap accounts that QB
-- has tagged with class_id='not_specified' (or any other wrong class) to a
-- correct USALI department/class.
CREATE TABLE IF NOT EXISTS gl.account_class_override (
  account_id   text PRIMARY KEY REFERENCES gl.accounts(account_id),
  class_id     text NOT NULL REFERENCES gl.classes(class_id),
  note         text,
  set_by       text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE gl.account_class_override IS
  'Accountant override: when set, gl_entries for this account_id with class_id="not_specified" are reclassified to the chosen class_id (and matview is refreshed). Editable from /finance/mapping.';

-- Aggregated view of accounts that need attention (gl_entries currently in
-- the DQ bucket OR mapped via override). Used by /finance/mapping to drive
-- the table.
CREATE OR REPLACE VIEW gl.v_account_class_status AS
WITH agg AS (
  SELECT g.account_id,
         a.account_name,
         a.usali_subcategory,
         a.usali_line_label,
         g.class_id AS current_class_id,
         count(*)        AS txns,
         round(sum(g.amount_usd)::numeric, 0) AS usd_total,
         max(g.txn_date) AS last_seen
  FROM gl.gl_entries g
  JOIN gl.accounts a ON a.account_id = g.account_id
  GROUP BY g.account_id, a.account_name, a.usali_subcategory, a.usali_line_label, g.class_id
)
SELECT agg.account_id,
       agg.account_name,
       agg.usali_subcategory,
       agg.usali_line_label,
       agg.current_class_id,
       c.qb_class_name        AS current_class_name,
       c.usali_department     AS current_dept,
       o.class_id             AS override_class_id,
       o2.qb_class_name       AS override_class_name,
       o2.usali_department    AS override_dept,
       o.note                 AS override_note,
       o.updated_at           AS override_updated_at,
       agg.txns,
       agg.usd_total,
       agg.last_seen,
       (agg.current_class_id = 'not_specified') AS is_unclear
FROM agg
LEFT JOIN gl.classes c               ON c.class_id = agg.current_class_id
LEFT JOIN gl.account_class_override o ON o.account_id = agg.account_id
LEFT JOIN gl.classes o2              ON o2.class_id = o.class_id;

COMMENT ON VIEW gl.v_account_class_status IS
  'Drives /finance/mapping. Rows where is_unclear=true OR override_class_id IS NOT NULL warrant accountant attention.';

-- Grants for anon (read-only display) + service_role (write via RPC)
GRANT SELECT ON gl.account_class_override TO anon, service_role;
GRANT SELECT ON gl.v_account_class_status TO anon, service_role;
GRANT INSERT, UPDATE, DELETE ON gl.account_class_override TO service_role;

-- RPC: apply an override + reclassify gl_entries + refresh matview.
-- Returns count of reclassified rows.
CREATE OR REPLACE FUNCTION gl.set_account_class(
  p_account_id text,
  p_class_id   text,
  p_note       text DEFAULT NULL,
  p_set_by     text DEFAULT 'accountant'
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = gl, public
AS $$
DECLARE
  v_changed integer;
BEGIN
  IF p_class_id IS NULL OR p_class_id NOT IN (SELECT class_id FROM gl.classes) THEN
    RAISE EXCEPTION 'invalid class_id: %', p_class_id;
  END IF;

  -- Upsert override
  INSERT INTO gl.account_class_override(account_id, class_id, note, set_by, updated_at)
  VALUES (p_account_id, p_class_id, p_note, p_set_by, now())
  ON CONFLICT (account_id) DO UPDATE
    SET class_id = EXCLUDED.class_id,
        note     = COALESCE(EXCLUDED.note, gl.account_class_override.note),
        set_by   = EXCLUDED.set_by,
        updated_at = now();

  -- Reclassify gl_entries for this account that are currently 'not_specified'
  UPDATE gl.gl_entries
     SET class_id = p_class_id
   WHERE account_id = p_account_id
     AND class_id   = 'not_specified';
  GET DIAGNOSTICS v_changed = ROW_COUNT;

  -- Always also flip has_class flag where appropriate
  UPDATE gl.gl_entries
     SET has_class = (class_id <> 'not_specified')
   WHERE account_id = p_account_id;

  -- Refresh dependent matview so /finance/pnl picks up the change
  REFRESH MATERIALIZED VIEW gl.mv_usali_pl_monthly;

  RETURN v_changed;
END;
$$;

REVOKE ALL ON FUNCTION gl.set_account_class(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gl.set_account_class(text, text, text, text) TO service_role;