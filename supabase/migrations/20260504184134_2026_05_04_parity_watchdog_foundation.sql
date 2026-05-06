-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504184134
-- Name:    2026_05_04_parity_watchdog_foundation
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ============================================================================
-- Parity Watchdog v1
--
-- Goal: detect parity breaks across channels for The Namkhan.
-- Currently we only scrape BDC for Namkhan, so v1 covers:
--   1. INTERNAL parity inside BDC (refundable vs non-refundable consistency,
--      rate plan disappearance, sudden rate jumps day-over-day)
--   2. Schema is ready for OTA-vs-OTA + OTA-vs-direct once Phase 2 parsers
--      ship (Expedia, Trip, Direct).
--
-- Severity:
--   CRITICAL — non-refundable priced HIGHER than refundable (always wrong)
--   HIGH     — same room, refundable plan missing on a stay date that had it
--   MEDIUM   — rate jumped >25% day-over-day on same plan
--   LOW      — rate jumped 10–25%
-- ============================================================================

-- 1. Observations table — append-only, one row per (stay_date, channel, plan) snapshot
CREATE TABLE IF NOT EXISTS revenue.parity_observations (
  obs_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id         uuid NOT NULL REFERENCES revenue.competitor_property(comp_id) ON DELETE CASCADE,
  shop_date       date NOT NULL DEFAULT CURRENT_DATE,
  stay_date       date NOT NULL,
  channel         text NOT NULL,
  raw_room_type   text,
  raw_label       text,
  rate_usd        numeric NOT NULL,
  is_refundable   boolean,
  meal_plan       text,
  agent_run_id    uuid REFERENCES governance.agent_runs(run_id) ON DELETE RESTRICT,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parity_obs_lookup
  ON revenue.parity_observations(comp_id, stay_date, shop_date DESC);
CREATE INDEX IF NOT EXISTS idx_parity_obs_run
  ON revenue.parity_observations(agent_run_id);

-- 2. Breaches table — only rows where parity is broken or suspect
CREATE TABLE IF NOT EXISTS revenue.parity_breaches (
  breach_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id             uuid NOT NULL REFERENCES revenue.competitor_property(comp_id) ON DELETE CASCADE,
  detected_at         timestamptz NOT NULL DEFAULT now(),
  shop_date           date NOT NULL DEFAULT CURRENT_DATE,
  stay_date           date NOT NULL,
  severity            text NOT NULL CHECK (severity IN ('critical','high','medium','low','info')),
  rule_code           text NOT NULL,
  rule_description    text,
  channel_a           text,
  channel_b           text,
  rate_a_usd          numeric,
  rate_b_usd          numeric,
  delta_usd           numeric,
  delta_pct           numeric,
  raw_room_type       text,
  raw_label_a         text,
  raw_label_b         text,
  agent_run_id        uuid REFERENCES governance.agent_runs(run_id) ON DELETE SET NULL,
  resolved            boolean NOT NULL DEFAULT false,
  resolved_at         timestamptz,
  resolved_note       text
);

CREATE INDEX IF NOT EXISTS idx_parity_breach_open
  ON revenue.parity_breaches(comp_id, stay_date, detected_at DESC) WHERE resolved = false;

-- 3. Grants + RLS — anon read so the page can render via the standard pattern
GRANT SELECT ON revenue.parity_observations, revenue.parity_breaches TO anon, authenticated;
GRANT ALL    ON revenue.parity_observations, revenue.parity_breaches TO service_role;

ALTER TABLE revenue.parity_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue.parity_breaches    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_read_parity ON revenue.parity_observations;
CREATE POLICY anon_read_parity ON revenue.parity_observations FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS anon_read_parity ON revenue.parity_breaches;
CREATE POLICY anon_read_parity ON revenue.parity_breaches FOR SELECT TO anon, authenticated USING (true);

-- 4. Register the parity_agent in governance
INSERT INTO governance.agents (
  agent_id, code, name, pillar, status, schedule_human, schedule_cron,
  model_id, monthly_budget_usd, runtime_settings, description, prompt_version
)
VALUES (
  gen_random_uuid(),
  'parity_agent',
  'Parity Watchdog',
  'revenue',
  'beta',
  'Daily at 06:15 ICT (after compset run)',
  '15 23 * * *',
  'sql-only',
  0,
  jsonb_build_object(
    'cron_enabled', true,
    'cron_schedule', '15 23 * * *',
    'rate_jump_warn_pct', 10,
    'rate_jump_alert_pct', 25,
    'check_internal_bdc', true,
    'check_ota_vs_direct', false,
    'horizon_days', 90
  ),
  'Detects rate-parity breaches across channels for The Namkhan. Internal-BDC parity v1; OTA-vs-direct planned for Phase 2.',
  'parity_v1'
)
ON CONFLICT (code) DO UPDATE SET
  status            = EXCLUDED.status,
  schedule_human    = EXCLUDED.schedule_human,
  schedule_cron     = EXCLUDED.schedule_cron,
  runtime_settings  = EXCLUDED.runtime_settings,
  description       = EXCLUDED.description,
  prompt_version    = EXCLUDED.prompt_version;

-- 5. The check function — runs over latest competitor_rate_plans for is_self comps
CREATE OR REPLACE FUNCTION public.parity_check_internal()
RETURNS TABLE (run_id uuid, breaches_inserted int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'revenue', 'governance'
AS $function$
DECLARE
  v_run_id     uuid;
  v_inserted   int := 0;
  v_agent_id   uuid;
  v_warn_pct   numeric := 10;
  v_alert_pct  numeric := 25;
BEGIN
  -- Get parity_agent
  SELECT agent_id, COALESCE((runtime_settings->>'rate_jump_warn_pct')::numeric, 10),
                   COALESCE((runtime_settings->>'rate_jump_alert_pct')::numeric, 25)
  INTO v_agent_id, v_warn_pct, v_alert_pct
  FROM governance.agents WHERE code = 'parity_agent';
  IF v_agent_id IS NULL THEN RAISE EXCEPTION 'parity_agent not registered'; END IF;

  -- Create a run row
  v_run_id := public.compset_run_create(
    jsonb_build_object('mode','internal_bdc','agent','parity_agent','triggered_at',now())
  );
  -- (compset_run_create writes to agent_runs but uses compset_agent's agent_id by lookup —
  --  re-point to parity_agent so the run shows under parity in history)
  UPDATE governance.agent_runs SET agent_id = v_agent_id WHERE run_id = v_run_id;

  -- Snapshot all latest plans into observations
  INSERT INTO revenue.parity_observations
    (comp_id, shop_date, stay_date, channel, raw_room_type, raw_label,
     rate_usd, is_refundable, meal_plan, agent_run_id)
  SELECT cp.comp_id, vp.shop_date, vp.stay_date, vp.channel,
         vp.raw_room_type, vp.raw_label,
         vp.rate_usd, vp.is_refundable, vp.meal_plan, v_run_id
  FROM public.v_compset_rate_plans_latest vp
  JOIN revenue.competitor_property cp ON cp.comp_id = vp.comp_id
  WHERE cp.is_self = true;

  -- ============================================================
  -- RULE 1 (CRITICAL): non-refundable > refundable for same room/stay/channel
  -- ============================================================
  WITH plans AS (
    SELECT * FROM public.v_compset_rate_plans_latest vp
    JOIN revenue.competitor_property cp USING (comp_id)
    WHERE cp.is_self = true
  ),
  pairs AS (
    SELECT
      r.comp_id, r.shop_date, r.stay_date, r.raw_room_type, r.channel,
      r.rate_usd AS refund_rate, r.raw_label AS refund_label,
      n.rate_usd AS nonref_rate, n.raw_label AS nonref_label
    FROM plans r
    JOIN plans n
      ON n.comp_id = r.comp_id AND n.stay_date = r.stay_date
     AND n.channel = r.channel AND n.raw_room_type = r.raw_room_type
    WHERE r.is_refundable = true AND n.is_refundable = false
      AND n.rate_usd > r.rate_usd
  )
  INSERT INTO revenue.parity_breaches
    (comp_id, shop_date, stay_date, severity, rule_code, rule_description,
     channel_a, channel_b, rate_a_usd, rate_b_usd, delta_usd, delta_pct,
     raw_room_type, raw_label_a, raw_label_b, agent_run_id)
  SELECT comp_id, shop_date, stay_date, 'critical', 'NONREFUND_GT_REFUND',
         'Non-refundable plan priced higher than refundable for same room — almost always a config mistake.',
         channel, channel,
         refund_rate, nonref_rate,
         nonref_rate - refund_rate,
         ROUND(((nonref_rate - refund_rate) / NULLIF(refund_rate,0)) * 100, 1),
         raw_room_type, refund_label, nonref_label, v_run_id
  FROM pairs;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- ============================================================
  -- RULE 2 (MEDIUM/LOW): rate jump > 10% / >25% vs prior shop_date
  -- ============================================================
  WITH today AS (
    SELECT po.comp_id, po.stay_date, po.channel, po.raw_label,
           po.raw_room_type, po.rate_usd, po.shop_date
    FROM revenue.parity_observations po
    WHERE po.shop_date = (SELECT MAX(shop_date) FROM revenue.parity_observations)
  ),
  yesterday AS (
    SELECT DISTINCT ON (po.comp_id, po.stay_date, po.channel, po.raw_label)
           po.comp_id, po.stay_date, po.channel, po.raw_label, po.rate_usd, po.shop_date
    FROM revenue.parity_observations po
    WHERE po.shop_date < (SELECT MAX(shop_date) FROM revenue.parity_observations)
    ORDER BY po.comp_id, po.stay_date, po.channel, po.raw_label, po.shop_date DESC
  ),
  jumps AS (
    SELECT t.comp_id, t.shop_date, t.stay_date, t.channel, t.raw_room_type,
           t.raw_label, y.rate_usd AS prior_rate, t.rate_usd AS new_rate,
           t.rate_usd - y.rate_usd AS delta_usd,
           ROUND(((t.rate_usd - y.rate_usd) / NULLIF(y.rate_usd, 0)) * 100, 1) AS delta_pct
    FROM today t
    JOIN yesterday y USING (comp_id, stay_date, channel, raw_label)
    WHERE ABS(t.rate_usd - y.rate_usd) > 0
      AND ABS(((t.rate_usd - y.rate_usd) / NULLIF(y.rate_usd, 0)) * 100) >= v_warn_pct
  )
  INSERT INTO revenue.parity_breaches
    (comp_id, shop_date, stay_date, severity, rule_code, rule_description,
     channel_a, rate_a_usd, rate_b_usd, delta_usd, delta_pct,
     raw_room_type, raw_label_a, agent_run_id)
  SELECT comp_id, shop_date, stay_date,
         CASE WHEN ABS(delta_pct) >= v_alert_pct THEN 'medium' ELSE 'low' END,
         'RATE_JUMP_DOD',
         'Rate moved >' || v_warn_pct || '% vs prior shop_date for the same plan.',
         channel, prior_rate, new_rate, delta_usd, delta_pct,
         raw_room_type, raw_label, v_run_id
  FROM jumps;

  -- Mark run finished
  UPDATE governance.agent_runs
  SET status = 'success', finished_at = now(),
      duration_ms = 0, cost_usd = 0,
      output = jsonb_build_object('mode','internal_bdc','breaches_inserted', v_inserted)
  WHERE run_id = v_run_id;

  RETURN QUERY SELECT v_run_id, v_inserted;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.parity_check_internal() TO service_role, authenticated;

-- 6. Public views the page reads
CREATE OR REPLACE VIEW public.v_parity_open_breaches AS
SELECT b.*, cp.property_name
FROM revenue.parity_breaches b
JOIN revenue.competitor_property cp ON cp.comp_id = b.comp_id
WHERE NOT b.resolved
ORDER BY
  CASE b.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END,
  b.detected_at DESC;

CREATE OR REPLACE VIEW public.v_parity_summary AS
SELECT
  cp.property_name,
  COUNT(*) FILTER (WHERE NOT b.resolved AND b.severity = 'critical') AS open_critical,
  COUNT(*) FILTER (WHERE NOT b.resolved AND b.severity = 'high')     AS open_high,
  COUNT(*) FILTER (WHERE NOT b.resolved AND b.severity = 'medium')   AS open_medium,
  COUNT(*) FILTER (WHERE NOT b.resolved AND b.severity = 'low')      AS open_low,
  COUNT(*) FILTER (WHERE NOT b.resolved)                              AS open_total,
  COUNT(*) FILTER (WHERE b.detected_at >= CURRENT_DATE - 7)          AS detected_7d,
  COUNT(*) FILTER (WHERE b.detected_at >= CURRENT_DATE - 30)         AS detected_30d,
  MAX(b.detected_at) AS last_detected_at
FROM revenue.competitor_property cp
LEFT JOIN revenue.parity_breaches b ON b.comp_id = cp.comp_id
WHERE cp.is_self = true
GROUP BY cp.property_name;

CREATE OR REPLACE VIEW public.v_parity_breaches_30d AS
SELECT
  date_trunc('day', detected_at)::date AS day,
  severity,
  COUNT(*) AS n
FROM revenue.parity_breaches
WHERE detected_at >= CURRENT_DATE - 30
GROUP BY 1, 2
ORDER BY 1 DESC;

GRANT SELECT ON public.v_parity_open_breaches, public.v_parity_summary, public.v_parity_breaches_30d
  TO anon, authenticated, service_role;

-- 7. Cron: 15 minutes after compset cron so we have fresh plans to check
SELECT cron.unschedule('parity-check-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='parity-check-daily');
SELECT cron.schedule(
  'parity-check-daily',
  '15 23 * * *',
  $$ SELECT public.parity_check_internal(); $$
);
