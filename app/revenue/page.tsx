// app/revenue/page.tsx
// Revenue · Snapshot — period-aware (?win=, ?cmp=, ?seg=).

import PanelHero from '@/components/sections/PanelHero';
import KpiCard from '@/components/kpi/KpiCard';
import ActionCard, { ActionStack } from '@/components/sections/ActionCard';
import {
  getKpiDaily, aggregateDaily,
  getChannelPerf, getPaceOtb,
} from '@/lib/data';
import { resolvePeriod } from '@/lib/period';
import { fmtMoney } from '@/lib/format';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function RevenueSnapshotPage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);

  // Primary period
  const [daily, channels, pace] = await Promise.all([
    getKpiDaily(period.from, period.to).catch(() => []),
    getChannelPerf().catch(() => []),
    getPaceOtb().catch(() => []),
  ]);
  const agg = aggregateDaily(daily);

  // Compare period (if requested)
  const dailyCmp = period.compareFrom && period.compareTo
    ? await getKpiDaily(period.compareFrom, period.compareTo).catch(() => [])
    : [];
  const aggCmp = dailyCmp.length ? aggregateDaily(dailyCmp) : null;

  const validChannels = channels.filter((c: any) => Number(c.bookings_90d) > 0 || Number(c.revenue_90d) > 0);
  const totalRev90 = validChannels.reduce((s: number, c: any) => s + Number(c.revenue_90d || 0), 0);
  const ota = validChannels.filter((c: any) =>
    /booking\.com|expedia|agoda|airbnb|ctrip|trip\.com|hotels\.com/i.test(String(c.source_name || ''))
  );
  const otaRev = ota.reduce((s: number, c: any) => s + Number(c.revenue_90d || 0), 0);
  const otaMix = totalRev90 ? (otaRev / totalRev90) * 100 : 0;
  const direct = validChannels.find((c: any) =>
    /direct|website|booking engine|email|walk[\- ]?in/i.test(String(c.source_name || ''))
  );
  const directMix = totalRev90 && direct ? (Number(direct.revenue_90d) / totalRev90) * 100 : 0;

  const totalOtb = pace.reduce((s: number, r: any) => s + Number(r.otb_roomnights || 0), 0);
  const totalStly = pace.reduce((s: number, r: any) => s + Number(r.stly_roomnights || 0), 0);
  const paceΔ = totalOtb - totalStly;

  // Delta builder for cmp display
  const delta = (cur: number, prev: number | undefined | null) => {
    if (prev == null || prev === 0) return {};
    const d = ((cur - prev) / prev) * 100;
    const sign = d >= 0 ? '+' : '';
    return {
      text: `${sign}${d.toFixed(1)}% ${period.cmp === 'stly' ? 'STLY' : 'PP'}`,
      tone: (d >= 0 ? 'pos' : 'neg') as 'pos' | 'neg',
    };
  };
  const occD = delta(agg?.occupancy_pct ?? 0, aggCmp?.occupancy_pct);
  const adrD = delta(agg?.adr ?? 0, aggCmp?.adr);
  const rpD  = delta(agg?.revpar ?? 0, aggCmp?.revpar);
  const trpD = delta(agg?.trevpar ?? 0, aggCmp?.trevpar);

  // Action cards (data-driven)
  const cards: any[] = [];
  const adr = Number(agg?.adr ?? 0);

  if (otaMix > 70) {
    const annualRev = totalRev90 * 4;
    const monthlySavings = Math.round(annualRev * 0.10 * 0.12 / 12);
    cards.push({
      pillar: 'rev' as const,
      pillarLabel: 'Revenue · Channels',
      agentLabel: '· Channel Agent',
      priority: 'med' as const,
      priorityLabel: 'Medium · margin risk',
      headline: <>OTA share at <em>{otaMix.toFixed(0)}%</em>.<br />Direct share at {directMix.toFixed(0)}%.</>,
      conclusion: <>
        Heavy OTA dependence drags ~12% commission delta. Shifting 10pp to direct on{' '}
        <strong>${(annualRev/1000).toFixed(0)}k annualized</strong> saves{' '}
        <strong>${monthlySavings.toLocaleString()}/mo</strong>. Action: rate parity audit + direct push.
      </>,
      verdict: [
        { label: `OTA · ${otaMix.toFixed(0)}%`, tone: 'warn' as const },
        { label: `Direct · ${directMix.toFixed(0)}%`, tone: directMix < 20 ? 'bad' as const : 'warn' as const },
        { label: 'Margin · 12pp' },
      ],
      primaryAction: 'See channel detail',
      secondaryAction: 'Plan campaign',
      tertiaryAction: 'Defer',
      impact: `+$${(monthlySavings/1000).toFixed(1)}k`,
      impactSub: 'est. monthly net save',
    });
  }

  if (Math.abs(paceΔ) >= 30) {
    const ahead = paceΔ > 0;
    const monthlyImpact = Math.round((paceΔ * adr) / 12);
    cards.push({
      pillar: 'rev' as const,
      pillarLabel: 'Revenue · Pace',
      agentLabel: '· Pickup Agent',
      priority: ahead ? 'med' as const : 'high' as const,
      priorityLabel: ahead ? 'Medium · upside' : 'High · pace gap',
      headline: ahead
        ? <>Forward pace <em>{paceΔ} roomnights ahead</em><br />of STLY. Yield window open.</>
        : <>Forward pace <em>{Math.abs(paceΔ)} roomnights behind</em><br />STLY. Investigate.</>,
      conclusion: ahead ? <>
        OTB exceeds STLY by <strong>{paceΔ} rn</strong> × ${adr.toFixed(0)} ADR ={' '}
        <strong>${((paceΔ * adr)/1000).toFixed(1)}k</strong> incremental over forward 12mo.
      </> : <>
        OTB trails STLY by <strong>{Math.abs(paceΔ)} rn</strong> at ${adr.toFixed(0)} ADR ={' '}
        <strong>−${Math.abs(paceΔ * adr / 1000).toFixed(1)}k</strong> rooms revenue risk.
      </>,
      verdict: [
        { label: `Δ · ${ahead ? '+' : ''}${paceΔ}rn`, tone: ahead ? 'good' as const : 'bad' as const },
        { label: `OTB · ${totalOtb}` },
        { label: `STLY · ${totalStly}` },
      ],
      primaryAction: ahead ? 'Tighten rates' : 'Open Demand',
      secondaryAction: 'See pickup',
      tertiaryAction: 'Defer',
      impact: `${ahead ? '+' : '−'}$${Math.abs(monthlyImpact/1000).toFixed(1)}k`,
      impactSub: 'avg monthly · 12mo forward',
    });
  }

  return (
    <>
      <PanelHero
        eyebrow={`Revenue · Snapshot · ${period.label}${period.seg !== 'all' ? ` · ${period.segLabel}` : ''}`}
        title="Revenue"
        emphasis="performance"
        sub={`${period.rangeLabel}${period.cmp !== 'none' ? ` · ${period.cmpLabel}` : ''} · live from Cloudbeds`}
        kpis={
          <>
            <KpiCard
              label={`Occupancy ${period.label}`}
              value={agg?.occupancy_pct ?? 0}
              kind="pct"
              delta={occD.text}
              deltaTone={occD.tone}
            />
            <KpiCard
              label={`ADR ${period.label}`}
              value={agg?.adr ?? 0}
              kind="money"
              delta={adrD.text}
              deltaTone={adrD.tone}
            />
            <KpiCard
              label={`RevPAR ${period.label}`}
              value={agg?.revpar ?? 0}
              kind="money"
              delta={rpD.text}
              deltaTone={rpD.tone}
            />
            <KpiCard
              label={`TRevPAR ${period.label}`}
              value={agg?.trevpar ?? 0}
              kind="money"
              delta={trpD.text}
              deltaTone={trpD.tone}
            />
          </>
        }
      />

      <div className="card-grid-4">
        <KpiCard label="Rooms Rev" value={agg?.rooms_revenue ?? 0} kind="money" />
        <KpiCard label="Ancillary Rev" value={agg?.total_ancillary_revenue ?? 0} kind="money" />
        <KpiCard
          label="OTA Mix"
          value={otaMix}
          kind="pct"
          tone={otaMix > 70 ? 'warn' : 'neutral'}
          hint="last 90d"
        />
        <KpiCard
          label="Direct Mix"
          value={directMix}
          kind="pct"
          tone={directMix < 15 ? 'warn' : 'pos'}
          hint="last 90d"
        />
      </div>

      {cards.length > 0 && (
        <ActionStack
          title={<><em>The decisions</em><br />queued for you.</>}
          count={cards.length}
          meta={`${cards.length} awaiting · revenue pillar`}
        >
          {cards.map((c, i) => <ActionCard key={i} num={i + 1} {...c} />)}
        </ActionStack>
      )}
    </>
  );
}
