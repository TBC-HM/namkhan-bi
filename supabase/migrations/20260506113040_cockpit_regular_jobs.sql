-- Cockpit regular jobs (cron #54+: stale ticket reaper, hourly health,
-- daily incident review, daily prompt changelog).
-- Purpose: keep the agent network alive without manual intervention.
-- Method:  pg_cron + pg_net + INSERT triggers cockpit_tickets directly.
-- Author:  PBS via Claude (Cowork) · 2026-05-06
-- Applied via Supabase MCP on 2026-05-06 (migration: cockpit_regular_jobs).

-- Stale ticket reaper (every 5 min)
SELECT cron.schedule(
  'cockpit-stale-ticket-reaper',
  '*/5 * * * *',
  $$
    UPDATE public.cockpit_tickets
    SET status='triaged'
    WHERE status='working'
      AND iterations < 3
      AND updated_at < NOW() - INTERVAL '15 minutes';

    UPDATE public.cockpit_tickets
    SET status='triage_failed', notes = COALESCE(notes,'') || E'\n[reaper] gave up after 3 retries'
    WHERE status='working'
      AND iterations >= 3
      AND updated_at < NOW() - INTERVAL '30 minutes';
  $$
);

-- Hourly deploy health probe
SELECT cron.schedule(
  'cockpit-deploy-health-hourly',
  '7 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://namkhan-bi.vercel.app/api/cockpit/webhooks/incident?secret=ec5ca8f900b0d0611f8c8b64632202113736ce7627e0bbba',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'source', 'cockpit_health_probe',
        'symptom', 'periodic health check ' || NOW()::TEXT,
        'severity', 4,
        'metadata', jsonb_build_object('probe', true)
      ),
      timeout_milliseconds := 5000
    );
  $$
);

-- Daily incident review (08:00 UTC)
SELECT cron.schedule(
  'cockpit-daily-incident-review',
  '0 8 * * *',
  $$
    INSERT INTO public.cockpit_tickets (source, arm, intent, status, parsed_summary, iterations)
    VALUES ('cron_daily_review', 'triaging', 'monitor', 'new',
      'DAILY REVIEW: Scan cockpit_incidents and cockpit_audit_log for the last 24h. Output a one-paragraph review and a 3-item action list.',
      0);
  $$
);

-- Daily prompt-changelog (07:00 UTC)
SELECT cron.schedule(
  'cockpit-daily-prompt-changelog',
  '0 7 * * *',
  $$
    SELECT net.http_post(
      url := 'https://namkhan-bi.vercel.app/api/cockpit/webhooks/incident?secret=ec5ca8f900b0d0611f8c8b64632202113736ce7627e0bbba',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'source', 'prompt_changelog',
        'symptom', 'agent prompts changed in last 24h',
        'severity', 4,
        'metadata', jsonb_build_object(
          'changes', (SELECT jsonb_agg(jsonb_build_object('role', role, 'version', version, 'source', source, 'notes', notes))
            FROM public.cockpit_agent_prompts WHERE updated_at > NOW() - INTERVAL '24 hours' AND active=true),
          'count', (SELECT COUNT(*) FROM public.cockpit_agent_prompts WHERE updated_at > NOW() - INTERVAL '24 hours' AND active=true)
        )
      ),
      timeout_milliseconds := 5000
    )
    WHERE EXISTS (SELECT 1 FROM public.cockpit_agent_prompts WHERE updated_at > NOW() - INTERVAL '24 hours' AND active=true);
  $$
);
