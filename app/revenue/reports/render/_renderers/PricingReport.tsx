// app/revenue/reports/render/_renderers/PricingReport.tsx
// Pricing report — rate-plan health snapshot. Reads cross-property bridge
// views (v_rate_plans_all, v_rate_plan_perf, v_rate_plan_sleeping,
// v_rate_plan_orphans) so the renderer is property-aware out of the gate.
// Task #75 · 2026-05-22.

import { Container, KpiTile, Chart, type ChartSeries } from '@/app/(cockpit)/_design';
import ReportBrief from './_shared/ReportBrief';
import { createClient } from '@/lib/supabase/server';
import type { ResolvedPeriod } from '@/lib/period';
import { fmtTableUsd } from '@/lib/format';

interface Props {
  period: ResolvedPeriod;
  propertyId: number;
}

const NAMKHAN_PROPERTY_ID = 260955;

export default async function PricingReport({ period, propertyId }: Props) {
  const supabase = createClient();
  const sym = propertyId === 1000001 ? '€' : '$';
  const moneyCurrency: 'USD' | 'EUR' = propertyId === 1000001 ? 'EUR' : 'USD';

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  const [plansRes, perfRes, sleepRes, orphanRes] = await Promise.all([
    supabase.from('v_rate_plans_all').select('rate_id, rate_name, rate_type, is_active')
      .eq('property_id', propertyId),
    supabase.from('v_rate_plan_perf')
      .select('rate_plan, total_amount, nights, booking_date, status, plan_type, is_configured')
      .eq('property_id', propertyId)
      .gte('booking_date', since),
    supabase.from('v_rate_plan_sleeping')
      .select('rate_name, rate_type, last_booked, days_since')
      .eq('property_id', propertyId)
      .order('days_since', { ascending: false }).limit(10),
    supabase.from('v_rate_plan_orphans')
      .select('rate_plan, bookings_lifetime, revenue_lifetime, last_booked')
      .eq('property_id', propertyId)
      .order('bookings_lifetime', { ascending: false }).limit(10),
  ]);

  const plans   = (plansRes.data   ?? []) as Array<Record<string, unknown>>;
  const perf    = (perfRes.data    ?? []) as Array<Record<string, unknown>>;
  const sleep   = (sleepRes.data   ?? []) as Array<Record<string, unknown>>;
  const orphans = (orphanRes.data  ?? []) as Array<Record<string, unknown>>;

  const activePlans = plans.filter((p) => p.is_active).length;

  // Aggregate perf to per-rate_plan rollup (live, since v_rate_plan_perf is row-level)
  const liveStatuses = new Set(['confirmed', 'checked_in', 'checked_out']);
  const byPlan = new Map<string, { bookings: number; revenue: number; nights: number; configured: boolean }>();
  for (const r of perf) {
    if (!liveStatuses.has(String(r.status))) continue;
    const key = String(r.rate_plan ?? '—');
    const slot = byPlan.get(key) ?? { bookings: 0, revenue: 0, nights: 0, configured: Boolean(r.is_configured) };
    slot.bookings += 1;
    slot.revenue  += Number(r.total_amount ?? 0);
    slot.nights   += Number(r.nights ?? 0);
    byPlan.set(key, slot);
  }
  const planRows = Array.from(byPlan.entries())
    .map(([rate_plan, v]) => ({
      rate_plan,
      bookings: v.bookings,
      revenue: v.revenue,
      adr: v.nights > 0 ? v.revenue / v.nights : 0,
      configured: v.configured,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const totalBookings = planRows.reduce((s, r) => s + r.bookings, 0);
  const totalRevenue  = planRows.reduce((s, r) => s + r.revenue, 0);
  const totalNights   = Array.from(byPlan.values()).reduce((s, v) => s + v.nights, 0);
  const avgAdr = totalNights > 0 ? totalRevenue / totalNights : 0;
  const topPlan = planRows[0];

  // No data state
  if (plans.length === 0 && perf.length === 0) {
    return (
      <Container title="No rate-plan data" subtitle={`v_rate_plans_all returned 0 rows for property ${propertyId}`} density="compact">
        <div style={{ padding: 20, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
          Check that the property is configured in v_rate_plans_all.
        </div>
      </Container>
    );
  }

  const briefSignal = `${period.label} · ${activePlans} active rate plans · ${totalBookings} bookings · ${sym}${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} revenue`;
  const briefBody = `${sleep.length} sleeping (≥30d no booking) · ${orphans.length} orphan (no PMS mapping) · avg ADR ${sym}${avgAdr.toFixed(0)}.`;
  const good: string[] = [];
  const bad: string[] = [];
  if (topPlan && topPlan.bookings >= 5) good.push(`Top performer "${topPlan.rate_plan}" — ${topPlan.bookings} bookings, ${sym}${Math.round(topPlan.revenue).toLocaleString()}`);
  if (sleep.length === 0) good.push('No sleeping rate plans — every plan booked in the last 30d.');
  if (orphans.length === 0) good.push('No orphan rate plans — every plan has a PMS mapping.');
  if (sleep.length > 5)   bad.push(`${sleep.length} sleeping rate plans — clean up or retire.`);
  if (orphans.length > 0) bad.push(`${orphans.length} orphan rate plans — bookings landed without a configured plan.`);
  if (good.length === 0) good.push('Mixed health signals.');
  if (bad.length === 0)  bad.push('No structural rate-plan risks flagged.');

  const topPlanRows = planRows.slice(0, 10).map((r) => ({
    rate_plan: r.rate_plan,
    bookings: r.bookings.toLocaleString(),
    revenue: moneyCurrency === 'EUR' ? `€${Math.round(r.revenue).toLocaleString()}` : fmtTableUsd(r.revenue),
    adr: r.adr > 0 ? (moneyCurrency === 'EUR' ? `€${Math.round(r.adr).toLocaleString()}` : fmtTableUsd(r.adr)) : '—',
    configured: r.configured ? 'yes' : '—',
  }));
  const topPlanCols: ChartSeries[] = [
    { key: 'bookings',  label: 'Bookings 30d' },
    { key: 'revenue',   label: 'Revenue 30d' },
    { key: 'adr',       label: 'ADR' },
    { key: 'configured', label: 'Configured' },
  ];

  const sleepRows = sleep.map((s) => ({
    rate_name: String(s.rate_name ?? '—'),
    rate_type: String(s.rate_type ?? '—'),
    last_booked: String(s.last_booked ?? '—'),
    days_since: `${Number(s.days_since ?? 0)} d`,
  }));
  const sleepCols: ChartSeries[] = [
    { key: 'rate_type',  label: 'Type' },
    { key: 'last_booked', label: 'Last booking' },
    { key: 'days_since', label: 'Days idle' },
  ];

  return (
    <>
      <ReportBrief signal={briefSignal} body={briefBody} good={good} bad={bad} />

      <Container title="Rate-plan health" subtitle="last 30 days" density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <KpiTile label="Active plans" value={activePlans} size="sm" />
          <KpiTile label="Bookings 30d" value={totalBookings} size="sm" />
          <KpiTile label="Revenue 30d" value={Math.round(totalRevenue)} currency={moneyCurrency} size="sm" />
          <KpiTile label="Avg ADR" value={Math.round(avgAdr)} currency={moneyCurrency} size="sm" />
          <KpiTile label="Sleeping plans" value={sleep.length} size="sm"
            status={sleep.length > 5 ? 'amber' : sleep.length === 0 ? 'green' : 'grey'} />
          <KpiTile label="Orphan plans" value={orphans.length} size="sm"
            status={orphans.length > 0 ? 'amber' : 'green'} />
        </div>
      </Container>

      <Container title="Top rate plans · last 30d" subtitle={`${Math.min(planRows.length, 10)} of ${planRows.length}`}>
        <Chart variant="table" data={topPlanRows} xKey="rate_plan" series={topPlanCols}
          empty={{ title: 'No rate-plan bookings in the last 30d' }} />
      </Container>

      {sleep.length > 0 && (
        <Container title="Sleeping rate plans" subtitle="≥30d since last booking">
          <Chart variant="table" data={sleepRows} xKey="rate_name" series={sleepCols}
            empty={{ title: 'No sleeping rate plans' }} />
        </Container>
      )}
    </>
  );
}
