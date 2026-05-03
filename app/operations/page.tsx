// app/operations/page.tsx
// Operations · Pillar entry — strategic snapshot, NOT a duplicate of /today.
//
// Today's headcount/arrivals/departures live on /operations/today. This page
// answers the question "how is operations doing as a function?" — open
// decisions, DQ critical, tasks due this week, dept payroll/headcount,
// agent action queue.
//
// No FilterStrip — every tile here is "now" or "this week" by definition.

import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable, { type Column } from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import ActionCard, { ActionStack } from '@/components/sections/ActionCard';
import { supabaseGl } from '@/lib/supabase-gl';
import { getKpiToday, getDqIssues, getCaptureRates } from '@/lib/data';
import { fmtTableUsd, fmtKpi, EMPTY } from '@/lib/format';

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

interface DeptPayroll {
  period_month: string;
  dept_code: string | null;
  dept_name: string | null;
  headcount: number | null;
  total_days_worked: number | null;
  total_grand_usd: number | null;
}

async function getOpsSnapshot(): Promise<OpsSnapshot | null> {
  const { data, error } = await supabaseGl
    .from('v_ops_snapshot')
    .select('*')
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0] as OpsSnapshot;
}

async function getDeptPayroll(): Promise<DeptPayroll[]> {
  // ops schema now exposed via PostgREST
  const opsClient = (await import('@supabase/supabase-js')).createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: 'ops' }, auth: { persistSession: false } },
  );
  const { data, error } = await opsClient
    .from('v_payroll_dept_monthly')
    .select('period_month, dept_code, dept_name, headcount, total_days_worked, total_grand_usd')
    .order('period_month', { ascending: false })
    .order('total_grand_usd', { ascending: false })
    .limit(40);
  if (error || !data) return [];
  // Keep latest closed period only
  const latest = data[0]?.period_month;
  return (data as DeptPayroll[]).filter(r => r.period_month === latest);
}

export default async function OperationsSnapshotPage() {
  const [snap, deptPayroll, today, dq, cap] = await Promise.all([
    getOpsSnapshot(),
    getDeptPayroll(),
    getKpiToday().catch(() => null),
    getDqIssues().catch(() => []),
    getCaptureRates().catch(() => null),
  ]);

  const totalHeadcount = deptPayroll.reduce((s, r) => s + Number(r.headcount || 0), 0);
  const totalPayrollUsd = deptPayroll.reduce((s, r) => s + Number(r.total_grand_usd || 0), 0);
  const latestPeriod = deptPayroll[0]?.period_month
    ? new Date(deptPayroll[0].period_month).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : EMPTY;

  // Action cards — keep the existing 3 conditional ones, they're real
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
      conclusion: <>Cloudbeds <strong>getHousekeepingStatus</strong> returns 403. Front-desk relying on whiteboard. Open ticket with Cloudbeds support requesting <strong>housekeeping:read</strong> scope.</>,
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

  // Dept health table
  const cols: Column<DeptPayroll>[] = [
    {
      key: 'dept', header: 'Department',
      render: (r) => <strong>{r.dept_name || r.dept_code || EMPTY}</strong>,
      sortValue: (r) => (r.dept_name || r.dept_code || '') as string,
    },
    {
      key: 'headcount', header: 'Headcount', align: 'right',
      render: (r) => r.headcount ?? EMPTY,
      sortValue: (r) => Number(r.headcount || 0),
    },
    {
      key: 'days', header: 'Days worked', align: 'right',
      render: (r) => r.total_days_worked ?? EMPTY,
      sortValue: (r) => Number(r.total_days_worked || 0),
    },
    {
      key: 'usd', header: 'Payroll', align: 'right',
      render: (r) => fmtTableUsd(r.total_grand_usd),
      sortValue: (r) => Number(r.total_grand_usd || 0),
    },
    {
      key: 'usd_per_head', header: '$ / staff', align: 'right',
      render: (r) => {
        const v = (r.headcount && Number(r.headcount) > 0)
          ? Number(r.total_grand_usd || 0) / Number(r.headcount)
          : null;
        return fmtTableUsd(v);
      },
      sortValue: (r) => {
        if (!r.headcount || Number(r.headcount) === 0) return 0;
        return Number(r.total_grand_usd || 0) / Number(r.headcount);
      },
    },
    {
      key: 'share', header: 'Share', align: 'right',
      render: (r) => {
        if (totalPayrollUsd <= 0) return EMPTY;
        return `${(Number(r.total_grand_usd || 0) / totalPayrollUsd * 100).toFixed(1)}%`;
      },
      sortValue: (r) => Number(r.total_grand_usd || 0),
    },
  ];

  // Sub-page tiles
  const subPages = [
    { href: '/operations/today',          label: 'Today',          desc: 'arrivals · departures · in-house', color: 'var(--green-2)' },
    { href: '/operations/restaurant',     label: 'Restaurant',     desc: 'F&B capture · POS · cost' },
    { href: '/operations/spa',            label: 'Spa',            desc: 'utilisation · upsell' },
    { href: '/operations/activities',     label: 'Activities',     desc: 'bookings · revenue mix' },
    { href: '/operations/housekeeping',   label: 'Housekeeping',   desc: 'OOO/OOS · turn time', isNew: true },
    { href: '/operations/maintenance',    label: 'Maintenance',    desc: 'open tickets · preventive', isNew: true },
    { href: '/operations/staff',          label: 'Staff',          desc: 'register · roster · attendance', isNew: true },
    { href: '/operations/agents',         label: 'Agents',         desc: 'roster + last runs' },
  ];

  return (
    <>
      <PageHeader
        pillar="Operations"
        tab="Pillar entry"
        title={<>The <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>property</em> as a function — health across departments.</>}
        lede="Open work · DQ · staffing · cost. Strategic view, not the live arrivals board (that's the Today tab)."
        rightSlot={
          <a href="/operations/today" style={{ fontSize: 'var(--t-sm)', color: 'var(--brass)', textDecoration: 'underline' }}>
            → Live: {today?.in_house ?? 0} in-house · {today?.arrivals_today ?? 0} arrivals · {today?.departures_today ?? 0} departures
          </a>
        }
      />

      {/* Strategic KPI strip — work-in-flight + audit signals + payroll envelope */}
      <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 18 }}>
        <KpiBox
          label="Open ops decisions"
          value={snap?.ops_decisions_pending ?? 0}
          unit="count"
          state={(snap?.ops_decisions_pending ?? 0) === 0 ? 'data-needed' : 'live'}
          needs="queue empty · agents idle"
        />
        <KpiBox
          label="DQ critical open"
          value={snap?.dq_critical ?? 0}
          unit="count"
        />
        <KpiBox
          label="Tasks due 7d"
          value={snap?.tasks_due_7d ?? 0}
          unit="count"
        />
        <KpiBox
          label="Maintenance open"
          value={snap?.maint_open ?? 0}
          unit="count"
          state={(snap?.maint_open ?? 0) === 0 ? 'data-needed' : 'live'}
          needs="no open tickets"
        />
      </div>

      <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 12 }}>
        <KpiBox
          label="Active staff"
          value={snap?.staff_active ?? totalHeadcount}
          unit="count"
        />
        <KpiBox
          label={`Payroll ${latestPeriod}`}
          value={totalPayrollUsd}
          unit="usd"
        />
        <KpiBox
          label="Shifts last 7d"
          value={snap?.shifts_last_7d ?? 0}
          unit="count"
          state={(snap?.shifts_last_7d ?? 0) === 0 ? 'data-needed' : 'live'}
          needs="no rosters logged"
        />
        <KpiBox
          label="F&B capture · 30d"
          value={fnbCap > 0 ? fnbCap : null}
          unit="pct"
          state={fnbCap > 0 ? 'live' : 'data-needed'}
          needs="no capture data"
        />
      </div>

      {/* Department health */}
      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'var(--t-lg)', marginBottom: 6 }}>
          Department <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>health</em>
        </h2>
        <p style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-mute, #8a8170)', margin: '0 0 12px' }}>
          Latest closed payroll period · {latestPeriod} · headcount × days × USD per <code>ops.v_payroll_dept_monthly</code>.
          Click a row name for the dept sub-page.
        </p>
        {deptPayroll.length === 0 ? (
          <div style={{ padding: 16, color: 'var(--ink-mute)', fontStyle: 'italic', textAlign: 'center' }}>
            No payroll rows yet for any closed period.
          </div>
        ) : (
          <DataTable<DeptPayroll>
            rows={deptPayroll}
            columns={cols}
            rowKey={(r) => r.dept_code || r.dept_name || ''}
            defaultSort={{ key: 'usd', dir: 'desc' }}
          />
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
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'var(--t-lg)', marginBottom: 12 }}>
          Drill <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>into</em> a department
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {subPages.map(p => (
            <a
              key={p.href}
              href={p.href}
              style={{
                display: 'block',
                padding: '14px 16px',
                background: 'var(--card, #fff)',
                border: '1px solid var(--line, #e7e2d8)',
                borderRadius: 8,
                textDecoration: 'none',
                color: 'var(--ink, #2a2620)',
                transition: 'border-color .15s ease, transform .1s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                <strong style={{ fontSize: 'var(--t-md)' }}>{p.label}</strong>
                {p.isNew && <StatusPill tone="info">new</StatusPill>}
              </div>
              <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute, #8a8170)' }}>{p.desc}</div>
            </a>
          ))}
        </div>
      </section>
    </>
  );
}
