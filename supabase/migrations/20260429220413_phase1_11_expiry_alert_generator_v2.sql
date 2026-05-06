-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260429220413
-- Name:    phase1_11_expiry_alert_generator_v2
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

DROP FUNCTION IF EXISTS docs.generate_expiry_alerts();

CREATE FUNCTION docs.generate_expiry_alerts()
RETURNS TABLE(alerts_created int, docs_scanned int) LANGUAGE plpgsql AS $$
DECLARE
  v_created int := 0;
  v_scanned int := 0;
  v_recipients uuid[];
BEGIN
  SELECT coalesce(array_agg(DISTINCT ur.user_id), '{}'::uuid[]) INTO v_recipients
  FROM app.user_roles ur
  JOIN app.roles r ON r.role_id = ur.role_id
  WHERE r.code IN ('owner','gm') AND ur.is_active = true;

  WITH thresholds(days) AS (VALUES (90),(60),(30),(14),(7),(1)),
  candidates AS (
    SELECT d.doc_id, d.title, d.valid_until, t.days,
           (d.valid_until - (t.days || ' days')::interval)::date AS alert_date
    FROM docs.documents d
    CROSS JOIN thresholds t
    WHERE d.valid_until IS NOT NULL
      AND d.status NOT IN ('retired','archived','expired')
      AND d.valid_until >= current_date
      AND (d.valid_until - (t.days || ' days')::interval)::date <= current_date + interval '1 day'
      AND (d.valid_until - (t.days || ' days')::interval)::date >= current_date - interval '7 days'
  ),
  ins AS (
    INSERT INTO docs.expiry_alerts (doc_id, alert_at, days_before_expiry, recipients, status, notes)
    SELECT c.doc_id, c.alert_date, c.days, v_recipients, 'pending',
           format('Doc "%s" expires in %s days (on %s)', c.title, c.days, c.valid_until)
    FROM candidates c
    WHERE NOT EXISTS (
      SELECT 1 FROM docs.expiry_alerts ea
      WHERE ea.doc_id = c.doc_id
        AND ea.days_before_expiry = c.days
        AND ea.status IN ('pending','sent','acknowledged')
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_created FROM ins;

  UPDATE docs.documents
  SET status = 'expired', updated_at = now()
  WHERE valid_until < current_date
    AND status NOT IN ('retired','archived','expired');

  SELECT count(*) INTO v_scanned FROM docs.documents WHERE valid_until IS NOT NULL;
  RETURN QUERY SELECT v_created, v_scanned;
END;
$$;

GRANT EXECUTE ON FUNCTION docs.generate_expiry_alerts() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN PERFORM cron.unschedule('docs_expiry_alerts'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule('docs_expiry_alerts','0 23 * * *','SELECT docs.generate_expiry_alerts();');
  END IF;
END$$;

SELECT * FROM docs.generate_expiry_alerts();