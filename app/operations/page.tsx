// app/operations/page.tsx
// Re-restored 2026-05-05 — Snapshot + Today merged into single pillar entry.
// SlimHero + Today KpiStrip + Arrivals/Departures/In-house tables +
// strategic block (DQ, payroll, action cards, sub-page launcher).

import SlimHero from '@/components/sections/SlimHero';
import KpiStrip, { type KpiStripItem } from '@/components/kpi/KpiStrip';
import StatusPill from '@/components/ui/StatusPill';
import ActionCard, { ActionStack } from '@/components/sections/ActionCard';
import { supabaseGl } from '@/lib/supabase-gl';
import { supabase } from '@/lib/supabase';
import { getKpiToday, getDqIssues, getCaptureRates, getArrivalsDeparturesToday } from '@/lib/data';
import { fmtDateShort } from '@/lib/format';
import DeptHealthTable, { type DeptPayrollRow } from './_components/DeptHealthTable';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface OpsSnapshot {
  dq_critical: number;
  dq_warning: number;
  dq_total_open: number;
  tasks_due_7d: number;
  maint_open: number;
  staff_active: number;
  shifts_last_7d: number;
  ops_decisions_pending: number;
}

type DeptPayroll = DeptPayrollRow;

async function getOpsSnapshot(): Promise<OpsSnapshot | null> {
  const { data, error } = await supabaseGl.from('v_ops_snapshot').select('*').limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0] as OpsSnapshot;
}

async function getDeptPayroll(): Promise<DeptPayroll[]> {
  const { data, error } = await supabase
    .schema('ops')
    .from('v_payroll_dept_monthly')
    .select('period_month, dept_code, dept_name, headcount, total_days_worked, total_grand_usd')
    .order('period_month', { ascending: false })
    .order('total_grand_usd', { ascending: false })
    .limit(40);
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[ops/page] getDeptPayroll', error);
    return [];
  }
  if (!data) return [];
  const latest = (data as DeptPayroll[])[0]?.period_month;
  return (data as DeptPayroll[]).filter(r => r.period_month === latest);
}

export default async function OperationsPage() {
  const [snap, deptPayroll, today, list, dq, cap] = await Promise.all([
    getOpsSnapshot(),
    getDeptPayroll(),
    getKpiToday().catch(() => null),
    getArrivalsDeparturesToday().catch(() => []),
    getDqIssues().catch(() => []),
    getCaptureRates().catch(() => null),
  ]);

  const arrivals = list.filter((r: any) => r.today_role === 'arrival');
  const departures = list.filter((r: any) => r.today_role === 'departure');
  const inhouse = list.filter((r: any) => r.today_role === 'in_house');

  const inHouseCount = today?.in_house ?? 0;
  const totalRooms = today?.total_rooms ?? 0;
  const available = totalRooms - inHouseCount;

  const totalHeadcount = deptPayroll.reduce((s, r) => s + Number(r.headcount || 0), 0);
  const totalPayrollUsd = deptPayroll.reduce((s, r) => s + Number(r.total_grand_usd || 0), 0);
  const latestPeriod = deptPayroll[0]?.period_month
    ? new Date(deptPayroll[0].period_month).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : '—';

  const fnbCap = Number(cap?.fnb_capture_pct ?? 0);
  const fnbRevPerOccRn = Number(cap?.fnb_per_occ_room ?? 0);
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
      conclusion: <>Cloudbeds <strong>getHousekeepingStatus</strong> returns 403. Open ticket with Cloudbeds support requesting <strong>housekeeping:read</strong> scope.</>,
      verdict: [{ label: 'Confidence · 100%' }, { label: 'Blocker · severity high', tone: 'bad' as const }, { label: 'External · Cloudbeds' }],
      primaryAction: 'Open ticket', secondaryAction: 'Defer', tertiaryAction: 'Mark as known',
      impact: 'Visibility', impactSub: 'OOO/OOS unblocked',
    });
  }
  if (fnbCap > 0 && fnbCap < 70) {
    const capGap = 70 - fnbCap;
    const missingResv = (capGap / 100) * (cap?.total_resv ?? 0);
    const monthlyUpside = Math.round(missingResv * fnbRevPerOccRn * 0.5);
    cards.push({
      pillar: 'ops' as const,
      pillarLabel: 'Operations · Restaurant',
      agentLabel: '· F&B Capture Agent',
      priority: 'med' as const,
      priorityLabel: 'Medium · 30d trend',
      headline: <>F&B capture <em>at {fnbCap.toFixed(0)}%</em>.<br />Below 70% benchmark.</>,
      conclusion: <>Of <strong>{cap?.total_resv ?? 0}</strong> reservations checking in last 30 days, only <strong>{Math.round((cap?.total_resv ?? 0) * fnbCap / 100)}</strong> recorded an F&B charge. Closing to 70% recovers ~<strong>${monthlyUpside.toLocaleString()}/mo</strong>.</>,
      verdict: [{ label: `Capture · ${fnbCap.toFixed(0)}%`, tone: 'warn' as const }, { label: `Gap · ${capGap.toFixed(0)}pp` }, { label: 'Confidence · 50%' }],
      primaryAction: 'Schedule review', secondaryAction: 'See drilldown', tertiaryAction: 'Defer',
      impact: monthlyUpside > 0 ? `+$${(monthlyUpside / 1000).toFixed(1)}k` : 'Capture lift', impactSub: 'est. monthly recovery',
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
      conclusion: <>Without market_segment, channel-mix and ADR-by-segment analysis is impossible. Train Lao team on the 6 standard tags and enforce via Cloudbeds field.</>,
      verdict: [{ label: '82% missing', tone: 'warn' as const }, { label: 'Training task' }, { label: 'Effort · low' }],
      primaryAction: 'Schedule training', secondaryAction: 'Send SOP', tertiaryAction: 'Defer',
      impact: 'Analytics', impactSub: 'segment slicing unblocked',
    });
  }

  const subPages = [
    { href: '/operations/staff',        label: 'Staff',        desc: 'register · roster · attendance' },
    { href: '/operations/restaurant',   label: 'F&B',          desc: 'capture · POS · USALI cost' },
    { href: '/operations/spa',          label: 'Spa',          desc: 'treatments · capture · cost' },
    { href: '/operations/activities',   label: 'Activities',   desc: 'bookings · transport · supplier margin' },
    { href: '/operations/inventory',    label: 'Inventory',    desc: 'stock · par · suppliers' },
    { href: '/operations/catalog-cleanup', label: 'Catalog cleanup', desc: 'duplicate codes · taxonomy' },
    { href: '/operations/agents',       label: 'Agents',       desc: 'roster + last runs' },
  ];

  return (
    <>
      <SlimHero
        eyebrow="Operations · live"
        title="The"
        emphasis="property"
        sub="arrivals · in-house · departures · health · payroll"
      />

      {/* Today KPIs */}
      <KpiStrip items={[
        { label: 'In-House',        value: inHouseCount, kind: 'count' },
        { label: 'Arrivals',        value: today?.arrivals_today ?? 0, kind: 'count' },
        { label: 'Departures',      value: today?.departures_today ?? 0, kind: 'count' },
        { label: 'Available',       value: available, kind: 'count', hint: `${totalRooms} active rooms` },
        { label: 'OTB next 90d',    value: today?.otb_next_90d ?? 0, kind: 'count' },
        { label: 'F&B capture · 30d', value: fnbCap > 0 ? fnbCap : 0, kind: 'pct', tone: fnbCap >= 70 ? 'pos' : fnbCap > 0 ? 'warn' : 'neg', hint: 'benchmark 70%+' },
      ] satisfies KpiStripItem[]} />

      {/* Strategic KPIs */}
      <KpiStrip items={[
        { label: 'Open ops decisions',   value: snap?.ops_decisions_pending ?? 0, kind: 'count' },
        { label: 'DQ critical',          value: snap?.dq_critical ?? 0, kind: 'count', tone: (snap?.dq_critical ?? 0) > 0 ? 'neg' : 'pos' },
        { label: 'Tasks due 7d',         value: snap?.tasks_due_7d ?? 0, kind: 'count' },
        { label: 'Maintenance open',     value: snap?.maint_open ?? 0, kind: 'count' },
        { label: 'Active staff',         value: snap?.staff_active ?? totalHeadcount, kind: 'count' },
        { label: `Payroll ${latestPeriod}`, value: totalPayrollUsd, kind: 'money' },
      ] satisfies KpiStripItem[]} />

      {/* Today tables */}
      <h2 style={{ marginTop: 28, marginBottom: 6, fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)' }}>
        Today · arrivals · departures · in-house
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18, marginTop: 12 }}>
        <section>
          <h3 style={{ fontSize: 'var(--t-sm)', fontWeight: 500, marginBottom: 6 }}>
            Arrivals <span style={{ color: 'var(--ink-soft)' }}>· {arrivals.length}</span>
          </h3>
          {arrivals.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--ink-mute)', fontStyle: 'italic' }}>No arrivals today.</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr><th>Guest</th><th>Source</th><th>Room Type</th><th className="num">Nights</th></tr>
              </thead>
              <tbody>
                {arrivals.map((r: any) => (
                  <tr key={r.reservation_id}>
                    <td className="lbl"><strong>{r.guest_name || '—'}</strong></td>
                    <td className="lbl text-mute">{r.source_name || '—'}</td>
                    <td className="lbl">{r.room_type_name || '—'}</td>
                    <td className="num">{r.nights}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h3 style={{ fontSize: 'var(--t-sm)', fontWeight: 500, marginBottom: 6 }}>
            Departures <span style={{ color: 'var(--ink-soft)' }}>· {departures.length}</span>
          </h3>
          {departures.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--ink-mute)', fontStyle: 'italic' }}>No departures today.</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr><th>Guest</th><th>Source</th><th>Room Type</th><th className="num">Balance</th></tr>
              </thead>
              <tbody>
                {departures.map((r: any) => {
                  const bal = Number(r.balance || 0);
                  return (
                    <tr key={r.reservation_id}>
                      <td className="lbl"><strong>{r.guest_name || '—'}</strong></td>
                      <td className="lbl text-mute">{r.source_name || '—'}</td>
                      <td className="lbl">{r.room_type_name || '—'}</td>
                      <td className={`num ${bal > 0 ? 'text-bad' : ''}`}>{bal > 0 ? `$${bal.toFixed(0)}` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section style={{ marginTop: 22 }}>
        <h3 style={{ fontSize: 'var(--t-sm)', fontWeight: 500, marginBottom: 6 }}>
          In-House <span style={{ color: 'var(--ink-soft)' }}>· {inhouse.length} guests</span>
        </h3>
        {inhouse.length === 0 ? (
          <div style={{ padding: 16, color: 'var(--ink-mute)', fontStyle: 'italic' }}>No in-house guests.</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Guest</th>
                <th>CB ID</th>
                <th>Source</th>
                <th>Room Type</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th className="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {inhouse.map((r: any) => {
                const bal = Number(r.balance || 0);
                return (
                  <tr key={r.reservation_id}>
                    <td className="lbl"><strong>{r.guest_name || '—'}</strong></td>
                    <td className="lbl text-mute">
                      <a href={`https://hotels.cloudbeds.com/connect/reservations#/edit/${r.reservation_id}`}
                         target="_blank" rel="noopener noreferrer"
                         style={{ color: 'var(--brass)', textDecoration: 'underline' }}>
                        {r.reservation_id}
                      </a>
                    </td>
                    <td className="lbl text-mute">{r.source_name || '—'}</td>
                    <td className="lbl">{r.room_type_name || '—'}</td>
                    <td className="lbl">{fmtDateShort(r.check_in_date)}</td>
                    <td className="lbl">{fmtDateShort(r.check_out_date)}</td>
                    <td className={`num ${bal > 0 ? 'text-bad' : ''}`}>{bal > 0 ? `$${bal.toFixed(0)}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Department health */}
      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)', marginBottom: 6 }}>
          Department health · payroll {latestPeriod}
        </h2>
        {deptPayroll.length === 0 ? (
          <div style={{ padding: 16, color: 'var(--ink-mute)', fontStyle: 'italic', textAlign: 'center' }}>
            No payroll rows yet for any closed period.
          </div>
        ) : (
          <DeptHealthTable rows={deptPayroll} />
        )}
      </section>

      {/* Action queue */}
      {cards.length > 0 && (
        <ActionStack
          title={<><em>The decisions</em><br />queued for you.</>}
          count={cards.length}
          meta={`${cards.length} awaiting · operations pillar`}
        >
          {cards.map((c, i) => <ActionCard key={i} num={i + 1} {...c} />)}
        </ActionStack>
      )}

      {/* Sub-page launcher */}
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)', marginBottom: 12 }}>
          Drill into a department
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {subPages.map(p => (
            <a key={p.href} href={p.href} style={{ display: 'block', padding: '14px 16px', background: 'var(--card, #fff)', border: '1px solid var(--line, #e7e2d8)', borderRadius: 8, textDecoration: 'none', color: 'var(--ink, #2a2620)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                <strong style={{ fontSize: 'var(--t-md)' }}>{p.label}</strong>
              </div>
              <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute, #8a8170)' }}>{p.desc}</div>
            </a>
          ))}
        </div>
      </section>
    </>
  );
}
