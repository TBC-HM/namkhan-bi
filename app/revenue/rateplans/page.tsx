// app/revenue/rateplans/page.tsx — REPLACEMENT (Option B, 2026-05-02)
//
// Audit fixes:
//   1. KPI tiles now operational, not vanity:
//      - "Plans booking in window: X / 100" replaces "Active plans: 100"
//      - "Sleeping plans 90d: 67" replaces "Configured plans: 100"
//      - "Top 3 plans = 51% of revenue" — concentration tile
//      - Revenue tile retained (still useful)
//   2. New table columns: Lead time, Cancel rate, Last booked
//   3. New section: Plan-type rollup (Member/Restricted/Flex/B2B/etc)
//   4. New section: Sleeping plans 90d (retirement candidates)
//   5. New section: Orphan plans (DQ flag — booked but not in rate_plans master)
//
// Required SQL: sql/rateplan_analytics_views.sql must be applied first.

import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { resolvePeriod } from '@/lib/period';
import { fmtMoney } from '@/lib/format';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props { searchParams: Record<string, string | string[] | undefined>; }

export default async function RatePlansPage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);

  // -------- Master plans (configured + flagged active in Cloudbeds) --------
  // Note 2026-05-02: every rate_plans row in this property has is_active=true,
  // so the filter is a no-op today but future-proofs once Cloudbeds starts
  // flagging retired plans.
  const { data: configuredPlans } = await supabase
    .from('rate_plans')
    .select('rate_id, rate_name, rate_type, is_active')
    .eq('property_id', PROPERTY_ID)
    .eq('is_active', true);

  const configuredCount = configuredPlans?.length ?? 0;
  const masterNames = new Set((configuredPlans ?? []).map((p: any) => p.rate_name));

  // -------- "Active" master plans = master plan with at least one non-canceled
  // booking in the last 90 days. Operational definition of "currently selling",
  // since the Cloudbeds is_active flag is always true here and therefore useless. --------
  const { data: recent90 } = await supabase
    .from('reservations')
    .select('rate_plan, status, booking_date')
    .eq('property_id', PROPERTY_ID)
    .gte('booking_date', new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10))
    .neq('status', 'canceled');
  const activeMasterNames = new Set(
    (recent90 ?? [])
      .map((r: any) => r.rate_plan)
      .filter((n: string) => n && masterNames.has(n))
  );
  const activeMasterCount = activeMasterNames.size;

  // -------- Window-scoped reservations (for the period) --------
  const { data: windowRows } = await supabase
    .from('v_rate_plan_perf')
    .select('rate_plan, status, total_amount, nights, lead_days, plan_type, is_configured, booking_date, check_in_date')
    .gte('check_in_date', period.from)
    .lte('check_in_date', period.to);

  // -------- Aggregate by plan name --------
  type PlanAgg = {
    name: string;
    type: string;
    isConfigured: boolean;
    bookings: number;
    cancellations: number;
    nights: number;
    revenue: number;
    leadDaysSum: number;
    leadDaysN: number;
    lastBooked: string | null;
  };
  const planMap: Record<string, PlanAgg> = {};

  (windowRows ?? []).forEach((r: any) => {
    const key = r.rate_plan;
    if (!planMap[key]) {
      planMap[key] = {
        name: key, type: r.plan_type, isConfigured: r.is_configured,
        bookings: 0, cancellations: 0, nights: 0, revenue: 0,
        leadDaysSum: 0, leadDaysN: 0, lastBooked: null,
      };
    }
    const p = planMap[key];
    if (r.status === 'canceled') {
      p.cancellations += 1;
    } else {
      p.bookings += 1;
      p.nights += Number(r.nights || 0);
      p.revenue += Number(r.total_amount || 0);
      if (r.lead_days != null) { p.leadDaysSum += Number(r.lead_days); p.leadDaysN += 1; }
    }
    const bookDate = (r.booking_date as string)?.slice(0, 10);
    if (bookDate && (!p.lastBooked || bookDate > p.lastBooked)) p.lastBooked = bookDate;
  });

  // Aggregate every plan that had any movement in window, then strip
  // anything not in the active master set. Orphans (channel-injected names
  // not in rate_plans) are still surfaced separately in the Orphans card below.
  const rankedAll = Object.values(planMap)
    .map(p => ({
      ...p,
      adr: p.nights ? p.revenue / p.nights : 0,
      cancelPct: (p.bookings + p.cancellations) > 0
        ? (100 * p.cancellations) / (p.bookings + p.cancellations)
        : 0,
      avgLead: p.leadDaysN ? p.leadDaysSum / p.leadDaysN : 0,
    }))
    .filter(p => p.bookings > 0 || p.cancellations > 0)
    .sort((a, b) => b.revenue - a.revenue);

  const ranked = rankedAll.filter(p => activeMasterNames.has(p.name));
  const hiddenOrphanInWindow = rankedAll.length - ranked.length;

  const totalRev = ranked.reduce((s, r) => s + r.revenue, 0);
  const totalBookings = ranked.reduce((s, r) => s + r.bookings, 0);
  const plansBookingInWindow = ranked.filter(r => r.bookings > 0).length;

  // Concentration: top 3 share of revenue
  const top3Rev = ranked.slice(0, 3).reduce((s, r) => s + r.revenue, 0);
  const top3Pct = totalRev > 0 ? (100 * top3Rev) / totalRev : 0;

  // -------- Plan-type rollup --------
  const typeMap: Record<string, { bookings: number; revenue: number; nights: number }> = {};
  ranked.forEach(p => {
    if (!typeMap[p.type]) typeMap[p.type] = { bookings: 0, revenue: 0, nights: 0 };
    typeMap[p.type].bookings += p.bookings;
    typeMap[p.type].revenue += p.revenue;
    typeMap[p.type].nights += p.nights;
  });
  const typeRollup = Object.entries(typeMap)
    .map(([type, v]) => ({
      type, ...v,
      adr: v.nights ? v.revenue / v.nights : 0,
      mix: totalRev ? (100 * v.revenue) / totalRev : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // -------- Sleeping plans (always 90d, irrespective of window selector) --------
  const { data: sleepingPlans } = await supabase
    .from('v_rate_plan_sleeping')
    .select('rate_name, rate_type, last_booked, days_since')
    .order('days_since', { ascending: false })
    .limit(50);

  const sleepingCount = sleepingPlans?.length ?? 0;

  // -------- Orphan plans (DQ flag) --------
  const { data: orphans } = await supabase
    .from('v_rate_plan_orphans')
    .select('rate_plan, bookings_lifetime, revenue_lifetime, last_booked')
    .order('revenue_lifetime', { ascending: false })
    .limit(20);

  return (
    <>
      <PanelHero
        eyebrow={`Rate plans · ${period.label}`}
        title="Rate plan"
        emphasis="performance"
        sub={`${period.rangeLabel} · ${plansBookingInWindow}/${activeMasterCount} active plans booking · top 3 = ${top3Pct.toFixed(0)}% of revenue · ${configuredCount - activeMasterCount} retired or sleeping (90d) hidden`}
        kpis={
          <>
            <KpiCard
              label={`Plans booking ${period.label}`}
              value={`${plansBookingInWindow}/${activeMasterCount}`}
              kind="text"
              hint={`${activeMasterCount > 0 ? Math.round((plansBookingInWindow / activeMasterCount) * 100) : 0}% of active inventory`}
            />
            <KpiCard
              label="Sleeping plans 90d"
              value={sleepingCount}
              hint="retirement candidates"
              tone={sleepingCount > 50 ? 'warn' : 'neutral'}
            />
            <KpiCard
              label="Top 3 concentration"
              value={top3Pct}
              kind="pct"
              hint={`${ranked.slice(0, 3).map(r => r.name.slice(0, 20)).join(' · ')}`}
            />
            <KpiCard
              label={`Revenue ${period.label}`}
              value={totalRev}
              kind="money"
            />
          </>
        }
      />

      {/* PLAN-TYPE ROLLUP — kills the noise of 30 individual plans */}
      <Card
        title="By plan type"
        emphasis="grouped"
        sub={`${period.label} · active master plans only · classified by name pattern · revenue mix`}
        source="v_rate_plan_perf"
      >
        {typeRollup.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
            No bookings in selected window.
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Plan Type</th>
                <th className="num">Bookings</th>
                <th className="num">Roomnights</th>
                <th className="num">Revenue</th>
                <th className="num">ADR</th>
                <th className="num">% Mix</th>
              </tr>
            </thead>
            <tbody>
              {typeRollup.map(r => (
                <tr key={r.type}>
                  <td className="lbl"><strong>{r.type}</strong></td>
                  <td className="num">{r.bookings}</td>
                  <td className="num">{r.nights}</td>
                  <td className="num">{fmtMoney(r.revenue, 'USD')}</td>
                  <td className="num">${r.adr.toFixed(0)}</td>
                  <td className="num text-mute">{r.mix.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* INDIVIDUAL PLANS — with cancel rate & lead time */}
      <Card
        title="Plans"
        emphasis="ranked"
        sub={`${period.label} · active master plans only · sorted by revenue${hiddenOrphanInWindow > 0 ? ` · ${hiddenOrphanInWindow} orphan/retired rows hidden (see Orphans below)` : ''}`}
        source="v_rate_plan_perf"
      >
        {ranked.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
            No rate plan usage in selected window.
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Rate Plan</th>
                <th className="num">Bookings</th>
                <th className="num">Roomnights</th>
                <th className="num">Revenue</th>
                <th className="num">ADR</th>
                <th className="num">% Mix</th>
                <th className="num">Cancel %</th>
                <th className="num">Avg Lead</th>
                <th className="num">Last Booked</th>
              </tr>
            </thead>
            <tbody>
              {ranked.slice(0, 30).map(r => {
                const cancelTone = r.cancelPct >= 40 ? 'var(--err)' : r.cancelPct >= 20 ? 'var(--warn)' : 'inherit';
                return (
                  <tr key={r.name}>
                    <td className="lbl">
                      <strong>{r.name}</strong>
                      {!r.isConfigured && (
                        <span style={{ marginLeft: 8, fontSize: "var(--t-xs)", color: 'var(--warn)', textTransform: 'uppercase' }}>
                          orphan
                        </span>
                      )}
                    </td>
                    <td className="num">{r.bookings}</td>
                    <td className="num">{r.nights}</td>
                    <td className="num">{fmtMoney(r.revenue, 'USD')}</td>
                    <td className="num">${r.adr.toFixed(0)}</td>
                    <td className="num text-mute">{totalRev ? `${((r.revenue / totalRev) * 100).toFixed(0)}%` : '—'}</td>
                    <td className="num" style={{ color: cancelTone }}>{r.cancelPct.toFixed(0)}%</td>
                    <td className="num">{r.avgLead.toFixed(0)}d</td>
                    <td className="num text-mute">{r.lastBooked ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* SLEEPING PLANS — retirement candidates */}
      <Card
        title="Sleeping plans"
        emphasis="≥90 days idle"
        sub={`${sleepingCount} configured plans not booked in 90+ days · candidates to retire in Cloudbeds`}
        source="v_rate_plan_sleeping"
      >
        {sleepingCount === 0 ? (
          <div style={{ padding: 24, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
            All configured plans have a booking in the last 90 days.
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Rate Plan</th>
                <th>Type</th>
                <th className="num">Last Booked</th>
                <th className="num">Days Idle</th>
              </tr>
            </thead>
            <tbody>
              {(sleepingPlans ?? []).slice(0, 30).map((s: any) => (
                <tr key={s.rate_name}>
                  <td className="lbl">{s.rate_name}</td>
                  <td className="text-mute">{s.rate_type ?? '—'}</td>
                  <td className="num text-mute">{s.last_booked ?? 'never'}</td>
                  <td className="num">{s.days_since >= 9999 ? '∞' : `${s.days_since}d`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* ORPHAN PLANS — DQ flag */}
      <Card
        title="Orphan plans"
        emphasis="not in master"
        sub={`Plans booked but not configured in rate_plans table · GDS-injected or compound names · needs mapping (Phase C)`}
        source="v_rate_plan_orphans"
      >
        {(orphans?.length ?? 0) === 0 ? (
          <div style={{ padding: 24, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
            No orphan plans — every booked plan has a master record.
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Rate Plan (as booked)</th>
                <th className="num">Lifetime Bookings</th>
                <th className="num">Lifetime Revenue</th>
                <th className="num">Last Booked</th>
              </tr>
            </thead>
            <tbody>
              {(orphans ?? []).slice(0, 20).map((o: any) => (
                <tr key={o.rate_plan}>
                  <td className="lbl">{o.rate_plan}</td>
                  <td className="num">{o.bookings_lifetime}</td>
                  <td className="num">{fmtMoney(o.revenue_lifetime, 'USD')}</td>
                  <td className="num text-mute">{o.last_booked ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
