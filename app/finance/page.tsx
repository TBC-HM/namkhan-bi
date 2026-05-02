// app/finance/page.tsx
// Finance · Snapshot — period-aware (?win=, ?cmp=, ?seg=).

import FilterStrip from '@/components/nav/FilterStrip';
import PanelHero from '@/components/sections/PanelHero';
import KpiCard from '@/components/kpi/KpiCard';
import ActionCard, { ActionStack } from '@/components/sections/ActionCard';
import { getRevenueByUsali, getAgedAr } from '@/lib/data';
import { resolvePeriod } from '@/lib/period';
import { fmtMoney } from '@/lib/format';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function FinanceSnapshotPage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);
  const [usali, aged] = await Promise.all([
    getRevenueByUsali(period.from, period.to).catch(() => []),
    getAgedAr().catch(() => []),
  ]);

  const months = Array.from(new Set(usali.map((row: any) => row.month))).sort().reverse();
  const latestMonth = months[1] || months[0];
  const latestRows = usali.filter((row: any) => row.month === latestMonth);
  const totalRev = latestRows.reduce((s: number, r: any) => s + Number(r.revenue || 0), 0);

  const priorMonth = months[2];
  const priorTotal = usali
    .filter((row: any) => row.month === priorMonth)
    .reduce((s: number, r: any) => s + Number(r.revenue || 0), 0);
  const monthDelta = priorTotal ? ((totalRev - priorTotal) / priorTotal) * 100 : 0;

  const totalAr = aged.reduce((s: number, r: any) => s + Number(r.open_balance || 0), 0);
  const ar90Plus = aged
    .filter((r: any) => r.bucket === '90_plus')
    .reduce((s: number, r: any) => s + Number(r.open_balance || 0), 0);
  const ar6190 = aged
    .filter((r: any) => r.bucket === '61_90')
    .reduce((s: number, r: any) => s + Number(r.open_balance || 0), 0);

  const cards: any[] = [];

  if (ar90Plus > 0) {
    cards.push({
      pillar: 'fin' as const,
      pillarLabel: 'Finance · AR',
      agentLabel: '· Collections Agent',
      priority: 'high' as const,
      priorityLabel: 'High priority · cash',
      headline: <>{fmtMoney(ar90Plus, 'USD')} stuck <em>past 90 days</em>.<br />Likely write-off territory.</>,
      conclusion: <>
        Reservations with open balance over 90 days have <strong>~50% recovery rate</strong>.
        Owner action: review each line, escalate commercial accounts to legal letter, write off
        uncollectibles.
      </>,
      verdict: [
        { label: `90+ · ${fmtMoney(ar90Plus, 'USD')}`, tone: 'bad' as const },
        { label: `Total AR · ${fmtMoney(totalAr, 'USD')}` },
        { label: 'Recovery · ~50%' },
      ],
      primaryAction: 'Review aging',
      secondaryAction: 'Send letters',
      tertiaryAction: 'Defer',
      impact: 'Cash',
      impactSub: 'AR cleanup',
    });
  }

  cards.push({
    pillar: 'fin' as const,
    pillarLabel: 'Finance · Budget',
    agentLabel: '· Variance Agent',
    priority: 'med' as const,
    priorityLabel: 'Medium · setup',
    headline: <>Budget data <em>not yet provided</em>.<br />Variance tracking blocked.</>,
    conclusion: <>
      Without an annual budget by USALI line, GOP / variance / pace-to-target cannot render.
      Owner action: provide CSV with monthly figures by USALI dept.
    </>,
    verdict: [
      { label: 'Effort · 1-2h', tone: 'good' as const },
      { label: 'Unblocks · 4 KPIs' },
      { label: 'One-time' },
    ],
    primaryAction: 'Get template',
    secondaryAction: 'Schedule',
    tertiaryAction: 'Defer',
    impact: '4 KPIs',
    impactSub: 'unlocked',
  });

  if (ar6190 > 1000) {
    cards.push({
      pillar: 'fin' as const,
      pillarLabel: 'Finance · AR',
      agentLabel: '· Collections Agent',
      priority: 'med' as const,
      priorityLabel: 'Medium · escalating',
      headline: <>{fmtMoney(ar6190, 'USD')} in <em>61-90 day bucket</em>.<br />Send second reminder.</>,
      conclusion: <>
        At risk of escalating to 90+. Send second reminder at 60d, third at 75d, escalate to legal at 90d+.
      </>,
      verdict: [
        { label: `61-90 · ${fmtMoney(ar6190, 'USD')}`, tone: 'warn' as const },
        { label: 'Window · 30d to 90+' },
      ],
      primaryAction: 'Send reminders',
      secondaryAction: 'Review',
      tertiaryAction: 'Defer',
      impact: 'Prevention',
      impactSub: 'before 90+',
    });
  }

  return (
    <>
      <FilterStrip showForward={false} showCompare showSegment liveSource="Cloudbeds + ledger · live" />
      <PanelHero
        eyebrow={`Finance · Snapshot · ${latestMonth ? String(latestMonth).slice(0, 7) : '—'}${period.seg !== 'all' ? ` · ${period.segLabel}` : ''}`}
        title="USALI"
        emphasis="ledger"
        sub={`${period.rangeLabel} · revenue side · AR · expense side awaiting cost upload${period.cmp !== 'none' ? ` · ${period.cmpLabel}` : ''}`}
        kpis={
          <>
            <KpiCard
              label="Total Revenue"
              value={totalRev}
              kind="money"
              delta={priorMonth ? `${monthDelta >= 0 ? '+' : ''}${monthDelta.toFixed(1)}% vs prior` : undefined}
              deltaTone={monthDelta >= 0 ? 'pos' : 'neg'}
            />
            <KpiCard label="GOP" value={null} kind="money" greyed hint="Cost data needed" />
            <KpiCard label="Total AR" value={totalAr} kind="money" tone={totalAr > 5000 ? 'warn' : 'neutral'} />
            <KpiCard
              label="AR 90+"
              value={ar90Plus}
              kind="money"
              tone={ar90Plus > 0 ? 'neg' : 'pos'}
              hint={ar90Plus > 0 ? 'Write-off risk' : 'Clean'}
            />
          </>
        }
      />

      {cards.length > 0 && (
        <ActionStack
          title={<><em>The reconciliations</em><br />awaiting attention.</>}
          count={cards.length}
          meta={`${cards.length} awaiting · finance pillar`}
        >
          {cards.map((c, i) => <ActionCard key={i} num={i + 1} {...c} />)}
        </ActionStack>
      )}
    </>
  );
}
