// app/revenue/rateplans/page.tsx — REDESIGN 2026-05-05 (recovery rewrite)
// compset-style: PageHeader + status header + 3 graphs + KpiBox + DataTable.

import Page from '@/components/page/Page';
import { REVENUE_SUBPAGES } from '../_subpages';
import KpiBox from '@/components/kpi/KpiBox';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { resolvePeriod } from '@/lib/period';

import RatePlansStatusHeader from './_components/RatePlansStatusHeader';
import RatePlansGraphs, {
  type DailyTrendRow,
  type TypeMixRow,
  type CancelRow,
} from './_components/RatePlansGraphs';
import {
  PlansTable,
  SleepingTable,
  OrphansTable,
  type PlanRow,
  type SleepingRow,
  type OrphanRow,
} from './_components/PlansTablesClient';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props { searchParams: Record<string, string | string[] | undefined>; }

export default async function RatePlansPage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);

  const { data: configuredPlans } = await supabase
    .from('rate_plans')
    .select('rate_id, rate_name, rate_type, is_active')
    .eq('property_id', PROPERTY_ID)
    .eq('is_active', true);
  const masterNames = new Set((configuredPlans ?? []).map((p: any) => p.rate_name));

  const { data: recent90 } = await supabase
    .from('reservations')
    .select('rate_plan, status, booking_date')
    .eq('property_id', PROPERTY_ID)
    .gte('booking_date', new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10))
    .neq('status', 'canceled');
  const activeMasterNames = new Set(
    (recent90 ?? [])
      .map((r: any) => r.rate_plan)
      .filter((n: string) => n && masterNames.has(n)),
  );
  const activeMasterCount = activeMasterNames.size;
  const lastBookingDate = (recent90 ?? [])
    .map((r: any) => (r.booking_date as string)?.slice(0, 10))
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

  const { data: windowRows } = await supabase
    .from('v_rate_plan_perf')
    .select('rate_plan, status, total_amount, nights, lead_days, plan_type, is_configured, booking_date, check_in_date')
    .gte('check_in_date', period.from)
    .lte('check_in_date', period.to);

  type PlanAgg = {
    name: string; type: string; isConfigured: boolean;
    bookings: number; cancellations: number; nights: number; revenue: number;
    leadDaysSum: number; leadDaysN: number; lastBooked: string | null;
  };
  const planMap: Record<string, PlanAgg> = {};
  (windowRows ?? []).forEach((r: any) => {
    const key = r.rate_plan;
    if (!planMap[key]) {
      planMap[key] = { name: key, type: r.plan_type, isConfigured: r.is_configured, bookings: 0, cancellations: 0, nights: 0, revenue: 0, leadDaysSum: 0, leadDaysN: 0, lastBooked: null };
    }
    const p = planMap[key];
    if (r.status === 'canceled') p.cancellations += 1;
    else {
      p.bookings += 1;
      p.nights += Number(r.nights || 0);
      p.revenue += Number(r.total_amount || 0);
      if (r.lead_days != null) { p.leadDaysSum += Number(r.lead_days); p.leadDaysN += 1; }
    }
    const bookDate = (r.booking_date as string)?.slice(0, 10);
    if (bookDate && (!p.lastBooked || bookDate > p.lastBooked)) p.lastBooked = bookDate;
  });

  const rankedAll = Object.values(planMap)
    .filter((p) => p.bookings > 0 || p.cancellations > 0)
    .sort((a, b) => b.revenue - a.revenue);
  const ranked = rankedAll.filter((p) => activeMasterNames.has(p.name));
  const totalRev = ranked.reduce((s, r) => s + r.revenue, 0);
  const plansBookingInWindow = ranked.filter((r) => r.bookings > 0).length;
  const top3Pct = totalRev > 0 ? (100 * ranked.slice(0, 3).reduce((s, r) => s + r.revenue, 0)) / totalRev : 0;
  const hiddenOrphanInWindow = rankedAll.length - ranked.length;

  const planRows: PlanRow[] = ranked.map((p) => ({
    name: p.name, type: p.type, isConfigured: p.isConfigured,
    bookings: p.bookings, cancellations: p.cancellations, nights: p.nights, revenue: p.revenue,
    adr: p.nights ? p.revenue / p.nights : 0,
    cancelPct: (p.bookings + p.cancellations) > 0 ? (100 * p.cancellations) / (p.bookings + p.cancellations) : 0,
    avgLead: p.leadDaysN ? p.leadDaysSum / p.leadDaysN : 0,
    lastBooked: p.lastBooked,
    mixPct: totalRev ? (100 * p.revenue) / totalRev : 0,
  }));

  const typeMap: Record<string, { bookings: number; revenue: number; nights: number }> = {};
  ranked.forEach((p) => {
    if (!typeMap[p.type]) typeMap[p.type] = { bookings: 0, revenue: 0, nights: 0 };
    typeMap[p.type].bookings += p.bookings;
    typeMap[p.type].revenue += p.revenue;
    typeMap[p.type].nights += p.nights;
  });
  const typeRollup: TypeMixRow[] = Object.entries(typeMap).map(([type, v]) => ({
    type, ...v,
    adr: v.nights ? v.revenue / v.nights : 0,
    mix: totalRev ? (100 * v.revenue) / totalRev : 0,
  })).sort((a, b) => b.revenue - a.revenue);

  const trendMap: Record<string, { bookings: number; revenue: number; nights: number }> = {};
  (windowRows ?? []).forEach((r: any) => {
    if (r.status === 'canceled') return;
    const day = (r.booking_date as string)?.slice(0, 10);
    if (!day) return;
    if (!trendMap[day]) trendMap[day] = { bookings: 0, revenue: 0, nights: 0 };
    trendMap[day].bookings += 1;
    trendMap[day].revenue += Number(r.total_amount || 0);
    trendMap[day].nights += Number(r.nights || 0);
  });
  const trend: DailyTrendRow[] = Object.entries(trendMap).map(([day, v]) => ({
    day, bookings: v.bookings, revenue: v.revenue,
    adr: v.nights ? v.revenue / v.nights : 0,
  })).sort((a, b) => a.day.localeCompare(b.day));

  const cancelData: CancelRow[] = ranked.map((p) => ({
    name: p.name,
    cancelPct: (p.bookings + p.cancellations) > 0 ? (100 * p.cancellations) / (p.bookings + p.cancellations) : 0,
    bookings: p.bookings, cancellations: p.cancellations,
  }));

  const { data: sleepingPlans } = await supabase
    .from('v_rate_plan_sleeping')
    .select('rate_name, rate_type, last_booked, days_since')
    .order('days_since', { ascending: false })
    .limit(30);
  const sleepingRows: SleepingRow[] = (sleepingPlans ?? []) as SleepingRow[];

  const { data: orphans } = await supabase
    .from('v_rate_plan_orphans')
    .select('rate_plan, bookings_lifetime, revenue_lifetime, last_booked')
    .order('revenue_lifetime', { ascending: false })
    .limit(20);
  const orphanRows: OrphanRow[] = (orphans ?? []) as OrphanRow[];

  return (
    <Page
      eyebrow="Revenue · Rate plans"
      title={<>Sell the right <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>plan</em>, retire the dead ones.</>}
      subPages={REVENUE_SUBPAGES}
      topRight={
        <a href="/revenue/rateplans/dead" style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 700,
          color: '#0a0a0a', background: '#a8854a',
          border: '1px solid #2a2520', padding: '6px 12px',
          borderRadius: 4, textDecoration: 'none',
        }}>↗ Dead plans (90d)</a>
      }
    >
      <RatePlansStatusHeader
        lastBookingDate={lastBookingDate}
        activeMasterCount={activeMasterCount}
        bookingInWindow={plansBookingInWindow}
        sleepingCount={sleepingRows.length}
        orphanCount={orphanRows.length}
        topTypes={typeRollup.slice(0, 5).map((t) => ({ type: t.type, mix: t.mix }))}
        top3Pct={top3Pct}
        periodLabel={period.label}
        rangeLabel={period.rangeLabel}
      />
      <RatePlansGraphs trend={trend} typeMix={typeRollup} cancel={cancelData} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 14 }}>
        <KpiBox value={null} unit="text" valueText={`${plansBookingInWindow}/${activeMasterCount}`} label={`Plans booking ${period.label}`} tooltip={`Plans with at least one reservation in ${period.label} ÷ active master plans.`} />
        <KpiBox value={sleepingRows.length} unit="count" label="Sleeping plans 90d" tooltip="Active plans with 0 bookings in the last 90 days. Click 'Dead plans' top-right for the cleanup list." />
        <KpiBox value={top3Pct} unit="pct" label="Top 3 concentration" tooltip="Share of revenue captured by the top 3 plans. > 60% = healthy clarity, < 40% = scattered." />
        <KpiBox value={totalRev} unit="usd" label={`Revenue ${period.label}`} tooltip="Sum of reservation total_amount attributed to a rate plan in this window." />
      </div>
      <div style={{ marginTop: 18 }}>
        <SectionHead title="Plans" emphasis="ranked by revenue" sub={`${period.label} · active master plans only${hiddenOrphanInWindow > 0 ? ` · ${hiddenOrphanInWindow} orphan/retired hidden — see below` : ''}`} source="v_rate_plan_perf" />
        <PlansTable rows={planRows} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12, marginTop: 18 }}>
        <div>
          <SectionHead title="Sleeping plans" emphasis="≥90d idle" sub={`${sleepingRows.length} configured · candidates to retire`} source="v_rate_plan_sleeping" />
          <SleepingTable rows={sleepingRows} />
        </div>
        <div>
          <SectionHead title="Orphan plans" emphasis="not in master" sub="Booked but not configured · GDS-injected" source="v_rate_plan_orphans" />
          <OrphansTable rows={orphanRows} />
        </div>
      </div>
    </Page>
  );
}

function SectionHead({ title, emphasis, sub, source }: { title: string; emphasis?: string; sub?: string; source?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-xl)', fontWeight: 500, color: 'var(--ink)', lineHeight: 1.1 }}>
          {title}
          {emphasis && <span style={{ marginLeft: 8, fontFamily: 'var(--mono)', fontStyle: 'normal', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)' }}>{emphasis}</span>}
        </div>
        {sub && <div style={{ marginTop: 2, fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>{sub}</div>}
      </div>
      {source && <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-loose)', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>{source}</span>}
    </div>
  );
}
