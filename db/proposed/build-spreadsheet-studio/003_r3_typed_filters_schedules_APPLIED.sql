-- Spreadsheet Studio r3 — APPLIED to namkhan-pms 2026-07-31 as migration
-- 'spreadsheet_studio_r3_typed_filters_schedules' (audit copy, brief
-- module-spreadsheet-studio-v1, verifier objections 2026-07-31).
-- 1) fn_studio_query typed comparisons (fix: ::text lexicographic on
--    numeric/date columns — '>9' used to exclude 10)
-- 2) reports.studio_schedules + bridge fns for scheduled xlsx-by-email
--    exports (§8 option a) + pg_cron 'studio-exports-hourly'

CREATE OR REPLACE FUNCTION public.fn_studio_query(p_schema text, p_view text, p_columns text[] DEFAULT NULL::text[], p_filters jsonb DEFAULT '[]'::jsonb, p_limit integer DEFAULT 1000)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cols text;
  v_where text := '';
  v_sql text;
  v_out jsonb;
  f jsonb;
  v_op text;
  v_sqlop text;
  v_col text;
  v_val text;
  v_type text;
  v_expr text;
  v_allowed_cols text[];
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 1000), 1), 5000);
BEGIN
  IF p_schema NOT IN ('public','kpi') OR p_view NOT LIKE 'v\_%' THEN
    RAISE EXCEPTION 'view not allowed: %.%', p_schema, p_view;
  END IF;
  SELECT array_agg(c.column_name::text) INTO v_allowed_cols
  FROM information_schema.columns c
  WHERE c.table_schema = p_schema AND c.table_name = p_view;
  IF v_allowed_cols IS NULL THEN
    RAISE EXCEPTION 'view not found: %.%', p_schema, p_view;
  END IF;

  IF p_columns IS NULL OR array_length(p_columns,1) IS NULL THEN
    v_cols := '*';
  ELSE
    IF EXISTS (SELECT 1 FROM unnest(p_columns) pc WHERE pc <> ALL (v_allowed_cols)) THEN
      RAISE EXCEPTION 'unknown column requested';
    END IF;
    SELECT string_agg(format('%I', pc), ', ') INTO v_cols FROM unnest(p_columns) pc;
  END IF;

  FOR f IN SELECT * FROM jsonb_array_elements(COALESCE(p_filters, '[]'::jsonb)) LOOP
    v_col := f->>'col';
    v_val := COALESCE(f->>'value', '');
    IF v_col IS NULL OR v_col <> ALL (v_allowed_cols) THEN
      RAISE EXCEPTION 'unknown filter column';
    END IF;
    v_op := COALESCE(f->>'op', '=');
    IF v_op NOT IN ('=','!=','>','>=','<','<=','ilike') THEN
      RAISE EXCEPTION 'operator not allowed: %', v_op;
    END IF;
    v_sqlop := CASE v_op WHEN '!=' THEN '<>' ELSE v_op END;

    SELECT c.data_type INTO v_type
    FROM information_schema.columns c
    WHERE c.table_schema = p_schema AND c.table_name = p_view AND c.column_name = v_col;

    IF v_op = 'ilike' THEN
      v_expr := format('%I::text ILIKE %L', v_col, v_val);
    ELSIF v_type IN ('integer','bigint','smallint','numeric','double precision','real')
          AND v_val ~ '^-?[0-9]+(\.[0-9]+)?$' THEN
      v_expr := format('%I %s %L::numeric', v_col, v_sqlop, v_val);
    ELSIF v_type = 'date' AND v_val ~ '^\d{4}-\d{2}-\d{2}$' THEN
      v_expr := format('%I %s %L::date', v_col, v_sqlop, v_val);
    ELSIF v_type IN ('timestamp with time zone','timestamp without time zone')
          AND v_val ~ '^\d{4}-\d{2}-\d{2}' THEN
      v_expr := format('%I %s %L::timestamptz', v_col, v_sqlop, v_val);
    ELSIF v_type = 'boolean' AND lower(v_val) IN ('true','false','t','f') THEN
      v_expr := format('%I %s %L::boolean', v_col, v_sqlop, lower(v_val));
    ELSE
      v_expr := format('%I::text %s %L', v_col, v_sqlop, v_val);
    END IF;

    v_where := v_where || CASE WHEN v_where = '' THEN ' WHERE ' ELSE ' AND ' END || v_expr;
  END LOOP;

  v_sql := format('SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (SELECT %s FROM %I.%I %s LIMIT %s) t',
                  v_cols, p_schema, p_view, v_where, v_limit);
  EXECUTE v_sql INTO v_out;
  RETURN v_out;
END $function$;

REVOKE ALL ON FUNCTION public.fn_studio_query(text, text, text[], jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_studio_query(text, text, text[], jsonb, integer) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS reports.studio_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES reports.studio_templates(id) ON DELETE CASCADE,
  property_id integer,
  recipients text[] NOT NULL,
  cadence text NOT NULL CHECK (cadence IN ('daily','weekly','monthly')),
  send_hour_utc integer NOT NULL DEFAULT 1 CHECK (send_hour_utc BETWEEN 0 AND 23),
  weekly_dow integer CHECK (weekly_dow BETWEEN 0 AND 6),
  monthly_dom integer CHECK (monthly_dom BETWEEN 1 AND 28),
  active boolean NOT NULL DEFAULT true,
  owner text NOT NULL DEFAULT 'studio',
  last_run_at timestamptz,
  last_status text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE reports.studio_schedules ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='reports' AND tablename='studio_schedules' AND policyname='studio_schedules_service') THEN
    CREATE POLICY studio_schedules_service ON reports.studio_schedules FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE OR REPLACE VIEW public.v_studio_schedules AS
SELECT s.id, s.template_id, t.name AS template_name, s.property_id, s.recipients,
       s.cadence, s.send_hour_utc, s.weekly_dow, s.monthly_dom, s.active, s.owner,
       s.last_run_at, s.last_status, s.last_error, s.created_at, s.updated_at
FROM reports.studio_schedules s
JOIN reports.studio_templates t ON t.id = s.template_id;
REVOKE ALL ON public.v_studio_schedules FROM PUBLIC, anon;
GRANT SELECT ON public.v_studio_schedules TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_studio_save_schedule(
  p_template_id uuid, p_recipients text[], p_cadence text,
  p_send_hour_utc integer DEFAULT 1, p_weekly_dow integer DEFAULT NULL,
  p_monthly_dom integer DEFAULT NULL, p_property_id integer DEFAULT NULL,
  p_owner text DEFAULT 'studio', p_id uuid DEFAULT NULL, p_active boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  IF p_recipients IS NULL OR array_length(p_recipients,1) IS NULL THEN
    RAISE EXCEPTION 'recipients required';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_recipients) r WHERE r !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN
    RAISE EXCEPTION 'invalid recipient email';
  END IF;
  IF p_id IS NOT NULL THEN
    UPDATE reports.studio_schedules
    SET recipients = p_recipients, cadence = p_cadence, send_hour_utc = COALESCE(p_send_hour_utc,1),
        weekly_dow = p_weekly_dow, monthly_dom = p_monthly_dom, active = COALESCE(p_active,true),
        updated_at = now()
    WHERE id = p_id RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'schedule not found'; END IF;
    RETURN v_id;
  END IF;
  INSERT INTO reports.studio_schedules (template_id, property_id, recipients, cadence, send_hour_utc, weekly_dow, monthly_dom, owner, active)
  VALUES (p_template_id, p_property_id, p_recipients, p_cadence, COALESCE(p_send_hour_utc,1), p_weekly_dow, p_monthly_dom, COALESCE(p_owner,'studio'), COALESCE(p_active,true))
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$;
REVOKE ALL ON FUNCTION public.fn_studio_save_schedule(uuid, text[], text, integer, integer, integer, integer, text, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_studio_save_schedule(uuid, text[], text, integer, integer, integer, integer, text, uuid, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_studio_schedules_due()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id, 'template_id', s.template_id, 'template_name', t.name,
    'template_version', t.version, 'definition', t.definition,
    'property_id', s.property_id, 'recipients', s.recipients, 'cadence', s.cadence
  )), '[]'::jsonb)
  FROM reports.studio_schedules s
  JOIN reports.studio_templates t ON t.id = s.template_id
  WHERE s.active
    AND t.status = 'active'
    AND extract(hour from now()) = s.send_hour_utc
    AND CASE s.cadence
      WHEN 'daily'   THEN (s.last_run_at IS NULL OR s.last_run_at::date < current_date)
      WHEN 'weekly'  THEN extract(dow from now()) = COALESCE(s.weekly_dow, 1)
                          AND (s.last_run_at IS NULL OR s.last_run_at < current_date - 1)
      WHEN 'monthly' THEN extract(day from now()) = COALESCE(s.monthly_dom, 1)
                          AND (s.last_run_at IS NULL OR date_trunc('month', s.last_run_at) < date_trunc('month', now()))
      ELSE false END;
$function$;
REVOKE ALL ON FUNCTION public.fn_studio_schedules_due() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_studio_schedules_due() TO service_role;

CREATE OR REPLACE FUNCTION public.fn_studio_mark_schedule_run(p_id uuid, p_status text, p_error text DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  UPDATE reports.studio_schedules
  SET last_run_at = now(), last_status = p_status, last_error = p_error, updated_at = now()
  WHERE id = p_id;
$function$;
REVOKE ALL ON FUNCTION public.fn_studio_mark_schedule_run(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_studio_mark_schedule_run(uuid, text, text) TO service_role;

-- pg_cron hourly dispatcher (registered separately, same run, jobid 186):
-- SELECT cron.schedule('studio-exports-hourly', '5 * * * *', $cmd$
--   SELECT CASE WHEN public.fn_automation_enabled() THEN
--     net.http_post(
--       url := 'https://namkhan-bi.vercel.app/api/cron/studio-exports',
--       headers := jsonb_build_object('content-type','application/json',
--         'x-cron-secret', COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='CRON_SHARED_SECRET' LIMIT 1),'')),
--       body := '{}'::jsonb, timeout_milliseconds := 290000)
--   ELSE NULL END; $cmd$);
