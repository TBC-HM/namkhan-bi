// app/revenue/briefing/page.tsx
// PBS 2026-07-15 — Briefing = the revenue-area guardrail inbox.
// Every fired guardrail lands here as an actionable card. RM triages fast
// (accept · dismiss · snooze · investigate); accepts fire the CTA where
// possible; a daily cron scores whether accepted CTAs moved the KPI so the
// confidence of similar guardrails climbs over time.
//
// Read path : public.v_revenue_briefings + public.v_revenue_briefing_stats
// Write path: /api/revenue/briefing/decide → public.fn_briefing_decide
// Ingest    : public.fn_briefing_upsert (guardrail runners emit here — wiring
//             per source-area is next-cycle work).

import {
  DashboardPage, Container, KpiTile,
  type DashboardTab, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { REVENUE_SUBPAGES } from '../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import BriefingFeed, { type BriefingRow } from './_components/BriefingFeed';
import RefreshButton from './_components/RefreshButton';

export const revalidate = 30;
export const dynamic = 'force-dynamic';

interface Props { searchParams?: Record<string, string | string[] | undefined>; propertyId?: number }

interface StatsRow {
  property_id: number;
  total_30d: number;
  accepted_30d: number;
  dismissed_30d: number;
  missed_30d: number;
  open_now: number;
  avg_success_pct: number;
  wins_30d: number;
  losses_30d: number;
}

async function loadData(pid: number): Promise<{ items: BriefingRow[]; stats: StatsRow | null }> {
  const [itemsR, statsR] = await Promise.all([
    supabase.from('v_revenue_briefings')
      .select('id, property_id, source_area, source_key, severity, headline, body, cta_kind, cta_label, cta_target, cta_params, status, snoozed_until, outcome_success, outcome_scored_at, decided_at, decided_reason, created_at')
      .eq('property_id', pid)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('v_revenue_briefing_stats').select('*').eq('property_id', pid).maybeSingle(),
  ]);
  return {
    items: (itemsR.data ?? []) as BriefingRow[],
    stats: (statsR.data as StatsRow | null) ?? null,
  };
}

function pctOf(part: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

export default async function RevenueBriefingPage({ propertyId }: Props) {
  const pid = propertyId ?? PROPERTY_ID;
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  const tabs: DashboardTab[] = subPages.map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href.endsWith('/briefing'),
  }));

  const { items, stats } = await loadData(pid);

  const openNow    = stats?.open_now       ?? items.filter((i) => i.status === 'new' || i.status === 'snoozed').length;
  const accepted   = stats?.accepted_30d   ?? 0;
  const dismissed  = stats?.dismissed_30d  ?? 0;
  const missed     = stats?.missed_30d     ?? 0;
  const total30    = stats?.total_30d      ?? (accepted + dismissed + missed + openNow);
  const successPct = stats?.avg_success_pct ?? 0;
  const wins       = stats?.wins_30d       ?? 0;
  const losses     = stats?.losses_30d     ?? 0;
  const hasScoredAccepts = wins + losses > 0;

  const openStatus: KpiTileProps['status']    = openNow >= 10 ? 'red' : openNow >= 5 ? 'amber' : 'green';
  const missedStatus: KpiTileProps['status']  = missed > 0 ? 'red' : 'grey';
  const successStatus: KpiTileProps['status'] = !hasScoredAccepts ? 'grey' : successPct >= 60 ? 'green' : successPct >= 40 ? 'amber' : 'red';

  const tiles: KpiTileProps[] = [
    { label: 'Open now', value: openNow, size: 'sm',
      footnote: openNow >= 10 ? 'triage backlog high' : openNow >= 5 ? 'stay on top of these' : 'inbox healthy',
      status: openStatus },
    { label: 'Accepted (30d)', value: accepted, size: 'sm',
      footnote: `${pctOf(accepted, total30)} of ${total30}`,
      status: 'green' },
    { label: 'Dismissed (30d)', value: dismissed, size: 'sm',
      footnote: `${pctOf(dismissed, total30)} of ${total30}`,
      status: 'grey' },
    { label: 'Missed / Expired', value: missed, size: 'sm',
      footnote: missed > 0 ? 'guardrails that never got triaged' : 'nothing slipped',
      status: missedStatus },
    { label: 'Avg success after accept', value: hasScoredAccepts ? `${successPct}%` : '—', size: 'sm',
      footnote: hasScoredAccepts ? `${wins} wins · ${losses} losses` : 'measuring · needs ≥3 scored accepts',
      status: successStatus },
  ];

  return (
    <DashboardPage
      title="Revenue · Briefing"
      subtitle="Every guardrail fired in the revenue area — triage in seconds. Accepts fire the CTA; a daily job scores whether the KPI actually moved."
      tabs={tabs}
    >
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        {tiles.map((t) => <KpiTile key={t.label} {...t} />)}
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="Guardrail feed"
          subtitle={`${items.length} item${items.length === 1 ? '' : 's'} · auto-refresh 06:00 Vientiane · accept to fire the CTA, dismiss to log why, snooze 24h to defer`}
          density="compact"
          action={<RefreshButton propertyId={pid} />}
        >
          <BriefingFeed initial={items} />
        </Container>
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="How the learning loop works" subtitle="the more you triage, the sharper the signal" density="compact">
          <p style={{ margin: 0, color: '#4a4a4a', fontSize: 13, lineHeight: 1.55 }}>
            Every accept is timestamped and its KPI baseline snapshotted. 3-14 days later a daily job compares the current KPI value against that baseline in the direction the CTA proposed. Wins raise the confidence of similar guardrails (they show up higher and fire more aggressively); losses lower it (thresholds widen, that rule fires less often). Dismissals with a reason (<i>not_relevant</i>, <i>threshold_too_tight</i>, <i>false_signal</i>) feed the same loop. This is why triaging every card matters — even a dismiss with a one-word reason trains the system.
          </p>
        </Container>
      </div>
    </DashboardPage>
  );
}
