// app/operations/page.tsx
// Operations · Snapshot — period-aware (?win=, ?cmp=, ?seg=).
// Note: "Today" KPIs (in-house/arrivals/departures) are always real-time
// and ignore window. The window only applies to capture rate / DQ trend cards.

import PanelHero from '@/components/sections/PanelHero';
import KpiCard from '@/components/kpi/KpiCard';
import ActionCard, { ActionStack } from '@/components/sections/ActionCard';
import { getKpiToday, getDqIssues, getCaptureRates } from '@/lib/data';
import { resolvePeriod } from '@/lib/period';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function OperationsSnapshotPage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);
  const [today, dq, cap] = await Promise.all([
    getKpiToday().catch(() => null),
    getDqIssues().catch(() => []),
    getCaptureRates().catch(() => null),
  ]);

  const inHouse = today?.in_house ?? 0;
  const arr = today?.arrivals_today ?? 0;
  const dep = today?.departures_today ?? 0;
  const avail = (today?.total_rooms ?? 0) - inHouse;

  const fnbCap = Number(cap?.fnb_capture_pct ?? 0);
  const fnbRevPerOccRn = Number(cap?.fnb_per_occ_room ?? 0);

  // Action cards
  const cards: any[] = [];

  const hk = dq.find((d: any) => d.category === 'HOUSEKEEPING_SCOPE_MISSING');
  if (hk) {
    cards.push({
      pillar: 'ops' as const,
      pillarLabel: 'Operations · Property',
      agentLabel: '· DQ Agent',
      priority: 'high' as const,
      priorityLabel: 'High priority',
      headline: <>Housekeeping API <em>scope-blocked</em>.<br />OOO/OOS rooms invisible.</>,
      conclusion: <>
        Cloudbeds <strong>getHousekeepingStatus</strong> returns 403. Front-desk relying on
        whiteboard. Open ticket with Cloudbeds support requesting{' '}
        <strong>housekeeping:read</strong> scope on API key.
      </>,
      verdict: [
        { label: 'Confidence · 100%' },
        { label: 'Blocker · severity high', tone: 'bad' as const },
        { label: 'External · Cloudbeds' },
      ],
      primaryAction: 'Open ticket',
      secondaryAction: 'Defer',
      tertiaryAction: 'Mark as known',
      impact: 'Visibility',
      impactSub: 'OOO/OOS unblocked',
    });
  }

  if (fnbCap > 0 && fnbCap < 70) {
    const capGap = 70 - fnbCap;
    const missingResv = (capGap / 100) * (cap?.total_resv ?? 0);
    const monthlyUpside = Math.round(missingResv * fnbRevPerOccRn * 0.5);
    const annualUpside = monthlyUpside * 12;

    cards.push({
      pillar: 'ops' as const,
      pillarLabel: 'Operations · Restaurant',
      agentLabel: '· F&B Capture Agent',
      priority: 'med' as const,
      priorityLabel: 'Medium · 30d trend',
      headline: <>F&B capture <em>at {fnbCap.toFixed(0)}%</em>.<br />Below 70% benchmark.</>,
      conclusion: <>
        Of <strong>{cap?.total_resv ?? 0}</strong> reservations checking in last 30 days, only{' '}
        <strong>{Math.round((cap?.total_resv ?? 0) * fnbCap / 100)}</strong> recorded an F&B
        charge. Closing the gap to 70% — at <strong>${fnbRevPerOccRn.toFixed(0)}/occ-rn</strong> —
        recovers ~<strong>${monthlyUpside.toLocaleString()}/mo</strong> (${(annualUpside/1000).toFixed(0)}k annual).
      </>,
      verdict: [
        { label: `Capture · ${fnbCap.toFixed(0)}%`, tone: 'warn' as const },
        { label: `Gap · ${capGap.toFixed(0)}pp` },
        { label: 'Confidence · 50%' },
      ],
      primaryAction: 'Schedule review',
      secondaryAction: 'See drilldown',
      tertiaryAction: 'Defer',
      impact: monthlyUpside > 0 ? `+$${(monthlyUpside/1000).toFixed(1)}k` : 'Capture lift',
      impactSub: 'est. monthly recovery',
    });
  }

  const seg = dq.find((d: any) => d.category === 'MARKET_SEGMENT_NULL');
  if (seg) {
    cards.push({
      pillar: 'ops' as const,
      pillarLabel: 'Operations · Front Office',
      agentLabel: '· DQ Agent',
      priority: 'med' as const,
      priorityLabel: 'Medium · SOP gap',
      headline: <>82% of reservations <em>have no segment tag</em>.<br />Front desk SOP fix.</>,
      conclusion: <>
        Without market_segment, channel-mix and ADR-by-segment analysis is impossible. Train Lao
        team on the 6 standard tags and enforce via Cloudbeds field.
      </>,
      verdict: [
        { label: '82% missing', tone: 'warn' as const },
        { label: 'Training task' },
        { label: 'Effort · low' },
      ],
      primaryAction: 'Schedule training',
      secondaryAction: 'Send SOP',
      tertiaryAction: 'Defer',
      impact: 'Analytics',
      impactSub: 'segment slicing unblocked',
    });
  }

  return (
    <>
      <PanelHero
        eyebrow={`Operations · Snapshot${period.seg !== 'all' ? ` · ${period.segLabel}` : ''}`}
        title="The property"
        emphasis="right now"
        sub={`Live ops · arrivals · departures · in-house${period.cmp !== 'none' ? ` · ${period.cmpLabel}` : ''}`}
        kpis={
          <>
            <KpiCard label="In-House" value={inHouse} />
            <KpiCard label="Arrivals" value={arr} />
            <KpiCard label="Departures" value={dep} />
            <KpiCard label="Available Tonight" value={avail} hint="Tent 7 retired" />
          </>
        }
      />

      <div className="card-grid-4">
        <KpiCard label="Total Rooms" value={today?.total_rooms ?? 0} hint="Active inventory" />
        <KpiCard label="OTB Next 90d" value={today?.otb_next_90d ?? 0} />
        <KpiCard label="F&B Capture %" value={fnbCap} kind="pct" tone={fnbCap >= 70 ? 'pos' : 'warn'} hint="last 30d" />
        <KpiCard label="DQ Issues" value={dq.length} tone={dq.length > 0 ? 'warn' : 'pos'} />
      </div>

      {cards.length > 0 && (
        <ActionStack
          title={<><em>The decisions</em><br />queued for you.</>}
          count={cards.length}
          meta={`${cards.length} awaiting · operations pillar`}
        >
          {cards.map((c, i) => <ActionCard key={i} num={i + 1} {...c} />)}
        </ActionStack>
      )}
    </>
  );
}
