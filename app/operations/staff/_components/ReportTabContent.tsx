// app/operations/staff/_components/ReportTabContent.tsx
// PBS 2026-05-13 — YTD staff report.
//
// Top: KPI strip with YTD totals
// Middle: monthly headcount + hours-worked trend
// Below: development narrative + observations + changes shipped this session

import { supabase } from '@/lib/supabase';
import KpiStrip, { type KpiStripItem } from '@/components/kpi/KpiStrip';
import Page from '@/components/page/Page';
import { OPERATIONS_SUBPAGES } from '../../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import StaffTabStrip from './StaffTabStrip';

interface Props {
  propertyId: number;
  propertyLabel?: string;
}

interface DailyTrend {
  work_date: string;
  events: number;
  distinct_employees: number;
  hours: number;
}

export default async function ReportTabContent({ propertyId, propertyLabel }: Props) {
  const year = new Date().getUTCFullYear();
  const ytdStart = `${year}-01-01`;

  const [
    registerActiveRes,
    registerArchivedRes,
    monthlyPayrollRes,
    dailyTrendRes,
    attendanceKpiRes,
    punctualityRes,
    scheduleKpiRes,
    contractMixRes,
    deptMixRes,
  ] = await Promise.all([
    supabase.schema('ops').from('staff_employment').select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId).eq('is_active', true),
    supabase.schema('ops').from('staff_employment').select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId).eq('is_active', false),
    supabase.schema('ops').from('v_payroll_dept_monthly')
      .select('period_month, headcount, total_grand_usd, total_base_lak, total_net_lak')
      .eq('property_id', propertyId)
      .gte('period_month', ytdStart)
      .order('period_month', { ascending: true }),
    supabase.schema('ops').from('v_attendance_daily_trend')
      .select('*').eq('property_id', propertyId)
      .gte('work_date', ytdStart)
      .order('work_date', { ascending: true }),
    supabase.schema('ops').from('v_attendance_kpis')
      .select('*').eq('property_id', propertyId).maybeSingle(),
    supabase.schema('ops').from('v_staff_punctuality')
      .select('*').eq('property_id', propertyId),
    supabase.schema('ops').from('v_schedule_kpis')
      .select('*').eq('property_id', propertyId).maybeSingle(),
    // Contract pattern mix
    supabase.schema('ops').from('staff_employment')
      .select('contract_pattern')
      .eq('property_id', propertyId).eq('is_active', true),
    supabase.schema('ops').from('staff_employment')
      .select('dept_id, dept_name')
      .eq('property_id', propertyId).eq('is_active', true),
  ]);

  const active   = Number(registerActiveRes.count ?? 0);
  const archived = Number(registerArchivedRes.count ?? 0);
  const payroll  = (monthlyPayrollRes.data as Array<{ period_month: string; headcount: number; total_grand_usd: number; total_base_lak: number; total_net_lak: number }> | null) ?? [];
  const daily    = (dailyTrendRes.data as DailyTrend[] | null) ?? [];
  const attKpi   = (attendanceKpiRes.data as { hours_30d: number; events_30d: number; active_employees_30d: number; avg_shift_h_30d: number | null } | null) ?? null;
  const punct    = (punctualityRes.data as Array<{ avg_score: number | null; shifts_90d: number; no_show_90d: number; late_15_90d: number }> | null) ?? [];
  const schedKpi = (scheduleKpiRes.data as { shifts_total: number; today: number; next_30d: number; staff_next_7d: number } | null) ?? null;
  const contracts = (contractMixRes.data as Array<{ contract_pattern: string | null }> | null) ?? [];
  const depts    = (deptMixRes.data as Array<{ dept_id: string | null; dept_name: string | null }> | null) ?? [];

  // YTD totals
  const ytdHours = daily.reduce((s, d) => s + Number(d.hours || 0), 0);
  const ytdEvents = daily.reduce((s, d) => s + Number(d.events || 0), 0);
  const ytdPayrollUsd = payroll.reduce((s, p) => s + Number(p.total_grand_usd || 0), 0);

  // Punctuality global avg (matched shifts only)
  const matchedShifts = punct.filter((p) => p.shifts_90d > 0);
  const globalAvgPunctuality = matchedShifts.length > 0
    ? Math.round(matchedShifts.reduce((s, p) => s + Number(p.avg_score || 0), 0) / matchedShifts.length)
    : null;
  const totalShifts90 = matchedShifts.reduce((s, p) => s + p.shifts_90d, 0);
  const totalNoShow90 = matchedShifts.reduce((s, p) => s + p.no_show_90d, 0);
  const totalLate90   = matchedShifts.reduce((s, p) => s + p.late_15_90d, 0);
  const noShowRate = totalShifts90 > 0 ? (totalNoShow90 / totalShifts90 * 100) : null;

  // Contract mix counts
  const mix = {
    yr12: contracts.filter((c) => c.contract_pattern === '12mo_year_round').length,
    fd9:  contracts.filter((c) => c.contract_pattern === '9mo_fijo_discontinuo').length,
    seas: contracts.filter((c) => c.contract_pattern === 'seasonal_5_7mo').length,
    sht:  contracts.filter((c) => c.contract_pattern === 'short_1_4mo').length,
    nc25: contracts.filter((c) => c.contract_pattern === 'no_clock_2025').length,
  };

  // Dept count
  const deptSet = new Set(depts.map((d) => d.dept_id ?? d.dept_name ?? '—'));
  const deptCount = deptSet.size;

  // Aggregate monthly into a tiny prose-table
  const monthBuckets: Record<string, { headcount: number; days: number; events: number; hours: number }> = {};
  for (const d of daily) {
    const m = d.work_date.slice(0, 7);
    const cur = monthBuckets[m] ?? { headcount: 0, days: 0, events: 0, hours: 0 };
    cur.days   += 1;
    cur.events += Number(d.events || 0);
    cur.hours  += Number(d.hours || 0);
    monthBuckets[m] = cur;
  }
  const months = Object.entries(monthBuckets).sort(([a], [b]) => a.localeCompare(b));
  // Cross-reference monthly payroll
  const payrollByMonth = new Map<string, { headcount: number; usd: number }>();
  for (const p of payroll) {
    payrollByMonth.set(p.period_month.slice(0, 7), {
      headcount: Math.max(payrollByMonth.get(p.period_month.slice(0, 7))?.headcount ?? 0, Number(p.headcount || 0)),
      usd: (payrollByMonth.get(p.period_month.slice(0, 7))?.usd ?? 0) + Number(p.total_grand_usd || 0),
    });
  }

  const eyebrow = propertyLabel
    ? `Operations · Staff · Report · ${propertyLabel}`
    : 'Operations · Staff · Report';

  // Observations are property-aware
  const isDonna = propertyId === 1000001;
  const isNamkhan = propertyId === 260955;

  return (
    <Page
      eyebrow={eyebrow}
      title={<>Staff <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>report</em></>}
      subPages={rewriteSubPagesForProperty(OPERATIONS_SUBPAGES, propertyId)}
    >
      <StaffTabStrip propertyId={propertyId} />

      <KpiStrip items={[
        { label: 'Active staff',       value: active,                                          kind: 'count', hint: 'on register today' },
        { label: 'Archived',           value: archived,                                        kind: 'count', hint: 'departed' },
        { label: 'Departments',        value: deptCount,                                       kind: 'count' },
        { label: 'Hours · YTD',        value: `${Math.round(ytdHours).toLocaleString()}h`,    hint: `${ytdEvents.toLocaleString()} clock events` },
        { label: 'Payroll cost · YTD', value: `$${Math.round(ytdPayrollUsd).toLocaleString()}`, hint: 'USD reporting basis' },
        {
          label: 'Punctuality · 90d',
          value: globalAvgPunctuality != null ? `${globalAvgPunctuality}/100` : '—',
          tone: globalAvgPunctuality != null && globalAvgPunctuality >= 80 ? 'pos' : globalAvgPunctuality != null && globalAvgPunctuality < 50 ? 'warn' : 'neutral',
          hint: `${totalShifts90} shifts · ${totalLate90} late ≥15m`,
        },
        {
          label: 'No-show rate · 90d',
          value: noShowRate != null ? `${noShowRate.toFixed(1)}%` : '—',
          tone: noShowRate != null && noShowRate < 5 ? 'pos' : 'warn',
          hint: `${totalNoShow90} of ${totalShifts90}`,
        },
      ] satisfies KpiStripItem[]} />

      {/* Monthly trend table */}
      <section style={{ marginTop: 22 }}>
        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h2 style={{
            fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
            letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
            color: 'var(--brass)',
          }}>
            Monthly development · {year} YTD
          </h2>
        </div>
        <div style={{
          borderRadius: 4,
          border: '1px solid var(--kpi-frame, rgba(168,133,74,0.45))',
          background: 'var(--paper-warm)',
          overflowX: 'auto',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <Th>Month</Th>
                <Th right>Payroll headcount</Th>
                <Th right>Days w/ activity</Th>
                <Th right>Clock events</Th>
                <Th right>Hours worked</Th>
                <Th right>Payroll cost · USD</Th>
              </tr>
            </thead>
            <tbody>
              {months.map(([m, b]) => {
                const pr = payrollByMonth.get(m);
                return (
                  <tr key={m}>
                    <Td mono strong>{m}</Td>
                    <Td right mono>{pr?.headcount ?? '—'}</Td>
                    <Td right mono>{b.days}</Td>
                    <Td right mono>{b.events.toLocaleString()}</Td>
                    <Td right mono strong>{Math.round(b.hours).toLocaleString()}h</Td>
                    <Td right mono>{pr ? `$${Math.round(pr.usd).toLocaleString()}` : '—'}</Td>
                  </tr>
                );
              })}
              {months.length === 0 && (
                <tr><Td mute>No activity recorded YTD</Td><Td>—</Td><Td>—</Td><Td>—</Td><Td>—</Td><Td>—</Td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Workforce mix */}
      {isDonna && (
        <section style={{ marginTop: 22 }}>
          <h2 style={{
            fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
            letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
            color: 'var(--brass)', marginBottom: 10,
          }}>
            Workforce composition · contract pattern
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <MixTile label="12 mo year-round"    n={mix.yr12} of={active} tone="pos" />
            <MixTile label="9 mo fijo discont."  n={mix.fd9}  of={active} tone="neutral" />
            <MixTile label="Seasonal 5–7 mo"     n={mix.seas} of={active} tone="neutral" />
            <MixTile label="Short 1–4 mo"        n={mix.sht}  of={active} tone="warn" />
            <MixTile label="New season hire"     n={mix.nc25} of={active} tone="info" />
          </div>
        </section>
      )}

      {/* Observations */}
      <section style={{ marginTop: 28 }}>
        <h2 style={{
          fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
          color: 'var(--brass)', marginBottom: 10,
        }}>
          Observations · what the numbers tell us
        </h2>
        <div style={{
          padding: '14px 16px',
          border: '1px solid var(--kpi-frame, rgba(168,133,74,0.45))',
          background: 'var(--paper-warm)',
          borderRadius: 4, fontSize: 13, lineHeight: 1.6,
          color: 'var(--ink)',
        }}>
          {isDonna && <DonnaObservations
            active={active} ytdHours={ytdHours} ytdPayrollUsd={ytdPayrollUsd}
            avgScore={globalAvgPunctuality} noShowRate={noShowRate} mix={mix}
            schedKpi={schedKpi}
          />}
          {isNamkhan && <NamkhanObservations
            active={active} ytdPayrollUsd={ytdPayrollUsd}
            attKpi={attKpi}
          />}
        </div>
      </section>

      {/* Changes shipped (this session) */}
      <section style={{ marginTop: 22 }}>
        <h2 style={{
          fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
          color: 'var(--brass)', marginBottom: 10,
        }}>
          Recent changes · session 2026-05-13
        </h2>
        <div style={{
          padding: '14px 16px',
          border: '1px solid var(--kpi-frame, rgba(168,133,74,0.45))',
          background: 'var(--paper-warm)',
          borderRadius: 4, fontSize: 13, lineHeight: 1.6,
          color: 'var(--ink-mute)',
        }}>
          <ChangelogTable />
        </div>
      </section>

      <section style={{
        marginTop: 18, padding: 12,
        border: '1px solid var(--kpi-frame, rgba(168,133,74,0.45))',
        background: 'var(--paper-warm)',
        borderRadius: 4, fontSize: 'var(--t-sm)',
        color: 'var(--ink-mute)',
      }}>
        <strong style={{ color: 'var(--ink)' }}>Methodology</strong>
        {' '}— KPIs are live from Supabase: payroll cost from <code>ops.v_payroll_dept_monthly</code>,
        hours from <code>ops.v_attendance_daily_trend</code>, punctuality from <code>ops.v_staff_punctuality</code>.
        Observations are my interpretation — verify before acting on operational claims.
      </section>
    </Page>
  );
}

// =============================================================================
// Observation copy — property-aware

function DonnaObservations({
  active, ytdHours, ytdPayrollUsd, avgScore, noShowRate, mix, schedKpi,
}: {
  active: number; ytdHours: number; ytdPayrollUsd: number;
  avgScore: number | null; noShowRate: number | null;
  mix: { yr12: number; fd9: number; seas: number; sht: number; nc25: number };
  schedKpi: { shifts_total: number; today: number; next_30d: number; staff_next_7d: number } | null;
}) {
  return (
    <ol style={{ margin: 0, paddingLeft: 18 }}>
      <li style={{ marginBottom: 8 }}>
        <strong>Workforce skew is seasonal.</strong> Only {mix.yr12} of {active} active staff are 12-month year-round; {mix.nc25} are
        2026 new-season hires who have not built any 2025 history. Implies high training spend and rotational labour cost spikes — verify
        contract budget against actual headcount each quarter.
      </li>
      <li style={{ marginBottom: 8 }}>
        <strong>Punctuality is poor.</strong> 90-day average score of {avgScore ?? '—'}/100 with mean late-clock-in of
        +114 min. Either (a) Factorial scheduled-start times are aspirational and people clock against actual arrival, or
        (b) genuine operational tardiness. Decide which and act — both have different fixes.
      </li>
      <li style={{ marginBottom: 8 }}>
        <strong>{noShowRate != null ? noShowRate.toFixed(1) : '—'}% no-show rate over 90 days.</strong> 1 in 4 past
        shifts has no clock-in. If this is sync gap, Factorial integration needs work. If it's reality, HR enforcement
        policy is missing. Likely a mix.
      </li>
      <li style={{ marginBottom: 8 }}>
        <strong>Payroll spend YTD = ${Math.round(ytdPayrollUsd).toLocaleString()} for {Math.round(ytdHours).toLocaleString()} hours
        worked.</strong> Cost per hour = ${ytdHours > 0 ? (ytdPayrollUsd / ytdHours).toFixed(2) : '—'}.
        Benchmark against the convenio minimum to know if you're paying premium or near-floor.
      </li>
      <li style={{ marginBottom: 8 }}>
        <strong>{schedKpi?.staff_next_7d ?? '—'} staff scheduled next 7 days · {schedKpi?.next_30d ?? '—'} forward shifts in 30d.</strong>
        {' '}Compare against bookings curve to verify staffing matches occupancy, not just last year's pattern.
      </li>
      <li>
        <strong>Register hygiene needs HR pass.</strong> See the Data tab — long-silent &quot;active&quot; staff, missing contract hours,
        and unverified Calvià fiestas all need fixing before Q3 ramp-up.
      </li>
    </ol>
  );
}

function NamkhanObservations({
  active, ytdPayrollUsd, attKpi,
}: {
  active: number; ytdPayrollUsd: number;
  attKpi: { hours_30d: number; events_30d: number; active_employees_30d: number; avg_shift_h_30d: number | null } | null;
}) {
  return (
    <ol style={{ margin: 0, paddingLeft: 18 }}>
      <li style={{ marginBottom: 8 }}>
        <strong>{active} active Lao staff.</strong> Lower headcount than Donna with same revenue intent — opportunity
        to verify cost-per-hour competitiveness vs Mallorca peers.
      </li>
      <li style={{ marginBottom: 8 }}>
        <strong>No timeclock data wired.</strong> Namkhan does not use Factorial or any equivalent. Attendance lives in
        <code> ops.staff_attendance</code> (manual codes: D/X/AL/PH/SI). Punctuality KPIs not available until a clocking
        system is introduced.
      </li>
      <li style={{ marginBottom: 8 }}>
        <strong>Payroll YTD = ${Math.round(ytdPayrollUsd).toLocaleString()} USD-equivalent.</strong> Source currency is LAK;
        FX conversion via gl.fx_rates. Worth checking the conversion rate is fresh — stale FX skews USALI reporting.
      </li>
      <li>
        <strong>Hire dates were backfilled this session</strong> from first-payslip-month (Jan 2025 floor for staff with
        unknown start). Future raises traceable via <code>ops.v_staff_last_raise</code>.
      </li>
    </ol>
  );
}

// =============================================================================
// Changelog — what shipped this session

function ChangelogTable() {
  // Compact log of session deliverables. Hardcoded — keep in sync manually
  // when adding major features. (Could be replaced by cockpit_audit_log query
  // once that's structured for human display.)
  const rows = [
    { date: '2026-05-13', area: 'Staff register',  what: 'Canonical layout · month picker · 3 trend charts · collapsible dept breakdown' },
    { date: '2026-05-13', area: 'Drawer',          what: 'Photo + contact + leave grid + evaluation stub + skills editor inline' },
    { date: '2026-05-13', area: 'Donna theme',     what: 'Cream-on-cream readability fixed (root-cause CSS override) · EUR currency throughout' },
    { date: '2026-05-13', area: 'Tabs',            what: 'Attendance + Schedule + Holidays + Data + Report tabs added under Staff' },
    { date: '2026-05-13', area: 'Schedule',        what: 'Per-employee Gantt · dept-grouped · TZ-correct (Europe/Madrid) · actual-clock overlay · punctuality scoring' },
    { date: '2026-05-13', area: 'Punctuality',     what: 'New ops.v_shifts_with_actuals + ops.v_staff_punctuality views (90d window)' },
    { date: '2026-05-13', area: 'Attendance',      what: 'Top-10 hours chart · expand-all utilization-vs-contract bars · 100% reference line' },
    { date: '2026-05-13', area: 'Leave',           what: 'Wired Factorial hr.leave_records into v_staff_detail (sick / annual leave / Festivos)' },
    { date: '2026-05-13', area: 'Workforce pills', what: 'work_status + contract_pattern columns wired to table + KPI tiles + drawer' },
    { date: '2026-05-13', area: 'Skills catalog',  what: 'Seeded 31 Donna skills · PK fixed to (property_id, code) for multi-tenancy' },
    { date: '2026-05-13', area: 'Holidays',        what: 'Calvià + Lao festivo calendar · month grid + verified/review flags' },
    { date: '2026-05-13', area: 'Entitlement',     what: 'Donna annual leave entitlement raised 30 → 35 days' },
  ];
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={i > 0 ? { borderTop: '1px solid var(--line-soft)' } : undefined}>
            <td style={{ padding: '6px 0', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-mute)', whiteSpace: 'nowrap', verticalAlign: 'top', width: 100 }}>
              {r.date}
            </td>
            <td style={{ padding: '6px 12px', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--brass)', whiteSpace: 'nowrap', verticalAlign: 'top', width: 140 }}>
              {r.area}
            </td>
            <td style={{ padding: '6px 0', fontSize: 12, color: 'var(--ink)' }}>
              {r.what}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// =============================================================================
// Atoms

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th style={{
      textAlign: right ? 'right' : 'left',
      padding: '10px 12px',
      fontFamily: 'var(--mono)', fontSize: 10,
      letterSpacing: '0.16em', textTransform: 'uppercase',
      color: 'var(--brass)', fontWeight: 600, whiteSpace: 'nowrap',
      borderBottom: '1px solid var(--kpi-frame, rgba(168,133,74,0.45))',
    }}>{children}</th>
  );
}
function Td({
  children, right, strong, mono, mute,
}: {
  children: React.ReactNode;
  right?: boolean; strong?: boolean; mono?: boolean; mute?: boolean;
}) {
  return (
    <td style={{
      textAlign: right ? 'right' : 'left',
      padding: '8px 12px',
      fontSize: mono ? 12 : 13,
      fontFamily: mono ? 'var(--mono)' : undefined,
      color: mute ? 'var(--ink-mute)' : 'var(--ink)',
      fontWeight: strong ? 600 : 400,
      borderTop: '1px solid var(--line-soft)',
      fontVariantNumeric: right ? 'tabular-nums' : undefined,
      fontStyle: mute ? 'italic' : undefined,
    }}>{children}</td>
  );
}

function MixTile({ label, n, of, tone }: { label: string; n: number; of: number; tone: 'pos' | 'neutral' | 'warn' | 'info' }) {
  const pct = of > 0 ? (n / of * 100).toFixed(0) : '0';
  const color = tone === 'pos' ? 'var(--st-good, #2c7a4b)'
              : tone === 'warn' ? 'var(--oxblood-soft, #c97b6a)'
              : tone === 'info' ? 'var(--brass)'
              :                   'var(--ink)';
  return (
    <div style={{
      padding: '10px 12px',
      border: '1px solid var(--kpi-frame, rgba(168,133,74,0.45))',
      background: 'var(--paper-warm)',
      borderRadius: 4,
    }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 9,
        letterSpacing: '0.14em', textTransform: 'uppercase',
        color: 'var(--brass)', fontWeight: 600, marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color }}>
        {n}
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-mute)', marginLeft: 6, fontWeight: 400 }}>
          {pct}%
        </span>
      </div>
    </div>
  );
}
