-- Cockpit additional scheduled tasks (4 more cron jobs).
-- Purpose: weekly team summary, weekly cost report, daily KB curate,
--          daily multi-page deep health check.
-- Method:  pg_cron + INSERT into cockpit_tickets for IT-Manager review tickets,
--          + pg_net for the cost report webhook.
-- Author:  PBS via Claude (Cowork) · 2026-05-06
-- Applied via Supabase MCP on 2026-05-06 (migration: cockpit_more_scheduled_tasks).

-- Weekly team summary (Monday 09:00 UTC)
SELECT cron.schedule(
  'cockpit-weekly-team-summary',
  '0 9 * * 1',
  $$
    INSERT INTO public.cockpit_tickets (source, arm, intent, status, parsed_summary, iterations)
    VALUES ('cron_weekly_summary', 'triaging', 'investigate', 'new',
      'WEEKLY TEAM SUMMARY (auto): Read audit log + tickets for the last 7 days. Output: total tickets, completed vs awaits_user vs failed, top 3 agents by run count, top 3 by cost, common themes, 2 concrete improvements.',
      0);
  $$
);

-- Weekly cost report (Sunday 23:00 UTC)
SELECT cron.schedule(
  'cockpit-weekly-cost-report',
  '0 23 * * 0',
  $$
    SELECT net.http_post(
      url := 'https://namkhan-bi.vercel.app/api/cockpit/webhooks/incident?secret=ec5ca8f900b0d0611f8c8b64632202113736ce7627e0bbba',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'source', 'cost_report',
        'symptom', 'weekly Anthropic spend report',
        'severity', CASE WHEN (SELECT COALESCE(SUM(cost_usd_milli), 0) FROM public.cockpit_audit_log
            WHERE created_at > NOW() - INTERVAL '7 days') > 5000 THEN 2 ELSE 4 END,
        'metadata', jsonb_build_object(
          'total_milli_usd', (SELECT COALESCE(SUM(cost_usd_milli), 0) FROM public.cockpit_audit_log WHERE created_at > NOW() - INTERVAL '7 days'),
          'total_input_tokens', (SELECT COALESCE(SUM(input_tokens), 0) FROM public.cockpit_audit_log WHERE created_at > NOW() - INTERVAL '7 days'),
          'total_output_tokens', (SELECT COALESCE(SUM(output_tokens), 0) FROM public.cockpit_audit_log WHERE created_at > NOW() - INTERVAL '7 days'),
          'top_agents', (SELECT jsonb_agg(row_to_json(x)) FROM (
            SELECT agent, COUNT(*) as runs, COALESCE(SUM(cost_usd_milli),0) as cost_milli
            FROM public.cockpit_audit_log
            WHERE created_at > NOW() - INTERVAL '7 days' AND cost_usd_milli IS NOT NULL
            GROUP BY agent ORDER BY cost_milli DESC LIMIT 5
          ) x)
        )
      ),
      timeout_milliseconds := 5000
    );
  $$
);

-- Daily knowledge-base curate (06:00 UTC)
SELECT cron.schedule(
  'cockpit-daily-kb-curate',
  '0 6 * * *',
  $$
    INSERT INTO public.cockpit_tickets (source, arm, intent, status, parsed_summary, iterations)
    VALUES ('cron_daily_kb_curate', 'triaging', 'document', 'new',
      'KB CURATE (auto): Call read_knowledge_base with no filter and scan everything. Identify (a) duplicates that should merge, (b) stale entries pointing to deleted code, (c) low-confidence facts that have been consistently confirmed in recent tickets. Output a list of recommended actions. Do NOT add or remove entries — just propose.',
      0);
  $$
);

-- Daily deep multi-page health check (06:10 UTC)
SELECT cron.schedule(
  'cockpit-daily-deep-health',
  '10 6 * * *',
  $$
    INSERT INTO public.cockpit_tickets (source, arm, intent, status, parsed_summary, iterations)
    VALUES ('cron_daily_health', 'triaging', 'monitor', 'new',
      'DEEP HEALTH CHECK (auto): Call list_vercel_deploys to confirm last prod deploy is READY. web_fetch each of: /overview, /sales/inquiries, /revenue/compset, /revenue/parity, /operations/staff. Report 200/non-200 + add a knowledge-base entry if any page is consistently slow or failing.',
      0);
  $$
);
