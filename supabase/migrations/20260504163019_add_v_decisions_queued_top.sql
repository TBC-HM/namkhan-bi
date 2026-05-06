-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504163019
-- Name:    add_v_decisions_queued_top
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Public proxy so PostgREST can read the queue without exposing the
-- governance schema. Returns top decisions ranked by absolute $ impact,
-- only for active (queued/pending) status, scoped to the Pulse tab.
CREATE OR REPLACE VIEW public.v_decisions_queued_top AS
SELECT
  d.decision_id,
  d.source_agent,
  d.scope_section,
  d.scope_tab,
  d.title,
  d.impact_usd,
  d.confidence_pct,
  d.velocity,
  d.status,
  d.created_at,
  d.expires_at,
  EXTRACT(EPOCH FROM (now() - d.created_at)) / 3600.0 AS hours_open,
  d.meta
FROM governance.decision_queue d
WHERE d.status IN ('queued', 'pending', 'awaiting_approval', 'open')
  AND (d.expires_at IS NULL OR d.expires_at > now())
ORDER BY ABS(COALESCE(d.impact_usd, 0)) DESC NULLS LAST,
         d.created_at DESC
LIMIT 12;
GRANT SELECT ON public.v_decisions_queued_top TO anon, authenticated;