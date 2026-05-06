-- Email -> cockpit ticket bridge.
-- Purpose: when a new email lands in sales.email_messages, check if it is
--          addressed to the IT department and auto-create a cockpit_tickets
--          row with status='new'. The cockpit-agent-worker cron picks it up
--          within 60s and triages.
-- Method:  AFTER INSERT trigger; matches subject prefix [cockpit] OR
--          recipient in intake list (Gmail aliases + future custom domain).
-- Note:    SECURITY DEFINER. Failure path swallows errors so a broken
--          cockpit bridge never blocks the email ingest pipeline.
-- Author:  PBS via Claude (Cowork) · 2026-05-06
-- Applied via Supabase MCP on 2026-05-06 (migration: cockpit_email_intake_trigger).

CREATE OR REPLACE FUNCTION public.cockpit_email_to_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, sales
AS $$
DECLARE
  is_cockpit_intent BOOLEAN := FALSE;
  intake_addresses TEXT[] := ARRAY[
    'pbsbase+cockpit@gmail.com',
    'pbsbase+dev@gmail.com',
    'dev@thedonnaportals.com',
    'dev@thenamkhan.com',
    'cockpit@thenamkhan.com'
  ];
  combined_recipients TEXT[];
BEGIN
  IF NEW.direction IS DISTINCT FROM 'inbound' THEN
    RETURN NEW;
  END IF;

  IF NEW.subject IS NOT NULL AND NEW.subject ~* '^\s*\[cockpit\]' THEN
    is_cockpit_intent := TRUE;
  END IF;

  combined_recipients := COALESCE(NEW.to_emails, ARRAY[]::TEXT[]) ||
                         COALESCE(NEW.cc_emails, ARRAY[]::TEXT[]);
  IF combined_recipients && intake_addresses THEN
    is_cockpit_intent := TRUE;
  END IF;

  IF NOT is_cockpit_intent THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.cockpit_tickets (
    source, arm, intent, status,
    email_subject, email_body, parsed_summary, iterations, notes
  ) VALUES (
    'email', 'triaging', 'triage', 'new',
    LEFT(COALESCE(NEW.subject, '(no subject)'), 500),
    LEFT(COALESCE(NEW.body_text, NEW.body_html, ''), 8000),
    CONCAT('From: ', COALESCE(NEW.from_email, 'unknown'), E'\n\n', LEFT(COALESCE(NEW.body_text, ''), 500)),
    0,
    jsonb_build_object(
      'gmail_msg_id', NEW.gmail_msg_id,
      'thread_id', NEW.thread_id,
      'from_email', NEW.from_email,
      'from_name', NEW.from_name,
      'mailbox', NEW.mailbox,
      'received_at', NEW.received_at
    )::TEXT
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[cockpit_email_to_ticket] %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cockpit_email_to_ticket ON sales.email_messages;
CREATE TRIGGER trg_cockpit_email_to_ticket
  AFTER INSERT ON sales.email_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.cockpit_email_to_ticket();

COMMENT ON FUNCTION public.cockpit_email_to_ticket IS
  'Bridges sales.email_messages → public.cockpit_tickets when subject starts with [cockpit] or recipient matches a known intake address.';
