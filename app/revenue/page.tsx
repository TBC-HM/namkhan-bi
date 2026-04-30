// app/revenue/page.tsx
// Revenue · Snapshot — performance summary + inline ActionCards.

import PanelHero from '@/components/sections/PanelHero';
import KpiCard from '@/components/kpi/KpiCard';
import ActionCard, { ActionStack } from '@/components/sections/ActionCard';
import {
  getKpiDaily, defaultDailyRange, aggregateDaily,
  getChannelPerf, getPaceOtb,
} from '@/lib/data';
import { fmtMoney } from '@/lib/format';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function RevenueSnapshotPage() {
  const r30 = defaultDailyRange(30);
  const [daily, channels, pace] = await Promise.all([
    getKpiDaily(r30.from, r30.to).catch(() => []),
    getChannelPerf().catch(() => []),
    getPaceOtb().catch(() => []),
  ]);

  const agg = aggregateDaily(daily);
  const validChannels = channels.filter((c: any) => Number(c.bookings_90d) > 0 || Number(c.revenue_90d) > 0);

  // Channel mix
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

  // Pace summary
  const totalOtb = pace.reduce((s: number, r: any) => s + Number(r.otb_roomnights || 0), 0);
  const totalStly = pace.reduce((s: number, r: any) => s + Number(r.stly_roomnights || 0), 0);
  const paceΔ = totalOtb - totalStly;

  // Action cards
  const cards: any[] = [];

  // ADR for sizing pace impact (USD)
  const adr30d = Number(agg?.adr ?? 0);

  // Card 1: OTA mix too high?
  if (otaMix > 70) {
    // Real impact math: shifting 10pp from OTA→Direct saves OTA commission delta
    // OTA commission ~15%, direct cost ~3% (payment processing + email tools)
    // Net save = 10% of total revenue × 12% commission delta
    // 90d revenue → annualize × 4
    const annualRev = totalRev90 * 4;
    const shiftPct = 10; // conservative 10pp shift
    const commissionDelta = 0.12; // 15% OTA - 3% direct
    const annualSavings = Math.round(annualRev * (shiftPct / 100) * commissionDelta);
    const monthlySavings = Math.round(annualSavings / 12);

    cards.push({
      pillar: 'rev' as const,
      pillarLabel: 'Revenue · Channels',
      agentLabel: '· Channel Agent',
      priority: 'med' as const,
      priorityLabel: 'Medium · margin risk',
      headline: <>OTA share at <em>{otaMix.toFixed(0)}%</em>.<br />Direct share at {directMix.toFixed(0)}%.</>,
      conclusion: <>
        Heavy OTA dependence drags <strong>~12% commission delta</strong> on rooms revenue
        (~15% OTA vs ~3% direct cost). Shifting 10pp from OTA to direct on{' '}
        <strong>${(annualRev/1000).toFixed(0)}k annualized revenue</strong> saves an estimated{' '}
        <strong>${monthlySavings.toLocaleString()}/mo</strong> (~${(annualSavings/1000).toFixed(0)}k annual).
        Action: rate parity audit, BAR + perk on website, email loyalty list activation.
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

  // Card 2: Pace ahead/behind STLY
  if (Math.abs(paceΔ) >= 30) {
    const ahead = paceΔ > 0;
    // Real $: paceΔ in roomnights × ADR
    const paceImpact = Math.round(paceΔ * adr30d);
    const monthlyImpact = Math.round(paceImpact / 12); // pace is forward 12mo

    cards.push({
      pillar: 'rev' as const,
      pillarLabel: 'Revenue · Pace',
      agentLabel: '· Pickup Agent',
      priority: ahead ? 'med' as const : 'high' as const,
      priorityLabel: ahead ? 'Medium · upside' : 'High · pace gap',
      headline: ahead
        ? <>Forward pace <em>{paceΔ} roomnights ahead</em><br />of STLY. Yield window open.</>
        : <>Forward pace <em>{Math.abs(paceΔ)} roomnights behind</em><br />STLY. Investigate causes.</>,
      conclusion: ahead ? <>
        On-the-books exceeds same-time-last-year by <strong>{paceΔ} roomnights</strong>{' '}
        × ${adr30d.toFixed(0)} ADR = <strong>${(paceImpact/1000).toFixed(1)}k</strong> incremental
        rooms revenue across forward 12 months. Tighten rates on peak demand dates and consider
        min-stay restrictions. Check Demand tab for biggest single-month gap.
      </> : <>
        On-the-books trails STLY by <strong>{Math.abs(paceΔ)} roomnights</strong> at{' '}
        ${adr30d.toFixed(0)} ADR = <strong>−${Math.abs(paceImpact/1000).toFixed(1)}k</strong> rooms revenue
        risk forward 12 months. Investigate channel mix, rate competitiveness, and event calendar.
        Consider promo loosening for the weakest month.
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
        eyebrow="Revenue · Snapshot · 30d"
        title="Revenue"
        emphasis="performance"
        sub={`${r30.from} → ${r30.to} · live from Cloudbeds`}
        kpis={
          <>
            <KpiCard label="Occupancy 30d" value={agg?.occupancy_pct ?? 0} kind="pct" />
            <KpiCard label="ADR 30d" value={agg?.adr ?? 0} kind="money" />
            <KpiCard label="RevPAR 30d" value={agg?.revpar ?? 0} kind="money" />
            <KpiCard label="TRevPAR 30d" value={agg?.trevpar ?? 0} kind="money" />
          </>
        }
      />

      <div className="card-grid-4">
        <KpiCard
          label="Rooms Rev 30d"
          value={agg?.rooms_revenue ?? 0}
          kind="money"
        />
        <KpiCard
          label="Ancillary Rev 30d"
          value={agg?.total_ancillary_revenue ?? 0}
          kind="money"
        />
        <KpiCard
          label="OTA Mix"
          value={otaMix}
          kind="pct"
          tone={otaMix > 70 ? 'warn' : 'neutral'}
        />
        <KpiCard
          label="Direct Mix"
          value={directMix}
          kind="pct"
          tone={directMix < 15 ? 'warn' : 'pos'}
        />
      </div>

      {cards.length > 0 && (
        <ActionStack
          title={<><em>The decisions</em><br />queued for you.</>}
          count={cards.length}
          meta={`${cards.length} awaiting · revenue pillar`}
        >
          {cards.map((c, i) => (
            <ActionCard key={i} num={i + 1} {...c} />
          ))}
        </ActionStack>
      )}
    </>
  );
}
