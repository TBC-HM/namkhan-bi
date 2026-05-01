// app/operations/staff/page.tsx
// Operations · Staff (Pillar 04 · sub-tab 09).
// HR-director overview: headcount, payroll, anomalies, staff register.
// Reads ops.v_staff_register_extended, ops.v_staff_anomalies, ops.v_payroll_dept_monthly.
//
// v1 scope (shipped 2026-05-01):
//   - PanelHero + 5 KPIs (Active HC, Monthly payroll, Avg cost/FTE, Days worked, Open issues)
//   - Headcount by department (table)
//   - Staff register (table, all 70 active staff)
//   - Anomalies grid (4 cards)
//   - Monthly upload zone stub
//
// Deferred to next session:
//   - Slide-in drawer with 4 tabs (Profile / Salary / Attendance / Docs)
//   - Edge Function staff-doc-upload (live monthly batch upload)
//   - Headcount-by-dept chart

import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';
import { supabase } from '@/lib/supabase';
import { fmtMoney, fmtNumber, fmtDate, FX_LAK_PER_USD } from '@/lib/format';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props { searchParams: Record<string, string | string[] | undefined>; }

interface StaffRow {
  staff_id: string;
  emp_id: string | null;
  full_name: string | null;
  position_title: string | null;
  dept_code: string | null;
  dept_name: string | null;
  employment_type: string | null;
  monthly_salary: number | null;
  hourly_cost_lak: number | null;
  hire_date: string | null;
  is_active: boolean;
  payslip_status: 'never' | 'current' | 'overdue' | null;
  last_payslip_period: string | null;
}

interface DeptRow {
  period_month: string;
  dept_code: string;
  dept_name: string;
  headcount: number;
  total_days_worked: number | null;
  total_net_lak: number | null;
  total_grand_usd: number | null;
}

interface AnomalyRow {
  issue: string;
  staff_id: string;
  full_name: string | null;
  dept_code: string | null;
  dept_name: string | null;
}

const ANOMALY_LABELS: Record<string, { title: string; sub: string }> = {
  missing_hire_date:      { title: 'Missing hire date',     sub: 'Contract import gap — separate handover.' },
  missing_employee_code:  { title: 'Missing employee code', sub: 'Allocate TNK code via HR.' },
  contract_expiring_60d:  { title: 'Contract expiring',     sub: 'End date ≤ 60 days. Renew or release.' },
  no_payslip_last_month:  { title: 'Payslip missing',       sub: 'Upload last closed-month payslip.' },
};

export default async function OperationsStaffPage({ searchParams: _ }: Props) {
  // Fetch in parallel. Each query gracefully degrades on error.
  const [registerRes, deptRes, anomaliesRes, lastPeriodRes] = await Promise.all([
    supabase
      .schema('ops' as any)
      .from('v_staff_register_extended')
      .select('staff_id, emp_id, full_name, position_title, dept_code, dept_name, employment_type, monthly_salary, hourly_cost_lak, hire_date, is_active, payslip_status, last_payslip_period')
      .eq('is_active', true)
      .order('full_name'),
    supabase
      .schema('ops' as any)
      .from('v_payroll_dept_monthly')
      .select('period_month, dept_code, dept_name, headcount, total_days_worked, total_net_lak, total_grand_usd'),
    supabase
      .schema('ops' as any)
      .from('v_staff_anomalies')
      .select('issue, staff_id, full_name, dept_code, dept_name'),
    supabase
      .schema('ops' as any)
      .from('payroll_monthly')
      .select('period_month')
      .order('period_month', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const staff: StaffRow[] = (registerRes.data ?? []) as any;
  const allDept: DeptRow[]  = (deptRes.data ?? []) as any;
  const anomalies: AnomalyRow[] = (anomaliesRes.data ?? []) as any;
  const lastPeriod: string | null = (lastPeriodRes.data as any)?.period_month ?? null;

  // Filter dept rows to last closed period
  const deptRows = lastPeriod
    ? allDept.filter(r => r.period_month === lastPeriod).sort((a, b) => (b.total_grand_usd ?? 0) - (a.total_grand_usd ?? 0))
    : [];

  // ── KPIs ─────────────────────────────────────────────────────────────
  const activeHc = staff.length;
  const monthlyPayrollUsd = deptRows.reduce((s, r) => s + Number(r.total_grand_usd ?? 0), 0);
  const monthlyPayrollLak = deptRows.reduce((s, r) => s + Number(r.total_net_lak ?? 0), 0);
  const avgPerFteUsd = activeHc > 0 ? monthlyPayrollUsd / activeHc : 0;
  const totalDaysWorked = deptRows.reduce((s, r) => s + Number(r.total_days_worked ?? 0), 0);

  // Anomalies grouped
  const anomalyByIssue: Record<string, AnomalyRow[]> = {};
  for (const a of anomalies) {
    (anomalyByIssue[a.issue] ??= []).push(a);
  }
  const openIssuesCount = anomalies.length;

  // Period label
  const lastPeriodLabel = lastPeriod
    ? new Date(lastPeriod).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : 'no payroll data';

  return (
    <>
      <PanelHero
        eyebrow={`Staff · register · ${lastPeriodLabel}`}
        title="Staff"
        emphasis="register"
        sub="Active headcount · payroll cost · contract & payslip hygiene"
        kpis={
          <>
            <KpiCard label="Active headcount" value={activeHc} kind="number" />
            <KpiCard label="Monthly payroll" value={monthlyPayrollUsd} kind="money" hint={`₭${(monthlyPayrollLak / 1_000_000).toFixed(1)}M`} />
            <KpiCard label="Avg cost / FTE" value={avgPerFteUsd} kind="money" />
            <KpiCard label="Days worked" value={totalDaysWorked} kind="number" hint={`${lastPeriodLabel}`} />
            <KpiCard
              label="Open issues"
              value={openIssuesCount}
              kind="number"
              tone={openIssuesCount > 0 ? 'warn' : 'pos'}
              hint={`${Object.keys(anomalyByIssue).length} categories`}
            />
          </>
        }
      />

      {/* ───────── Section 1 · Headcount & cost by department ───────── */}
      <Card
        title="Headcount & cost"
        emphasis="by department"
        sub={`Source — ops.v_payroll_dept_monthly · ${lastPeriodLabel}`}
        source="Supabase · live"
      >
        {deptRows.length === 0 ? (
          <div style={{ padding: '24px 0', color: 'var(--ink-mute, #888)' }}>No payroll data for last closed period.</div>
        ) : (
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Department</th>
                <th style={thNum}>HC</th>
                <th style={thNum}>Days worked</th>
                <th style={thNum}>Net (LAK)</th>
                <th style={thNum}>Total (USD)</th>
                <th style={thNum}>% payroll</th>
              </tr>
            </thead>
            <tbody>
              {deptRows.map(r => {
                const pct = monthlyPayrollUsd > 0 ? (Number(r.total_grand_usd ?? 0) / monthlyPayrollUsd) * 100 : 0;
                return (
                  <tr key={r.dept_code}>
                    <td style={td}>
                      <strong>{r.dept_name}</strong>
                      <div style={{ fontSize: 11, color: 'var(--ink-mute, #888)', fontFamily: 'monospace' }}>{r.dept_code}</div>
                    </td>
                    <td style={tdNum}>{fmtNumber(Number(r.headcount))}</td>
                    <td style={tdNum}>{fmtNumber(Number(r.total_days_worked ?? 0))}</td>
                    <td style={tdNum}>₭{fmtNumber(Number(r.total_net_lak ?? 0) / 1_000_000, 1)}M</td>
                    <td style={tdNum}>${fmtNumber(Number(r.total_grand_usd ?? 0))}</td>
                    <td style={tdNum}>{pct.toFixed(1)}%</td>
                  </tr>
                );
              })}
              <tr style={{ fontWeight: 600, borderTop: '2px solid var(--line, #ddd)' }}>
                <td style={td}>Total</td>
                <td style={tdNum}>{activeHc}</td>
                <td style={tdNum}>{fmtNumber(totalDaysWorked)}</td>
                <td style={tdNum}>₭{fmtNumber(monthlyPayrollLak / 1_000_000, 1)}M</td>
                <td style={tdNum}>${fmtNumber(monthlyPayrollUsd)}</td>
                <td style={tdNum}>100.0%</td>
              </tr>
            </tbody>
          </table>
        )}
      </Card>

      {/* ───────── Section 2 · Anomalies grid ───────── */}
      <Card
        title="Anomalies"
        emphasis="& alerts"
        sub="Live data-quality flags. Owner action required."
        source={`${openIssuesCount} flag${openIssuesCount === 1 ? '' : 's'}`}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {Object.entries(ANOMALY_LABELS).map(([issue, meta]) => {
            const rows = anomalyByIssue[issue] ?? [];
            return (
              <div
                key={issue}
                style={{
                  border: '1px solid var(--line, #ddd)',
                  padding: 16,
                  background: rows.length > 0 ? 'rgba(184,168,120,0.06)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <strong style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{meta.title}</strong>
                  <span style={{ fontSize: 22, fontStyle: 'italic', fontFamily: 'serif', color: rows.length > 0 ? 'var(--bad, #b54)' : 'var(--good, #4a6)' }}>
                    {rows.length}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-mute, #888)', marginBottom: 10 }}>{meta.sub}</div>
                {rows.length > 0 && (
                  <details>
                    <summary style={{ fontSize: 11, color: 'var(--ink-mute, #888)', cursor: 'pointer' }}>
                      Show {rows.length === 1 ? '1 person' : `all ${rows.length} people`}
                    </summary>
                    <ul style={{ margin: '8px 0 0 0', padding: 0, listStyle: 'none', maxHeight: 200, overflowY: 'auto' }}>
                      {rows.slice(0, 70).map(r => (
                        <li key={`${issue}-${r.staff_id}`} style={{ fontSize: 12, padding: '3px 0', borderBottom: '1px dotted var(--line-soft, #eee)' }}>
                          <span style={{ fontWeight: 500 }}>{r.full_name ?? '—'}</span>
                          <span style={{ color: 'var(--ink-mute, #888)' }}> · {r.dept_name ?? '—'}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* ───────── Section 3 · Staff register ───────── */}
      <Card
        title="Staff register"
        emphasis={`· ${activeHc} active`}
        sub="Source — ops.v_staff_register_extended · click is read-only in v1; drawer ships next session"
        source="Supabase · live"
      >
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={th}>Emp ID</th>
                <th style={th}>Name</th>
                <th style={th}>Position</th>
                <th style={th}>Department</th>
                <th style={th}>Type</th>
                <th style={thNum}>Monthly LAK</th>
                <th style={thNum}>Hourly LAK</th>
                <th style={th}>Hire date</th>
                <th style={th}>Last payslip</th>
              </tr>
            </thead>
            <tbody>
              {staff.map(s => (
                <tr key={s.staff_id}>
                  <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>{s.emp_id ?? '—'}</td>
                  <td style={{ ...td, fontWeight: 500 }}>{s.full_name ?? '—'}</td>
                  <td style={td}>{s.position_title ?? '—'}</td>
                  <td style={td}>{s.dept_name ?? '—'}</td>
                  <td style={{ ...td, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-mute, #888)' }}>{s.employment_type ?? '—'}</td>
                  <td style={tdNum}>₭{fmtNumber(Number(s.monthly_salary ?? 0))}</td>
                  <td style={tdNum}>₭{fmtNumber(Number(s.hourly_cost_lak ?? 0))}</td>
                  <td style={td}>{s.hire_date ? fmtDate(s.hire_date) : <span style={{ color: 'var(--bad, #b54)' }}>—</span>}</td>
                  <td style={td}>
                    {s.payslip_status === 'current' && <span style={{ color: 'var(--good, #4a6)' }}>✓ {s.last_payslip_period ? fmtDate(s.last_payslip_period) : ''}</span>}
                    {s.payslip_status === 'overdue' && <span style={{ color: 'var(--warn, #c83)' }}>⚠ {s.last_payslip_period ? fmtDate(s.last_payslip_period) : ''}</span>}
                    {(s.payslip_status === 'never' || s.payslip_status == null) && <span style={{ color: 'var(--ink-mute, #888)' }}>never</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {staff.length === 0 && (
          <div style={{ padding: '24px 0', color: 'var(--ink-mute, #888)' }}>
            No active staff. If this is wrong, check ops.v_staff_register_extended directly.
          </div>
        )}
      </Card>

      {/* ───────── Section 4 · Monthly upload zone (stub) ───────── */}
      <Card
        title="Monthly salary documents"
        emphasis="upload"
        sub="Drop payslips, contracts, ID copies — auto-matched to staff by filename"
        source="Coming next deploy"
      >
        <div
          style={{
            border: '2px dashed var(--line, #ddd)',
            padding: '40px 24px',
            textAlign: 'center',
            background: 'rgba(184,168,120,0.04)',
          }}
        >
          <div style={{ fontFamily: 'serif', fontStyle: 'italic', fontSize: 18, marginBottom: 8 }}>
            Upload zone — wired next session
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-mute, #888)', maxWidth: 540, margin: '0 auto', lineHeight: 1.6 }}>
            Filename pattern <code>TNK_&lt;empid&gt;_YYYY-MM_&lt;kind&gt;.pdf</code> auto-matches to <code>v_staff_register_extended</code>.
            Edge Function <code>staff-doc-upload</code> (deferred) writes to bucket <code>documents-confidential</code> + creates rows in
            <code> docs.documents</code> and <code>docs.hr_docs</code>. Audit row written per upload.
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-mute, #888)', marginTop: 12 }}>
            Today — <strong>{anomalyByIssue.no_payslip_last_month?.length ?? 0}</strong> staff missing a payslip for {lastPeriodLabel}.
          </div>
        </div>
      </Card>
    </>
  );
}

// ── inline table styles (matches existing data-table convention used elsewhere) ──
const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '2px solid var(--line, #ddd)',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  fontWeight: 600,
  color: 'var(--ink-mute, #888)',
  whiteSpace: 'nowrap',
};
const thNum: React.CSSProperties = { ...th, textAlign: 'right' };
const td: React.CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid var(--line-soft, #eee)',
  verticalAlign: 'top',
};
const tdNum: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
