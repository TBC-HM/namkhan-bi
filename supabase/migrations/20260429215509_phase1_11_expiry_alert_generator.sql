-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260429215509
-- Name:    phase1_11_expiry_alert_generator
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- =====================================================================
-- Phase 1.11 — Expiry alert generator
-- Function runs nightly: for any doc with valid_until in the future,
-- creates expiry_alerts at -120, -90, -60, -30, -14, -7, -1 days
-- if no alert at that lead time exists.
-- =====================================================================

CREATE OR REPLACE FUNCTION docs.generate_expiry_alerts()
RETURNS TABLE (alerts_created int) LANGUAGE plpgsql AS $$
DECLARE
  v_count int := 0;
  v_lead int;
  v_lead_array int[] := ARRAY[120, 90, 60, 30, 14, 7, 1];
BEGIN
  FOREACH v_lead IN ARRAY v_lead_array LOOP
    INSERT INTO docs.expiry_alerts (doc_id, alert_at, days_before_expiry, recipients, status)
    SELECT
      d.doc_id,
      d.valid_until - (v_lead || ' days')::interval AS alert_at,
      v_lead,
      ARRAY(SELECT user_id FROM app.profiles WHERE is_active = true AND user_id IN (
        SELECT ur.user_id FROM app.user_roles ur JOIN app.roles r ON r.role_id = ur.role_id
        WHERE r.code IN ('owner','gm') AND ur.is_active = true
      )),
      'pending'
    FROM docs.documents d
    WHERE d.valid_until IS NOT NULL
      AND d.status NOT IN ('retired','archived','expired')
      AND d.valid_until > current_date
      AND d.valid_until - (v_lead || ' days')::interval >= current_date - interval '1 day'
      AND NOT EXISTS (
        SELECT 1 FROM docs.expiry_alerts ea
        WHERE ea.doc_id = d.doc_id
          AND ea.days_before_expiry = v_lead
      );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    alerts_created := COALESCE(alerts_created, 0) + v_count;
  END LOOP;

  -- Mark docs as expired if past valid_until
  UPDATE docs.documents
  SET status = 'expired'
  WHERE valid_until IS NOT NULL
    AND valid_until < current_date
    AND status = 'active';

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION docs.generate_expiry_alerts() TO service_role;

-- Helper view: docs at risk (active with expiry < 90 days OR no expiry set yet)
CREATE OR REPLACE VIEW docs.v_docs_at_risk AS
SELECT
  d.doc_id,
  d.title,
  d.doc_type,
  d.doc_subtype,
  d.project,
  d.external_party,
  d.status,
  d.valid_until,
  CASE
    WHEN d.valid_until IS NULL              THEN 'expiry_unknown'
    WHEN d.valid_until < current_date       THEN 'expired'
    WHEN d.valid_until < current_date + 30  THEN 'expires_30d'
    WHEN d.valid_until < current_date + 60  THEN 'expires_60d'
    WHEN d.valid_until < current_date + 90  THEN 'expires_90d'
    ELSE 'ok'
  END AS risk_tier,
  d.valid_until - current_date AS days_remaining,
  d.owner_user_id,
  d.cost_center
FROM docs.documents d
WHERE d.doc_type IN ('compliance','insurance','legal')
  AND d.status NOT IN ('retired','archived')
ORDER BY 
  CASE
    WHEN d.valid_until IS NULL THEN 1
    WHEN d.valid_until < current_date THEN 0
    ELSE 2
  END,
  d.valid_until NULLS LAST;

GRANT SELECT ON docs.v_docs_at_risk TO authenticated, service_role;

COMMENT ON FUNCTION docs.generate_expiry_alerts IS 'Creates docs.expiry_alerts at 120/90/60/30/14/7/1 days before valid_until. Idempotent. Run nightly.';
COMMENT ON VIEW docs.v_docs_at_risk IS 'Compliance/insurance/legal docs grouped by expiry risk tier. UI dashboard source.';
