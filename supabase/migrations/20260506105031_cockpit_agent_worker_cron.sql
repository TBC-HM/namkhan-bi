-- Cockpit agent worker cron job (#53).
-- Purpose: drain the cockpit_tickets queue every minute by POSTing to the
--          /api/cockpit/agent/run endpoint with a bearer token. Backstop for
--          tickets that arrived via email/webhook OR if the chat-route's
--          fire-and-forget fetch was killed by Vercel function lifetime.
-- Method:  pg_net http_post + bearer (token stored inline; cron.job is only
--          visible to postgres role, not exposed via PostgREST).
-- Note:    Token rotation requires UPDATE cron.job SET command=... when needed.
-- Author:  PBS via Claude (Cowork) · 2026-05-06
-- Applied via Supabase MCP on 2026-05-06 (migration: cockpit_agent_worker_cron).

SELECT cron.schedule(
  'cockpit-agent-worker',
  '* * * * *',
  $$
    SELECT net.http_post(
      url := 'https://namkhan-bi.vercel.app/api/cockpit/agent/run',
      headers := jsonb_build_object(
        'Authorization', 'Bearer 58a974d1ef2bc5cdc28291e7d43ec19cb29989023dbc1409',
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $$
);
