-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504205246
-- Name:    add_gmail_connections
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- One row per Gmail mailbox we poll. Refresh token survives access_token expiry.
-- last_history_id = Gmail's incremental cursor (Make's watermark equivalent, but we control it).
CREATE TABLE IF NOT EXISTS sales.gmail_connections (
  email             text PRIMARY KEY,                 -- e.g. pb@thenamkhan.com
  refresh_token     text NOT NULL,                    -- long-lived, used to mint access tokens
  scope             text NOT NULL DEFAULT 'https://www.googleapis.com/auth/gmail.readonly',
  property_id       bigint NOT NULL DEFAULT 260955,
  last_history_id   text,                             -- Gmail's incremental sync cursor
  last_synced_at    timestamptz,
  total_synced      bigint NOT NULL DEFAULT 0,
  paused            boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON sales.gmail_connections TO service_role;

-- Track every poll run for debugging + visibility
CREATE TABLE IF NOT EXISTS sales.gmail_poll_runs (
  id                bigserial PRIMARY KEY,
  email             text NOT NULL REFERENCES sales.gmail_connections(email) ON DELETE CASCADE,
  started_at        timestamptz NOT NULL DEFAULT now(),
  finished_at       timestamptz,
  status            text NOT NULL DEFAULT 'running',  -- running | success | error
  messages_seen     int NOT NULL DEFAULT 0,
  messages_inserted int NOT NULL DEFAULT 0,
  messages_skipped  int NOT NULL DEFAULT 0,
  error_message     text
);
CREATE INDEX IF NOT EXISTS gmail_poll_runs_email_idx ON sales.gmail_poll_runs (email, started_at DESC);
GRANT SELECT, INSERT, UPDATE ON sales.gmail_poll_runs TO service_role;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE sales.gmail_poll_runs_id_seq TO service_role;
