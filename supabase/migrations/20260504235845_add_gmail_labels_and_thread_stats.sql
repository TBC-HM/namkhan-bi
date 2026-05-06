-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504235845
-- Name:    add_gmail_labels_and_thread_stats
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Gmail's labels travel with the message. Includes SPAM, IMPORTANT, CATEGORY_*,
-- INBOX, SENT, STARRED, plus user-defined labels.
ALTER TABLE sales.email_messages
  ADD COLUMN IF NOT EXISTS gmail_labels text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS email_messages_labels_gin
  ON sales.email_messages USING GIN (gmail_labels);

-- Per-thread response time view: time from first inbound message to first
-- outbound reply, in minutes. NULL when there's no reply yet.
CREATE OR REPLACE VIEW sales.v_thread_response AS
WITH first_in AS (
  SELECT property_id, thread_id, MIN(received_at) AS first_in_at
  FROM sales.email_messages
  WHERE direction='inbound' AND thread_id IS NOT NULL
  GROUP BY property_id, thread_id
),
first_out AS (
  SELECT property_id, thread_id, MIN(received_at) AS first_out_at
  FROM sales.email_messages
  WHERE direction='outbound' AND thread_id IS NOT NULL
  GROUP BY property_id, thread_id
)
SELECT
  COALESCE(fi.property_id, fo.property_id) AS property_id,
  COALESCE(fi.thread_id, fo.thread_id)     AS thread_id,
  fi.first_in_at,
  fo.first_out_at,
  CASE
    WHEN fi.first_in_at IS NOT NULL AND fo.first_out_at IS NOT NULL AND fo.first_out_at >= fi.first_in_at
      THEN ROUND(EXTRACT(EPOCH FROM (fo.first_out_at - fi.first_in_at))/60)::int
    ELSE NULL
  END AS response_minutes
FROM first_in fi
FULL OUTER JOIN first_out fo
  ON fi.property_id = fo.property_id AND fi.thread_id = fo.thread_id;

GRANT SELECT ON sales.v_thread_response TO service_role;

-- Per-mailbox aggregate
CREATE OR REPLACE VIEW sales.v_mailbox_stats AS
SELECT
  m.property_id,
  m.intended_mailbox,
  COUNT(*) AS msgs,
  COUNT(DISTINCT m.thread_id) AS threads,
  COUNT(*) FILTER (WHERE m.direction='inbound')  AS inbound,
  COUNT(*) FILTER (WHERE m.direction='outbound') AS outbound,
  COUNT(*) FILTER (WHERE 'SPAM'      = ANY(m.gmail_labels)) AS spam,
  COUNT(*) FILTER (WHERE 'IMPORTANT' = ANY(m.gmail_labels)) AS important,
  COUNT(*) FILTER (WHERE 'STARRED'   = ANY(m.gmail_labels)) AS starred,
  COUNT(*) FILTER (WHERE m.gmail_labels && ARRAY['CATEGORY_PROMOTIONS','CATEGORY_UPDATES','CATEGORY_FORUMS']) AS bulk_category,
  PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY tr.response_minutes) FILTER (WHERE tr.response_minutes IS NOT NULL) AS median_response_min,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY tr.response_minutes) FILTER (WHERE tr.response_minutes IS NOT NULL) AS p95_response_min,
  COUNT(*) FILTER (WHERE tr.response_minutes IS NULL AND m.direction='inbound') AS unanswered
FROM sales.email_messages m
LEFT JOIN sales.v_thread_response tr
  ON tr.property_id = m.property_id AND tr.thread_id = m.thread_id
GROUP BY m.property_id, m.intended_mailbox;
GRANT SELECT ON sales.v_mailbox_stats TO service_role;

NOTIFY pgrst, 'reload schema';
