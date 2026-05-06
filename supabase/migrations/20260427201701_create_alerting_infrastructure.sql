-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427201701
-- Name:    create_alerting_infrastructure
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE SCHEMA IF NOT EXISTS alerts;

-- Webhook endpoints (Slack/Telegram/email/etc)
CREATE TABLE IF NOT EXISTS alerts.channels (
  channel_id text PRIMARY KEY,
  name text NOT NULL,
  channel_type text NOT NULL CHECK (channel_type IN ('slack','telegram','email','webhook')),
  webhook_url text NOT NULL,
  min_severity text NOT NULL DEFAULT 'WARNING' CHECK (min_severity IN ('CRITICAL','WARNING','INFO')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Sent log (to avoid duplicate alerts)
CREATE TABLE IF NOT EXISTS alerts.sent (
  sent_id bigserial PRIMARY KEY,
  channel_id text REFERENCES alerts.channels(channel_id),
  rule_id text,
  violation_count int,
  message text,
  sent_at timestamptz DEFAULT now(),
  http_status int,
  response text
);

CREATE INDEX IF NOT EXISTS ix_alerts_sent_recent 
  ON alerts.sent(rule_id, channel_id, sent_at DESC);

-- Daily digest function — sends summary of violations to all channels
CREATE OR REPLACE FUNCTION alerts.send_digest()
RETURNS TABLE(channel_id text, status text, violations_summary jsonb)
LANGUAGE plpgsql
AS $$
DECLARE
  c RECORD;
  v_summary jsonb;
  v_text text;
  v_critical_count int;
  v_warning_count int;
  v_request_id bigint;
BEGIN
  -- Only run if pg_net extension is available
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_net extension not installed — skipping HTTP send';
    RETURN;
  END IF;

  -- Build summary of unresolved violations
  SELECT 
    COUNT(*) FILTER (WHERE severity='CRITICAL'),
    COUNT(*) FILTER (WHERE severity='WARNING')
  INTO v_critical_count, v_warning_count
  FROM dq.violations
  WHERE resolved_at IS NULL
    AND detected_at >= now() - interval '24 hours';

  v_summary := jsonb_build_object(
    'critical', v_critical_count,
    'warning', v_warning_count,
    'top_rules', (
      SELECT jsonb_agg(jsonb_build_object('rule_id', rule_id, 'count', cnt))
      FROM (
        SELECT rule_id, COUNT(*) AS cnt
        FROM dq.violations
        WHERE resolved_at IS NULL AND detected_at >= now() - interval '24 hours'
        GROUP BY rule_id
        ORDER BY cnt DESC
        LIMIT 5
      ) t
    )
  );

  -- Iterate active channels and send
  FOR c IN SELECT * FROM alerts.channels WHERE is_active LOOP
    -- Build message for this channel based on min_severity
    IF c.min_severity = 'CRITICAL' AND v_critical_count = 0 THEN
      CONTINUE;
    END IF;
    
    -- Format message
    v_text := format(
      '🏨 The Namkhan BI Daily Digest%s🚨 Critical: %s%s⚠️  Warning: %s%sTop rules: %s',
      E'\n', v_critical_count, E'\n', v_warning_count, E'\n',
      COALESCE(v_summary->'top_rules', '[]'::jsonb)::text
    );

    -- Send via pg_net (works for Slack incoming webhook & Telegram bot API)
    IF c.channel_type = 'slack' THEN
      SELECT net.http_post(
        url := c.webhook_url,
        body := jsonb_build_object('text', v_text)
      ) INTO v_request_id;
    ELSIF c.channel_type = 'telegram' THEN
      -- Telegram URL format: https://api.telegram.org/bot{TOKEN}/sendMessage?chat_id={CHAT_ID}
      SELECT net.http_post(
        url := c.webhook_url,
        body := jsonb_build_object('text', v_text, 'parse_mode', 'Markdown')
      ) INTO v_request_id;
    END IF;

    -- Log
    INSERT INTO alerts.sent (channel_id, rule_id, violation_count, message)
    VALUES (c.channel_id, NULL, v_critical_count + v_warning_count, v_text);

    RETURN QUERY SELECT c.channel_id::text, 'sent'::text, v_summary;
  END LOOP;
END;
$$;

-- Per-violation alert (for CRITICAL severity, real-time)
CREATE OR REPLACE FUNCTION alerts.send_critical(p_violation_id bigint)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v RECORD;
  c RECORD;
  v_text text;
  v_request_id bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RETURN;
  END IF;

  SELECT * INTO v FROM dq.violations WHERE violation_id = p_violation_id;
  IF NOT FOUND OR v.severity != 'CRITICAL' THEN RETURN; END IF;

  -- Don't spam — skip if same rule alerted within last 4 hours
  IF EXISTS (
    SELECT 1 FROM alerts.sent
    WHERE rule_id = v.rule_id AND sent_at >= now() - interval '4 hours'
  ) THEN
    RETURN;
  END IF;

  v_text := format(
    '🚨 CRITICAL: %s%sEntity: %s%sDetails: %s',
    v.rule_id, E'\n', COALESCE(v.entity_id, 'N/A'), E'\n', v.details::text
  );

  FOR c IN SELECT * FROM alerts.channels WHERE is_active AND min_severity IN ('CRITICAL','WARNING','INFO') LOOP
    IF c.channel_type = 'slack' THEN
      SELECT net.http_post(
        url := c.webhook_url,
        body := jsonb_build_object('text', v_text)
      ) INTO v_request_id;
    ELSIF c.channel_type = 'telegram' THEN
      SELECT net.http_post(
        url := c.webhook_url,
        body := jsonb_build_object('text', v_text, 'parse_mode', 'Markdown')
      ) INTO v_request_id;
    END IF;

    INSERT INTO alerts.sent (channel_id, rule_id, violation_count, message)
    VALUES (c.channel_id, v.rule_id, 1, v_text);
  END LOOP;
END;
$$;

-- Test/placeholder webhook (will not fire until real URL is added)
INSERT INTO alerts.channels (channel_id, name, channel_type, webhook_url, min_severity, is_active)
VALUES 
  ('slack_ops', 'Slack #namkhan-ops (placeholder)', 'slack', 
   'https://hooks.slack.com/services/PLACEHOLDER/REPLACE/WITH_REAL_URL', 
   'WARNING', false),
  ('telegram_paul', 'Telegram Paul (placeholder)', 'telegram',
   'https://api.telegram.org/botPLACEHOLDER/sendMessage?chat_id=PLACEHOLDER',
   'CRITICAL', false)
ON CONFLICT (channel_id) DO NOTHING;