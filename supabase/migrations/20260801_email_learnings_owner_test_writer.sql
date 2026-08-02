-- Brief newsletter-owner-test-feedback-writer-v1 (goal 27, ADR-203 writer half)
-- APPLIED LIVE 2026-08-01 via Supabase MCP apply_migration (this file is the repo record).
-- A4 idempotency column + partial unique index, A6 resolve→re-test trigger
-- (two-phase per rule 531 — pure SQL, existing send-batch cron drains),
-- A7 Decision Inbox bridge fn, A8 cron gate fn + job-153 reschedule.

-- A4: idempotency
ALTER TABLE marketing.email_learnings ADD COLUMN IF NOT EXISTS source_message_id text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_learnings_src_msg
  ON marketing.email_learnings (property_id, source_message_id)
  WHERE source_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_email_learnings_campaign_source
  ON marketing.email_learnings (campaign_id, source);

-- A6: resolve → owner re-test enqueue (data-layer trigger, ADR-183 pattern; NO HTTP — rule 531)
CREATE OR REPLACE FUNCTION marketing.fn_email_learnings_owner_retest()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'marketing','guest','public','pg_temp'
AS $fn$
BEGIN
  IF NEW.source = 'owner_test_feedback'
     AND NEW.active IS TRUE
     AND COALESCE(OLD.active, false) IS FALSE
     AND NEW.campaign_id IS NOT NULL THEN
    INSERT INTO guest.campaign_recipients
      (campaign_id, guest_id, full_name, email, send_status, send_at, snapshot_at, track_code)
    VALUES
      (NEW.campaign_id, 'test-owner-pbs', 'PBS (owner test)', 'pb@thenamkhan.com', 'pending', now(), now(), replace(gen_random_uuid()::text, '-', '')),
      (NEW.campaign_id, 'test-owner-xl',  'XL (owner test)',  'xl@thenamkhan.com', 'pending', now(), now(), replace(gen_random_uuid()::text, '-', ''))
    ON CONFLICT (campaign_id, guest_id) DO UPDATE
      SET send_status = 'pending',
          send_at     = now(),
          sent_at     = NULL,
          error       = NULL,
          track_code  = EXCLUDED.track_code
      WHERE guest.campaign_recipients.send_status <> 'pending';
  END IF;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION marketing.fn_email_learnings_owner_retest() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tg_email_learnings_owner_retest ON marketing.email_learnings;
CREATE TRIGGER tg_email_learnings_owner_retest
  AFTER UPDATE ON marketing.email_learnings
  FOR EACH ROW EXECUTE FUNCTION marketing.fn_email_learnings_owner_retest();

-- A7: Decision Inbox bridge (PostgREST exposes public only — L5).
CREATE OR REPLACE FUNCTION public.fn_set_brief_open_question(p_slug text, p_question jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'documentation','public','pg_temp'
AS $fn$
DECLARE v_existing jsonb;
BEGIN
  SELECT open_question INTO v_existing FROM documentation.build_briefs WHERE slug = p_slug;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'brief_not_found');
  END IF;
  IF v_existing IS NOT NULL AND (v_existing->>'answered') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'question_pending');
  END IF;
  UPDATE documentation.build_briefs
     SET open_question = p_question,
         last_updated_at = now()
   WHERE slug = p_slug;
  RETURN jsonb_build_object('ok', true);
END $fn$;
REVOKE ALL ON FUNCTION public.fn_set_brief_open_question(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_set_brief_open_question(text, jsonb) TO service_role;

-- A8: decay gate — TRUE when hourly floor (minute 0) OR an owner-test send in
-- the last 24h still lacks a matched learning. Single */15 cron, no reschedule churn.
CREATE OR REPLACE FUNCTION marketing.fn_owner_test_scan_due()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'marketing','pg_temp'
AS $fn$
  SELECT EXTRACT(minute FROM now())::int = 0
      OR EXISTS (
        SELECT 1 FROM marketing.email_send_history h
        WHERE h.subscriber_email IN ('pb@thenamkhan.com','xl@thenamkhan.com')
          AND h.sent_at > now() - interval '24 hours'
          AND h.campaign_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM marketing.email_learnings l
            WHERE l.campaign_id = h.campaign_id
              AND l.source = 'owner_test_feedback'
              AND l.created_at >= h.sent_at
          )
      );
$fn$;
REVOKE ALL ON FUNCTION marketing.fn_owner_test_scan_due() FROM PUBLIC, anon, authenticated;

-- A8: reschedule job 153 to */15 with the gate (was */30 ungated).
SELECT cron.alter_job(
  153,
  schedule => '*/15 * * * *',
  command  => $cmd$
    SELECT net.http_post(
      url  := 'https://namkhan-bi.vercel.app/api/marketing/gmail/scan-replies',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-cron-secret', COALESCE(
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SHARED_SECRET' LIMIT 1),
          ''
        )
      ),
      body := jsonb_build_object('window_hours', 6, 'max_messages', 500),
      timeout_milliseconds := 30000
    )
    WHERE marketing.fn_owner_test_scan_due();
  $cmd$
);
