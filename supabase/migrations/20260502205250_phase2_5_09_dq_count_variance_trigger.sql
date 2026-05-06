-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502205250
-- Name:    phase2_5_09_dq_count_variance_trigger
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Phase 2.5 — DQ trigger: emit gl.dq_findings when stocktake variance crosses threshold.
-- Spec: "if variance >5% OR >$50, generates dq_findings row automatically"
--
-- Convention matches existing DQ engine:
--   rule_code = DQ-INV-COUNT-VARIANCE
--   severity = critical (>$500 or >25%) | high (>$50 or >5%) | med (5%/$50 boundary)
--   ref_type = inv_count_line
--   ref_id   = count_line_id (cast to text since gl.dq_findings.ref_id is text)
--   fingerprint stable per (count_line_id) so re-imports update last_seen_at,
--     not generate dupes.

CREATE OR REPLACE FUNCTION inv.fn_count_line_dq()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = inv, gl, public
AS $$
DECLARE
  v_pct        NUMERIC;
  v_severity   TEXT;
  v_msg        TEXT;
  v_sku        TEXT;
  v_loc_name   TEXT;
  v_count_date DATE;
BEGIN
  IF COALESCE(NEW.system_quantity, 0) > 0 THEN
    v_pct := ABS(NEW.variance) / NEW.system_quantity * 100.0;
  ELSE
    v_pct := 0;
  END IF;

  -- Spec threshold: >5% OR >$50
  IF v_pct <= 5.0 AND ABS(COALESCE(NEW.variance_value_usd, 0)) <= 50 THEN
    RETURN NEW;
  END IF;

  IF v_pct > 25.0 OR ABS(COALESCE(NEW.variance_value_usd, 0)) > 500 THEN
    v_severity := 'critical';
  ELSIF v_pct > 5.0 OR ABS(COALESCE(NEW.variance_value_usd, 0)) > 50 THEN
    v_severity := 'high';
  ELSE
    v_severity := 'med';
  END IF;

  -- Pull context for human-readable message
  SELECT i.sku INTO v_sku FROM inv.items i WHERE i.item_id = NEW.item_id;
  SELECT c.count_date, l.location_name INTO v_count_date, v_loc_name
    FROM inv.counts c JOIN inv.locations l USING (location_id)
   WHERE c.count_id = NEW.count_id;

  v_msg := format(
    'Stocktake variance: %s at %s on %s — counted %s vs system %s (Δ %s, %s%%, $%s)',
    COALESCE(v_sku, NEW.item_id::text),
    COALESCE(v_loc_name, '?'),
    COALESCE(v_count_date::text, 'today'),
    NEW.counted_quantity, COALESCE(NEW.system_quantity, 0),
    NEW.variance, ROUND(v_pct, 1), ROUND(COALESCE(NEW.variance_value_usd, 0), 2)
  );

  INSERT INTO gl.dq_findings (
    fingerprint, rule_code, severity, ref_type, ref_id, message,
    suggested_fix, impact_usd, first_seen_at, last_seen_at
  ) VALUES (
    'INV-COUNT-VARIANCE:' || NEW.count_line_id::text,
    'DQ-INV-COUNT-VARIANCE',
    v_severity,
    'inv_count_line',
    NEW.count_line_id::text,
    v_msg,
    'Investigate before approving the count. If variance is real, post inv.movements (count_correction) to reconcile system_quantity.',
    ABS(COALESCE(NEW.variance_value_usd, 0)),
    now(), now()
  )
  ON CONFLICT (fingerprint) DO UPDATE
    SET severity     = EXCLUDED.severity,
        message      = EXCLUDED.message,
        impact_usd   = EXCLUDED.impact_usd,
        last_seen_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inv_count_lines_dq ON inv.count_lines;
CREATE TRIGGER trg_inv_count_lines_dq
  AFTER INSERT OR UPDATE ON inv.count_lines
  FOR EACH ROW EXECUTE FUNCTION inv.fn_count_line_dq();

REVOKE ALL ON FUNCTION inv.fn_count_line_dq() FROM PUBLIC;
