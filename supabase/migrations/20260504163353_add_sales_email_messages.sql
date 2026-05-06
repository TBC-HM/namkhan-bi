-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504163353
-- Name:    add_sales_email_messages
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Full email capture table: inbound + outbound, threaded by gmail thread_id.
-- Used by /api/sales/email-ingest (Make.com Gmail watchers + backfill).
-- Each message links optionally to a sales.inquiries row (inbound creates one;
-- outbound matches by thread_id).

CREATE TABLE IF NOT EXISTS sales.email_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     bigint NOT NULL,
  message_id      text NOT NULL,                                  -- RFC 2822 Message-Id (unique per email)
  thread_id       text,                                           -- Gmail thread id (groups all messages in a conversation)
  in_reply_to     text,                                           -- Message-Id this email replies to (RFC 2822 In-Reply-To header)
  direction       text NOT NULL CHECK (direction IN ('inbound','outbound')),
  mailbox         text NOT NULL,                                  -- 'book@thenamkhan.com', 'reservations@thenamkhan.com', 'wm@thenamkhan.com'
  from_email      text,
  from_name       text,
  to_emails       text[] NOT NULL DEFAULT '{}',
  cc_emails       text[] NOT NULL DEFAULT '{}',
  subject         text,
  body_text       text,
  body_html       text,
  received_at     timestamptz NOT NULL,
  gmail_msg_id    text,                                           -- Gmail's internal id (for API re-fetch)
  inquiry_id      uuid REFERENCES sales.inquiries(id) ON DELETE SET NULL,
  raw_payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  ingest_source   text NOT NULL DEFAULT 'make.gmail',             -- 'make.gmail' | 'backfill' | 'cf-worker'
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_messages_message_id_uq
  ON sales.email_messages (property_id, message_id);
CREATE INDEX IF NOT EXISTS email_messages_thread_idx
  ON sales.email_messages (property_id, thread_id);
CREATE INDEX IF NOT EXISTS email_messages_inquiry_idx
  ON sales.email_messages (inquiry_id);
CREATE INDEX IF NOT EXISTS email_messages_received_idx
  ON sales.email_messages (property_id, received_at DESC);
CREATE INDEX IF NOT EXISTS email_messages_direction_received_idx
  ON sales.email_messages (property_id, direction, received_at DESC);

GRANT SELECT, INSERT, UPDATE ON sales.email_messages TO service_role;

-- Helper view: all messages joined to their inquiry (or orphan)
CREATE OR REPLACE VIEW sales.v_email_thread AS
SELECT
  m.id,
  m.property_id,
  m.thread_id,
  m.message_id,
  m.in_reply_to,
  m.direction,
  m.mailbox,
  m.from_email, m.from_name,
  m.to_emails, m.cc_emails,
  m.subject,
  LEFT(m.body_text, 500) AS body_excerpt,
  m.received_at,
  m.inquiry_id,
  i.guest_name AS inquiry_guest_name,
  i.status AS inquiry_status,
  i.triage_kind
FROM sales.email_messages m
LEFT JOIN sales.inquiries i ON i.id = m.inquiry_id;

GRANT SELECT ON sales.v_email_thread TO service_role;
