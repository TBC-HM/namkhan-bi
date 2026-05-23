// app/revenue/rateplans/page.tsx
// 2026-05-19 refactor onto @/app/(cockpit)/_design primitives.
// Single tree, both properties. Donna shows 0s for views that filter
// property_id; the Namkhan-only views fall back to empty arrays on non-pid.

import {
  DashboardPage, Container, KpiTile, Chart,
  type ChartSeries, type DashboardTab, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { REVENUE_SUBPAGES } from '../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { resolvePeriod, type WindowKey } from '@/lib/period';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props { searchParams: Record<string, string | string[] | undefined>; propertyId?: number }

interface PlanAgg {
  name: string; type: string; isConfigured: boolean;
  bookings: number; cancellations: number; nights: number; revenue: number;
  leadDaysSum: number; leadDaysN: number; lastBooked: string | null;
}

function fmtMoney(n: number | null | undefined, sym: string = '$'): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return sym + Math.round(Number(n)).toLocaleString('en-US');
}
function fmtInt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Math.round(Number(n)).toLocaleString('en-US');
}
// note#22: clarify "Restricted" — these are non-refundable / advance-purchase plans (stay/cancel restrictions)
const PLAN_TYPE_LABEL: Record<string, string> = {
  Restricted: 'Restricted · non-refundable / advance purchase',
};
function formatPlanType(t: string): string {
  return PLAN_TYPE_LABEL[t] ?? t;
}
// note#21: flag UWC Thailand as one-time group booking
const ONE_TIME_GROUPS = new Set(['UWC Thailand']);
function formatPlanName(n: string): string {
  return ONE_TIME_GROUPS.has(n) ? `${n} · one-time group` : n;
}

function fmtPct(n: number | null | undefined, decimals = 1): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return `${Number(n).toFixed(decimals)}%`;
}

export default async function RatePlansPage({ searchParams, propertyId }: Props) {
  const pid = propertyId ?? PROPERTY_ID;
  const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };
  const moneyCurrency: 'USD' | 'EUR' = pid === 1000001 ? 'EUR' : 'USD';
  const sym: string = pid === 1000001 ? '€' : '$';
  const period = resolvePeriod(searchParams);
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  const basePath = pid !== PROPERTY_ID ? `/h/${pid}/revenue/rateplans` : '/revenue/rateplans';

  const { data: configuredPlans } = await supabase
    .from('v_rate_plans_all')
    .select('rate_id, rate_name, rate_type, is_active')
    .eq('property_id', pid)
    .eq('is_active', true);
  const masterNames = new Set((configuredPlans ?? []).map((p: { rate_name: string }) => p.rate_name));

  const { data: recent90 } = await supabase
    .from('v_reservations_unified')
    .select('rate_plan, status, booking_date')
    .eq('property_id', pid)
    .gte('booking_date', new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10))
    .neq('status', 'canceled');
  const activeMasterNames = new Set(
    (recent90 ?? [])
      .map((r: { rate_plan: string | null }) => r.rate_plan)
      .filter((n): n is string => !!n && masterNames.has(n)),
  );
  const activeMasterCount = activeMasterNames.size;
  const isNamkhan = true; // cross-property since views now expose property_id and we filter explicitly

  const { data: windowRows } = isNamkhan
    ? await supabase
        .from('v_rate_plan_perf')
        .select('rate_plan, status, total_amount, nights, lead_days, plan_type, is_configured, booking_date, check_in_date')
        .eq('property_id', pid)
        .gte('check_in_date', period.from)
        .lte('check_in_date', period.to)
    : { data: [] as Array<Record<string, unknown>> };

  const planMap: Record<string, PlanAgg> = {};
  (windowRows ?? []).forEach((r: Record<string, unknown>) => {
    const key = String(r.rate_plan ?? '');
    if (!planMap[key]) {
      planMap[key] = { name: key, type: String(r.plan_type ?? ''), isConfigured: Boolean(r.is_configured), bookings: 0, cancellations: 0, nights: 0, revenue: 0, leadDaysSum: 0, leadDaysN: 0, lastBooked: null };
    }
    const p = planMap[key];
    if (r.status === 'canceled') p.cancellations += 1;
    else {
      p.bookings += 1;
      p.nights += Number(r.nights ?? 0);
      p.revenue += Number(r.total_amount ?? 0);
      if (r.lead_days != null) { p.leadDaysSum += Number(r.lead_days); p.leadDaysN += 1; }
    }
    const bookDate = String(r.booking_date ?? '').slice(0, 10);
    if (bookDate && (!p.lastBooked || bookDate > p.lastBooked)) p.lastBooked = bookDate;
  });

  const rankedAll = Object.values(planMap).filter((p) => p.bookings > 0 || p.cancellations > 0).sort((a, b) => b.revenue - a.revenue);
  const ranked = rankedAll.filter((p) => activeMasterNames.has(p.name));
  const totalRev = ranked.reduce((s, r) => s + r.revenue, 0);
  const plansBookingInWindow = ranked.filter((r) => r.bookings > 0).length;
  const top3Pct = totalRev > 0 ? (100 * ranked.slice(0, 3).reduce((s, r) => s + r.revenue, 0)) / totalRev : 0;
  const hiddenOrphanInWindow = rankedAll.length - ranked.length;

  // Plans table rows (pre-formatted strings — no functions cross primitives)
  const planRows = ranked.map((p) => ({
    name:        formatPlanName(p.name),
    type:        formatPlanType(p.type),
    bookings:    fmtInt(p.bookings),
    cancellations: fmtInt(p.cancellations),
    cancel_pct:  fmtPct((p.bookings + p.cancellations) > 0 ? (100 * p.cancellations) / (p.bookings + p.cancellations) : 0),
    revenue:     fmtMoney(p.revenue, sym),
    adr:         fmtMoney(p.nights ? p.revenue / p.nights : 0, sym),
    mix:         fmtPct(totalRev ? (100 * p.revenue) / totalRev : 0),
    last_booked: p.lastBooked ?? '—',
  }));

  // Type rollup → donut data (revenue by plan type)
  const typeMap: Record<string, { bookings: number; revenue: number; nights: number }> = {};
  ranked.forEach((p) => {
    if (!typeMap[p.type]) typeMap[p.type] = { bookings: 0, revenue: 0, nights: 0 };
    typeMap[p.type].bookings += p.bookings;
    typeMap[p.type].revenue  += p.revenue;
    typeMap[p.type].nights   += p.nights;
  });
  const typeDonut = Object.entries(typeMap).map(([type, v]) => ({
    name:    formatPlanType(type),
    value:   Math.round(v.revenue),
  })).sort((a, b) => b.value - a.value);

  // Daily trend → line chart
  const trendMap: Record<string, { bookings: number; revenue: number; nights: number }> = {};
  (windowRows ?? []).forEach((r: Record<string, unknown>) => {
    if (r.status === 'canceled') return;
    const day = String(r.booking_date ?? '').slice(0, 10);
    if (!day) return;
    if (!trendMap[day]) trendMap[day] = { bookings: 0, revenue: 0, nights: 0 };
    trendMap[day].bookings += 1;
    trendMap[day].revenue  += Number(r.total_amount ?? 0);
    trendMap[day].nights   += Number(r.nights ?? 0);
  });
  const trendData = Object.entries(trendMap).map(([day, v]) => ({
    day, bookings: v.bookings, revenue: Math.round(v.revenue),
  })).sort((a, b) => a.day.localeCompare(b.day));

  // note#17: enrich planBar so hover tooltip shows bookings + ADR + room-nights alongside revenue
  const planBar = ranked.slice(0, 10).map((p) => ({
    name: p.name.length > 24 ? p.name.slice(0, 24) + '…' : p.name,
    revenue: Math.round(p.revenue),
    bookings: p.bookings,
    adr: Math.round(p.nights ? p.revenue / p.nights : 0),
    rn: p.nights,
  }));

  // Sleeping + orphans (Namkhan-only views)
  const { data: sleepingPlans } = isNamkhan
    ? await supabase
        .from('v_rate_plan_sleeping')
        .select('rate_name, rate_type, last_booked, days_since')
        .eq('property_id', pid)
        .order('days_since', { ascending: false })
        .limit(30)
    : { data: [] as Array<{ rate_name: string; rate_type: string; last_booked: string | null; days_since: number }> };
  const sleepingRows = (sleepingPlans ?? []).map((r) => ({
    name:        formatPlanName(r.rate_name),
    type:        formatPlanType(r.rate_type),
    last_booked: r.last_booked ?? '—',
    days_idle:   fmtInt(r.days_since),
  }));

  const { data: orphans } = isNamkhan
    ? await supabase
        .from('v_rate_plan_orphans')
        .select('rate_plan, bookings_lifetime, revenue_lifetime, last_booked')
        .eq('property_id', pid)
        .order('revenue_lifetime', { ascending: false })
        .limit(20)
    : { data: [] as Array<{ rate_plan: string; bookings_lifetime: number; revenue_lifetime: number; last_booked: string | null }> };
  const orphanRows = (orphans ?? []).map((r) => ({
    plan:        r.rate_plan,
    bookings:    fmtInt(r.bookings_lifetime),
    revenue:     fmtMoney(r.revenue_lifetime, sym),
    last_booked: r.last_booked ?? '—',
  }));

  // Headline tiles
  const tiles: KpiTileProps[] = [
    { label: `Plans booking · ${period.label}`, value: `${plansBookingInWindow}/${activeMasterCount}`, size: 'sm',
      footnote: 'plans w/ ≥1 reservation ÷ active master', status: plansBookingInWindow > 0 ? 'green' : 'grey' },
    { label: 'Sleeping plans 90d', value: sleepingRows.length, size: 'sm',
      footnote: 'idle ≥ 90d', status: sleepingRows.length > 0 ? 'amber' : 'grey' },
    { label: 'Top 3 concentration', value: `${top3Pct.toFixed(1)}%`, size: 'sm',
      footnote: '>60% healthy · <40% scattered', status: top3Pct >= 60 ? 'green' : top3Pct >= 40 ? 'amber' : 'red' },
    { label: `Revenue · ${period.label}`, value: Math.round(totalRev), currency: moneyCurrency, size: 'sm',
      footnote: 'attributed to a rate plan', status: totalRev > 0 ? 'green' : 'grey' },
  ];

  const tabs: DashboardTab[] = subPages.map((s) => ({ key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/rateplans') }));

  // Period pill URL helper
  const hrefFor = (newWin: WindowKey) => {
    const p = new URLSearchParams();
    if (newWin !== '30d') p.set('win', newWin);
    if (period.cmp && period.cmp !== 'none') p.set('cmp', period.cmp);
    const qs = p.toString();
    return `${basePath}${qs ? '?' + qs : ''}`;
  };
  const winOptions: Array<{ k: WindowKey; label: string }> = [
    { k: '7d', label: '7d' }, { k: '30d', label: '30d' }, { k: '90d', label: '90d' }, { k: '180d', label: '180d' },
  ];

  const planCols: ChartSeries[] = [
    { key: 'type',          label: 'Type' },
    { key: 'bookings',      label: 'Bookings' },
    { key: 'cancellations', label: 'Cxl' },
    { key: 'cancel_pct',    label: 'Cancel %' },
    { key: 'revenue',       label: 'Revenue' },
    { key: 'adr',           label: 'ADR' },
    { key: 'mix',           label: 'Mix %' },
    { key: 'last_booked',   label: 'Last booked' },
  ];

  return (
    <DashboardPage
      title="Revenue · Rate plans"
      subtitle={`Sell the right plan, retire the dead ones. ${period.label}.`}
      tabs={tabs}
      action={
        <a href={`${basePath.replace('/rateplans','')}/rateplans/dead`} style={{
          fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
          padding: '6px 14px', borderRadius: 4,
          background: 'var(--terracotta, #B8542A)', color: '#FFF',
          border: 'none', textDecoration: 'none',
        }}>↗ Dead plans (90d)</a>
      }
    >
      <div style={fullRow}><Container title="Headline" subtitle={period.label} density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>
      </Container></div>

      <div style={fullRow}><Container title="Window" subtitle="period selector" density="compact">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {winOptions.map((o) => {
            const active = o.k === period.win;
            return (
              <a key={o.k} href={hrefFor(o.k)} style={{
                fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
                padding: '4px 10px', borderRadius: 99,
                border: `1px solid ${active ? 'var(--primary, #1F3A2E)' : 'var(--hairline, #E6DFCC)'}`,
                background: active ? 'var(--primary, #1F3A2E)' : 'var(--paper, #FFFFFF)',
                color: active ? '#FFFFFF' : 'var(--ink-soft, #5A5A5A)',
                fontWeight: active ? 600 : 500, textDecoration: 'none',
              }}>{o.label}</a>
            );
          })}
        </div>
      </Container></div>

      <div style={fullRow}><Container title="Mix by plan type" subtitle={`revenue share · ${period.label}`}>
        <Chart variant="donut" data={typeDonut} xKey="name"
          series={[{ key: 'value', label: 'Revenue' }]}
          height={220}
          empty={{ title: 'No plan-type mix' }}
        />
      </Container></div>

      <div style={fullRow}><Container title="Top 10 plans · revenue" subtitle={`${period.label} · hover for bookings · ADR · RN`}>
        <Chart variant="bar" data={planBar} xKey="name"
          series={[
            { key: 'revenue',  label: 'Revenue',  color: '#1F3A2E' },
            { key: 'bookings', label: 'Bookings' },
            { key: 'adr',      label: 'ADR' },
            { key: 'rn',       label: 'RN' },
          ]}
          height={240}
          empty={{ title: 'No plans booking in window' }}
        />
      </Container></div>

      <div style={fullRow}><Container title={`Plans · ${ranked.length} active`} subtitle={`${period.label}${hiddenOrphanInWindow > 0 ? ` · ${hiddenOrphanInWindow} orphan/retired hidden` : ''} · v_rate_plan_perf`}>
        <Chart variant="table" data={planRows} xKey="name" series={planCols}
          empty={{ title: 'No plans in window' }}
        />
      </Container></div>

      <div style={fullRow}><Container title="Sleeping plans · ≥ 90d idle" subtitle="candidates to retire · v_rate_plan_sleeping">
        <Chart variant="table" data={sleepingRows} xKey="name"
          series={[
            { key: 'type',        label: 'Type' },
            { key: 'last_booked', label: 'Last booked' },
            { key: 'days_idle',   label: 'Days idle' },
          ]}
          empty={{ title: 'No sleeping plans' }}
        />
      </Container></div>

      <div style={fullRow}><Container title="Orphan plans · not in master" subtitle="booked but not configured · GDS-injected · v_rate_plan_orphans">
        <Chart variant="table" data={orphanRows} xKey="plan"
          series={[
            { key: 'bookings',    label: 'Bookings · lifetime' },
            { key: 'revenue',     label: 'Revenue · lifetime' },
            { key: 'last_booked', label: 'Last booked' },
          ]}
          empty={{ title: 'No orphan plans' }}
        />
      </Container></div>
    </DashboardPage>
  );
}
