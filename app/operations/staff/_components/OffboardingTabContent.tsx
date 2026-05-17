// app/operations/staff/_components/OffboardingTabContent.tsx
//
// PBS 2026-05-15: HR offboarding surface. For each active employee, compute
// seniority (antigüedad) from hire_date and the indemnización exposure under
// Spanish labour law for Donna. Namkhan rows show "n/a" — Lao law has no
// statutory seniority entitlement.
//
// Spanish indemnización rules (post-Feb 2012):
//   • Despido improcedente:           33 days per year of service, capped 24 mo
//   • Despido objetivo:               20 days per year, capped 12 mo
//   • End-of-fixed-term contract:     12 days per year (eventual / obra)
//   • Pre-Feb-2012 service:           45 days/yr (legacy, capped 42 mo) — we
//                                     would split the calc if hire_date < 2012
//
// Daily wage for the calc = monthly_base_eur × 12 / 365 (Spanish convention).

import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import StaffTabStrip from './StaffTabStrip';
import { OPERATIONS_SUBPAGES } from '../../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

interface Props {
  propertyId: number;
  propertyLabel?: string;
  embedded?: boolean;
  subPagesOverride?: { label: string; href: string }[];
}

interface EmployeeRow {
  id: number;
  full_name_en: string | null;
  hire_date: string | null;
  termination_date: string | null;
  current_dept_code: string | null;
  current_position_code: string | null;
  monthly_base_lak: number | null;
  monthly_base_usd_equiv: number | null;
  employment_status: string | null;
  contract_type: string | null;
}

export default async function OffboardingTabContent({ propertyId, propertyLabel, embedded = false, subPagesOverride }: Props) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .schema('hr')
    .from('employees')
    .select('id, full_name_en, hire_date, termination_date, current_dept_code, current_position_code, monthly_base_lak, monthly_base_usd_equiv, employment_status, contract_type')
    .eq('property_id', propertyId)
    .order('hire_date', { ascending: true, nullsFirst: false })
    .limit(500);

  const rows = (data ?? []) as EmployeeRow[];
  const isDonna = propertyId === 1000001;
  const today = new Date();
  const lak2eur = 0; // LAK doesn't apply for Donna; for Donna we use monthly_base_usd_equiv as EUR proxy until monthly_base_eur is wired
  void lak2eur;

  // Pull the latest payslip net pay for each Donna employee (via NIF) as a
  // monthly_eur proxy when monthly_base_eur isn't populated. This gives us
  // realistic indemnización numbers today.
  const monthlyByName = new Map<string, number>();
  if (isDonna) {
    const { data: payRows } = await sb
      .from('v_payroll_remesa_es')
      .select('employee_name, amount_eur, period_year, period_month')
      .eq('property_id', propertyId)
      .eq('payment_kind', 'monthly')
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
      .limit(2000);
    for (const r of (payRows ?? []) as { employee_name: string; amount_eur: number }[]) {
      const key = normalizeName(r.employee_name);
      if (!monthlyByName.has(key)) monthlyByName.set(key, Number(r.amount_eur) || 0);
    }
  }

  // Filter to active employees (don't show already terminated)
  const active = rows.filter((r) => r.employment_status !== 'terminated' && !r.termination_date);

  const enriched = active.map((r) => {
    const hireDate = r.hire_date ? new Date(r.hire_date) : null;
    const seniorityMs = hireDate ? today.getTime() - hireDate.getTime() : 0;
    const seniorityDays = Math.max(0, Math.floor(seniorityMs / 86_400_000));
    const seniorityYears = seniorityDays / 365.25;
    const seniorityWhole = Math.floor(seniorityYears);
    const seniorityMonths = Math.floor((seniorityYears - seniorityWhole) * 12);

    let monthlyEur = 0;
    if (isDonna) {
      monthlyEur = monthlyByName.get(normalizeName(r.full_name_en || '')) ?? 0;
    }
    const dailyEur = monthlyEur > 0 ? (monthlyEur * 12) / 365 : 0;

    // Indemnización scenarios
    const indemUnfair      = isDonna ? Math.min(dailyEur * 33 * seniorityYears, monthlyEur * 24) : null;
    const indemObjective   = isDonna ? Math.min(dailyEur * 20 * seniorityYears, monthlyEur * 12) : null;
    const indemFixedTermEnd= isDonna ? dailyEur * 12 * seniorityYears : null;

    return {
      ...r,
      seniorityDays,
      seniorityYears,
      seniorityLabel: hireDate ? `${seniorityWhole}y ${seniorityMonths}m` : '—',
      monthlyEur,
      indemUnfair,
      indemObjective,
      indemFixedTermEnd,
    };
  });

  // Sort by seniority desc — longest-serving first (highest exposure)
  enriched.sort((a, b) => b.seniorityDays - a.seniorityDays);

  const total = enriched.length;
  const totalUnfair    = enriched.reduce((s, r) => s + (r.indemUnfair      ?? 0), 0);
  const totalObjective = enriched.reduce((s, r) => s + (r.indemObjective   ?? 0), 0);
  const totalFixed     = enriched.reduce((s, r) => s + (r.indemFixedTermEnd?? 0), 0);
  const avgSenYears    = total > 0 ? enriched.reduce((s, r) => s + r.seniorityYears, 0) / total : 0;
  const top5Years      = enriched.slice(0, 5).reduce((s, r) => s + r.seniorityYears, 0);

  const eyebrow = propertyLabel
    ? `Operations · Staff · Offboarding · ${propertyLabel}`
    : `Operations · Staff · Offboarding`;

  const body = (
    <>
      <div style={{
        margin: '8px 0 14px',
        padding: '12px 14px',
        fontSize: 'var(--t-sm)',
        color: 'var(--ink-soft)',
        background: 'var(--paper-warm)',
        border: '1px solid var(--paper-deep)',
        borderLeft: '3px solid var(--brass)',
        borderRadius: 6,
      }}>
        {isDonna ? (
          <>
            <strong style={{ color: 'var(--brass)' }}>Spanish antigüedad calc · live.</strong>{' '}
            Each row shows continuous service from <code>hr.employees.hire_date</code> + the
            indemnización exposure under three legal scenarios (33-day / 20-day / 12-day rates).
            Monthly base derives from the latest <em>remesa bancaria</em> net pay
            (<code>ops.payroll_remesa_es</code>) until <code>monthly_base_eur</code> is wired
            on <code>hr.employees</code> — gestoría number is more accurate; this is the best
            available proxy today.
          </>
        ) : (
          <>
            <strong style={{ color: 'var(--brass)' }}>Seniority (Lao law).</strong>{' '}
            The Lao labour code (<em>law on labour 2014</em>) does NOT define a statutory
            seniority/indemnización entitlement comparable to Spain. Continuous service is
            shown for context but termination payouts follow the contract&apos;s own clauses
            (notice, end-of-service gratuity if any). The Spanish exposure columns are blank
            for Namkhan rows.
          </>
        )}
        {error && <div style={{ marginTop: 6, color: 'var(--st-bad, #B23B3B)' }}>Error loading: {error.message}</div>}
      </div>

      {/* KPI band */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
        <Kpi value={total}                                  label="Active staff" hint="Excludes terminated" />
        <Kpi value={`${avgSenYears.toFixed(1)} yr`}         label="Avg seniority" hint="Mean across active" />
        <Kpi value={`${top5Years.toFixed(1)} yr`}           label="Top 5 combined" hint="Longest-serving 5 staff combined" />
        {isDonna && (
          <>
            <Kpi value={fmtEur(totalUnfair)}    label="Exposure · unfair · 33d/yr"  hint="Σ indemnización if all dismissed as despido improcedente · capped 24 mo" tone="warn" />
            <Kpi value={fmtEur(totalObjective)} label="Exposure · objective · 20d/yr" hint="Σ if all dismissed as despido objetivo · capped 12 mo" />
            <Kpi value={fmtEur(totalFixed)}     label="Exposure · fixed-term end · 12d/yr" hint="Σ on end-of-contract (eventual/obra-servicio)" />
          </>
        )}
        {!isDonna && (
          <Kpi value="n/a" label="Indemnización exposure" hint="No statutory entitlement under Lao law" warn />
        )}
      </div>

      <Panel
        title={`Active staff · seniority + ${isDonna ? 'indemnización exposure' : 'context'}`}
        eyebrow={`${total} rows · sorted by seniority desc`}
      >
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ width: '100%', fontSize: 'var(--t-sm)' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Employee</th>
                <th style={{ textAlign: 'left' }}>Dept</th>
                <th style={{ textAlign: 'left' }}>Position</th>
                <th style={{ textAlign: 'left' }}>Hire date</th>
                <th style={{ textAlign: 'right' }}>Seniority</th>
                {isDonna && <th style={{ textAlign: 'right' }}>Monthly €</th>}
                {isDonna && <th style={{ textAlign: 'right' }}>Unfair · 33d/y</th>}
                {isDonna && <th style={{ textAlign: 'right' }}>Objective · 20d/y</th>}
                {isDonna && <th style={{ textAlign: 'right' }}>Fixed-end · 12d/y</th>}
              </tr>
            </thead>
            <tbody>
              {enriched.length === 0 && (
                <tr><td colSpan={isDonna ? 9 : 5} style={{ padding: 18, color: 'var(--ink-mute)', fontStyle: 'italic', textAlign: 'center' }}>
                  No active staff loaded for {propertyLabel ?? 'this property'}.
                </td></tr>
              )}
              {enriched.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.full_name_en ?? '—'}</td>
                  <td style={{ color: 'var(--ink-soft)' }}>{r.current_dept_code ?? '—'}</td>
                  <td style={{ color: 'var(--ink-soft)' }}>{r.current_position_code ?? '—'}</td>
                  <td style={{ fontFamily: 'var(--mono)', color: 'var(--ink-soft)' }}>{r.hire_date ?? '—'}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600 }}>{r.seniorityLabel}</td>
                  {isDonna && (
                    <>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                        {r.monthlyEur > 0 ? fmtEur(r.monthlyEur) : <span style={{ color: 'var(--ink-mute)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--st-bad, #B23B3B)' }}>
                        {r.indemUnfair ? fmtEur(r.indemUnfair) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--st-warn, #C28F2C)' }}>
                        {r.indemObjective ? fmtEur(r.indemObjective) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                        {r.indemFixedTermEnd ? fmtEur(r.indemFixedTermEnd) : '—'}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {isDonna && (
        <Panel title="Calc methodology" eyebrow="Spanish labour law · post-Feb-2012">
          <div style={{ padding: 14, fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li><strong>Seniority</strong> = today − <code>hire_date</code>. Continuous service.</li>
              <li><strong>Daily wage</strong> = monthly_eur × 12 ÷ 365.</li>
              <li><strong>Despido improcedente (unfair):</strong> 33 days × years, capped at 24 monthly wages.</li>
              <li><strong>Despido objetivo (economic):</strong> 20 days × years, capped at 12 monthly wages.</li>
              <li><strong>End of fixed-term:</strong> 12 days × years (eventual / obra-servicio contracts).</li>
              <li>
                <strong>Legacy clause:</strong> service before Feb-2012 accrued at 45 days/year
                (capped 42 mo). Employees hired pre-2012 should have their calc split — wired
                automatically once we surface the cutoff date.
              </li>
            </ul>
            <div style={{ marginTop: 10, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
              These numbers are <strong>maximum exposure</strong> — actual outcomes negotiate
              down via mutual agreement (acuerdo amistoso), settlement (finiquito con
              indemnización), or court-determined causa procedente. Use as upper-bound for
              redundancy modelling.
            </div>
          </div>
        </Panel>
      )}
    </>
  );

  if (embedded) return body;
  return (
    <Page
      eyebrow={eyebrow}
      title={<>Offboarding · <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>{propertyLabel ?? ''}</em></>}
      subPages={subPagesOverride ?? rewriteSubPagesForProperty(OPERATIONS_SUBPAGES, propertyId)}
    >
      <StaffTabStrip propertyId={propertyId} />
      {body}
    </Page>
  );
}

function normalizeName(s: string): string {
  return (s || '').toUpperCase().replace(/[,.]/g, '').replace(/\s+/g, ' ').trim();
}

function fmtEur(n: number): string {
  if (!isFinite(n) || n === 0) return '—';
  const abs = Math.abs(n);
  if (abs >= 1000) return `€${(n / 1000).toFixed(1)}k`;
  return `€${Math.round(n)}`;
}

function Kpi({ value, label, hint, warn, tone }: {
  value: string | number;
  label: string;
  hint?: string;
  warn?: boolean;
  tone?: 'warn' | 'default';
}) {
  const accent = warn || tone === 'warn' ? 'var(--st-warn, #C28F2C)' : 'var(--brass)';
  return (
    <div title={hint} style={{
      padding: 12, background: 'var(--paper-warm)',
      border: '1px solid var(--paper-deep)', borderLeft: `3px solid ${accent}`,
      borderRadius: 6,
    }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
        letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
        color: 'var(--ink-mute)',
      }}>{label}</div>
      <div style={{
        marginTop: 4, fontSize: 'var(--t-lg)', fontWeight: 600,
        color: warn ? 'var(--ink-mute)' : 'var(--ink)',
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
    </div>
  );
}
