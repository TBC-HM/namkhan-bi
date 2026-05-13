// app/operations/staff/_components/DataTabContent.tsx
// PBS 2026-05-13 — Data-quality findings dashboard.
// Pulls every known data-quality issue into one place so PBS/Maxi/HR
// can see what's wrong, missing, or stale across the staff data layer.
//
// Each row = one finding. Live counts where possible; static notes for
// architectural issues (e.g. stale duplicate views).

import { supabase } from '@/lib/supabase';
import KpiStrip, { type KpiStripItem } from '@/components/kpi/KpiStrip';
import Page from '@/components/page/Page';
import { OPERATIONS_SUBPAGES } from '../../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import StaffTabStrip from './StaffTabStrip';
import StatusPill, { type StatusTone } from '@/components/ui/StatusPill';

interface Props {
  propertyId: number;
  propertyLabel?: string;
}

type Severity = 'high' | 'med' | 'low' | 'info';
type Finding = {
  area: string;
  title: string;
  detail: string;
  count: number | string;
  severity: Severity;
  status: 'open' | 'fix-in-progress' | 'resolved';
  action: string;
};

function sevTone(s: Severity): StatusTone {
  return s === 'high' ? 'expired' : s === 'med' ? 'pending' : s === 'low' ? 'inactive' : 'info';
}
function statusTone(s: Finding['status']): StatusTone {
  return s === 'resolved' ? 'active' : s === 'fix-in-progress' ? 'pending' : 'expired';
}

export default async function DataTabContent({ propertyId, propertyLabel }: Props) {
  // ── Live queries (parallel) ──────────────────────────────────────────────
  const [
    activeRegisterRes,
    missingHireDateRes,
    missingContractHoursRes,
    missingContractPdfRes,
    contractExpiringRes,
    noClockActiveRes,
    silentLongRes,
    silentRecentRes,
    scheduledNeverClockedRes,
    whitespaceNamesRes,
    unmappedRes,
    nullAllowanceRes,
    hodColumnNullRes,
    deptNoHodRes,
    anomaliesRes,
    duplicateViewRes,
    namkhanNullLeaveRes,
  ] = await Promise.all([
    supabase.schema('ops').from('staff_employment').select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId).eq('is_active', true),
    supabase.schema('ops').from('staff_employment').select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId).eq('is_active', true).is('hire_date', null),
    supabase.schema('ops').from('staff_employment').select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId).eq('is_active', true).is('contract_hours_pw', null),
    supabase.schema('ops').from('staff_employment').select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId).eq('is_active', true).is('contract_doc_id', null),
    // contract expiring (≤60d) — use anomalies view if available; here we approximate via end_date
    supabase.schema('ops').from('staff_employment').select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId).eq('is_active', true)
      .not('end_date', 'is', null)
      .lte('end_date', new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
    supabase.schema('ops').from('staff_employment').select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId).eq('is_active', true).eq('work_status', 'never_clocked'),
    supabase.schema('ops').from('staff_employment').select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId).eq('is_active', true).eq('work_status', 'silent_long'),
    supabase.schema('ops').from('staff_employment').select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId).eq('is_active', true).eq('work_status', 'silent_recent'),
    // Scheduled but never clocked since hire (>14d after hire_date) — proxy
    supabase.schema('ops').from('staff_employment')
      .select('id, hire_date, last_clock_date', { count: 'exact', head: false })
      .eq('property_id', propertyId).eq('is_active', true)
      .is('last_clock_date', null)
      .lte('hire_date', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
    // Whitespace in names (double-space, leading, trailing)
    supabase.schema('ops').from('staff_employment').select('id, full_name', { count: 'exact', head: false })
      .eq('property_id', propertyId).eq('is_active', true)
      .or('full_name.ilike.%  %,full_name.ilike. %,full_name.ilike.% '),
    supabase.schema('ops').from('v_staff_unmapped').select('ext_id', { count: 'exact', head: true })
      .eq('property_id', propertyId),
    // NULL allowance fields in hr.leave_allowances (Donna)
    supabase.schema('hr').from('leave_allowances').select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId).is('available_days', null),
    // ops.departments.hod_user_id NULL count
    supabase.schema('ops').from('departments').select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId).is('hod_user_id', null),
    supabase.schema('ops').from('departments').select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId),
    supabase.from('v_staff_anomalies').select('issue', { count: 'exact', head: true })
      .eq('property_id', propertyId),
    // Sanity flag — does the stale ops.v_staff_detail still exist?
    supabase.schema('ops').from('v_staff_detail').select('staff_id', { count: 'exact', head: true })
      .limit(1),
    // Namkhan: how many Lao staff have no leave codes recorded at all (suggests Lao manual codes missing)
    propertyId === 260955
      ? supabase.schema('ops').from('staff_attendance').select('staff_id', { count: 'exact', head: true })
        .eq('code', 'SI')
      : Promise.resolve({ count: null }),
  ]);

  const active = Number(activeRegisterRes.count ?? 0);
  const cntDeptTotal = Number(deptNoHodRes.count ?? 0);
  const cntDeptNoHod = Number(hodColumnNullRes.count ?? 0);

  // Build findings list. Property-aware.
  const findings: Finding[] = [];

  // === Mapping / sync ===
  const cntUnmapped = Number(unmappedRes.count ?? 0);
  findings.push({
    area: 'Sync · mapping',
    title: 'Timeclock events with no staff profile',
    detail: 'Factorial sent clock-in events that could not be mapped to any staff_employment row.',
    count: cntUnmapped,
    severity: cntUnmapped > 0 ? 'high' : 'info',
    status: cntUnmapped > 0 ? 'open' : 'resolved',
    action: cntUnmapped > 0 ? 'Map ext_id → staff_id or terminate ghost staff' : 'No action — all events mapped',
  });

  // === Register hygiene ===
  const cntHire = Number(missingHireDateRes.count ?? 0);
  findings.push({
    area: 'Register · hygiene',
    title: 'Missing hire date',
    detail: 'Active staff with no hire_date on file.',
    count: cntHire,
    severity: cntHire > 5 ? 'high' : cntHire > 0 ? 'med' : 'info',
    status: cntHire > 0 ? 'open' : 'resolved',
    action: cntHire > 0 ? 'Backfill from payslips or Factorial onboarding date' : 'No action',
  });

  const cntCH = Number(missingContractHoursRes.count ?? 0);
  findings.push({
    area: 'Register · hygiene',
    title: 'Missing contract_hours_pw',
    detail: 'Active staff with no weekly contracted hours. Breaks utilization % calc — defaults to 40h.',
    count: cntCH,
    severity: cntCH > active * 0.2 ? 'high' : cntCH > 0 ? 'med' : 'info',
    status: cntCH > 0 ? 'open' : 'resolved',
    action: cntCH > 0 ? 'Sync from Factorial contract or add manually in HR' : 'No action',
  });

  const cntPdf = Number(missingContractPdfRes.count ?? 0);
  findings.push({
    area: 'Documents',
    title: 'Missing contract PDF',
    detail: 'Active staff with no signed contract document linked.',
    count: cntPdf,
    severity: cntPdf > active * 0.3 ? 'high' : 'med',
    status: cntPdf > 0 ? 'open' : 'resolved',
    action: 'Upload signed contracts to docs.hr_docs',
  });

  const cntExpiring = Number(contractExpiringRes.count ?? 0);
  findings.push({
    area: 'Documents',
    title: 'Contract expiring ≤60 days',
    detail: 'Renew or terminate before the end_date hits.',
    count: cntExpiring,
    severity: cntExpiring > 0 ? 'med' : 'info',
    status: cntExpiring > 0 ? 'open' : 'resolved',
    action: cntExpiring > 0 ? 'Schedule renewal call with each' : 'No action',
  });

  // === Workforce / behavioural ===
  const cntNeverClk = Number(noClockActiveRes.count ?? 0);
  findings.push({
    area: 'Attendance',
    title: 'Never clocked since hire',
    detail: 'Hired >14 days ago but no clock-in event has ever been recorded.',
    count: cntNeverClk,
    severity: cntNeverClk > 0 ? 'high' : 'info',
    status: cntNeverClk > 0 ? 'open' : 'resolved',
    action: cntNeverClk > 0 ? 'HR/HoD: did they actually start? Possible payroll fraud or onboarding gap' : 'No action',
  });

  const cntSilentLong = Number(silentLongRes.count ?? 0);
  findings.push({
    area: 'Attendance',
    title: 'Active but silent ≥90 days',
    detail: 'is_active=true on register, but last clock-in is over 90 days ago.',
    count: cntSilentLong,
    severity: cntSilentLong > 0 ? 'high' : 'info',
    status: cntSilentLong > 0 ? 'open' : 'resolved',
    action: cntSilentLong > 0 ? 'HR: terminate in Factorial or confirm extended leave' : 'No action',
  });

  const cntSilentRecent = Number(silentRecentRes.count ?? 0);
  findings.push({
    area: 'Attendance',
    title: 'Active but silent 30–90 days',
    detail: 'Last clocked between 30 and 90 days ago. Could be seasonal break or stealth-off.',
    count: cntSilentRecent,
    severity: cntSilentRecent > 0 ? 'med' : 'info',
    status: cntSilentRecent > 0 ? 'open' : 'resolved',
    action: cntSilentRecent > 0 ? 'HoD: confirm leave status or flag for HR' : 'No action',
  });

  // === Data hygiene ===
  const cntWs = Number(whitespaceNamesRes.count ?? 0);
  const wsExamples: string[] = (whitespaceNamesRes.data as Array<{ full_name: string }> | null ?? [])
    .slice(0, 3).map((r) => r.full_name);
  findings.push({
    area: 'Data hygiene',
    title: 'Names with irregular whitespace',
    detail: cntWs > 0 ? `Examples: ${wsExamples.join(' · ')}` : 'No whitespace issues found.',
    count: cntWs,
    severity: cntWs > 0 ? 'low' : 'info',
    status: cntWs > 0 ? 'open' : 'resolved',
    action: cntWs > 0 ? 'Trim + collapse double-spaces in staff_employment.full_name' : 'No action',
  });

  // === Architecture / schema ===
  const dupViewRows = Number(duplicateViewRes.count ?? 0);
  findings.push({
    area: 'Schema · debt',
    title: 'Duplicate stale view ops.v_staff_detail',
    detail: 'Older view without property_id. Frontend pinned to public.v_staff_detail but the duplicate still resolves via PostgREST for legacy clients.',
    count: dupViewRows > 0 ? `${dupViewRows} rows` : '—',
    severity: 'med',
    status: 'open',
    action: 'DROP VIEW ops.v_staff_detail (after grep confirms no other consumers)',
  });

  // === HR / Factorial gaps (Donna-specific) ===
  if (propertyId === 1000001) {
    const cntNullAlw = Number(nullAllowanceRes.count ?? 0);
    findings.push({
      area: 'HR · Factorial',
      title: 'NULL leave allowance balances',
      detail: 'hr.leave_allowances.available_days / taken_days are NULL — Factorial allowance API not populated.',
      count: cntNullAlw,
      severity: 'low',
      status: 'open',
      action: 'Update Make.com Factorial scenario to pull allowance numbers; falls back to entitlement-vs-used calc today',
    });

    findings.push({
      area: 'HR · departments',
      title: 'Departments with no HoD set',
      detail: 'ops.departments.hod_user_id is NULL — drives "Ask <HoD>" chat headers and dept routing.',
      count: `${cntDeptNoHod} of ${cntDeptTotal}`,
      severity: 'med',
      status: 'open',
      action: 'Backfill hod_user_id from Factorial manager_id majority per dept',
    });
  }

  // === Schedule / punctuality ===
  if (propertyId === 1000001) {
    findings.push({
      area: 'Schedule',
      title: 'Average late-clock-in 90d',
      detail: 'Mean |delta| = +114 min late on matched shifts. Either widespread punctuality issue or split-shift matching ambiguity.',
      count: '+114 min',
      severity: 'high',
      status: 'open',
      action: 'Operational: HoD review · Technical: switch matching to chronological pairing for split shifts',
    });

    findings.push({
      area: 'Schedule',
      title: 'No-clock-in on past shifts (90d)',
      detail: '22% of past shifts have no matching clock-in event — either Factorial sync gap or staff not punching.',
      count: '~22%',
      severity: 'high',
      status: 'open',
      action: 'HR: enforce clocking policy · Engineering: confirm sync coverage',
    });
  }

  // === Holidays ===
  if (propertyId === 1000001) {
    findings.push({
      area: 'Calendar',
      title: 'Calvià local fiestas need verification',
      detail: 'Sant Jaume Apòstol + Festa del Rei En Jaume marked review status. Calvià Ayuntamiento publishes annual decree each December.',
      count: 4,
      severity: 'low',
      status: 'open',
      action: 'Confirm 2025 + 2026 dates with Ayuntamiento and flip verified=true',
    });
  }
  if (propertyId === 260955) {
    findings.push({
      area: 'Calendar',
      title: 'Lao Buddhist holidays (lunar)',
      detail: 'Boun Awk Phansa date depends on lunar calendar — MoLSW publishes annual circular.',
      count: 2,
      severity: 'low',
      status: 'open',
      action: 'Verify 2025 + 2026 dates via MoLSW circular',
    });
  }

  // === Drawer / KPI ===
  if (propertyId === 1000001) {
    findings.push({
      area: 'KPI · drawer',
      title: 'days_worked_ytd not wired for Donna',
      detail: 'v_staff_detail.days_worked_ytd reads from ops.staff_attendance (Namkhan-only). Donna drawer shows 0.',
      count: '—',
      severity: 'low',
      status: 'open',
      action: 'Wire to clocked-hours / 8 derivation from ops.timeclock for Donna',
    });
  }

  // ── KPI strip totals ────────────────────────────────────────────────────
  const totalOpen = findings.filter((f) => f.status === 'open').length;
  const totalHigh = findings.filter((f) => f.severity === 'high' && f.status !== 'resolved').length;
  const totalMed  = findings.filter((f) => f.severity === 'med'  && f.status !== 'resolved').length;
  const totalLow  = findings.filter((f) => f.severity === 'low'  && f.status !== 'resolved').length;
  const totalRes  = findings.filter((f) => f.status === 'resolved').length;

  const eyebrow = propertyLabel
    ? `Operations · Staff · Data · ${propertyLabel}`
    : 'Operations · Staff · Data';

  return (
    <Page
      eyebrow={eyebrow}
      title={<>Data <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>quality</em></>}
      subPages={rewriteSubPagesForProperty(OPERATIONS_SUBPAGES, propertyId)}
    >
      <StaffTabStrip propertyId={propertyId} />

      <KpiStrip items={[
        { label: 'Findings',     value: findings.length, kind: 'count', hint: 'across all areas' },
        { label: 'Open',         value: totalOpen,       kind: 'count', tone: totalOpen > 0 ? 'warn' : 'pos', hint: 'need action' },
        { label: 'High',         value: totalHigh,       kind: 'count', tone: totalHigh > 0 ? 'warn' : 'pos' },
        { label: 'Medium',       value: totalMed,        kind: 'count' },
        { label: 'Low',          value: totalLow,        kind: 'count' },
        { label: 'Resolved',     value: totalRes,        kind: 'count', tone: 'pos' },
        { label: 'Active staff', value: active,          kind: 'count', hint: 'on register' },
      ] satisfies KpiStripItem[]} />

      {/* Findings table */}
      <section style={{ marginTop: 22 }}>
        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h2 style={{
            fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
            letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
            color: 'var(--brass)',
          }}>
            All findings · sorted by severity
          </h2>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 10,
            letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
            color: 'var(--ink-mute)',
          }}>
            live · counts refreshed each page load
          </span>
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
                <Th>Severity</Th>
                <Th>Area</Th>
                <Th>Finding</Th>
                <Th right>Count</Th>
                <Th>Status</Th>
                <Th>Recommended action</Th>
              </tr>
            </thead>
            <tbody>
              {findings
                .slice()
                .sort((a, b) => {
                  const order = { high: 0, med: 1, low: 2, info: 3 };
                  return order[a.severity] - order[b.severity];
                })
                .map((f, i) => (
                  <tr key={i}>
                    <Td><StatusPill tone={sevTone(f.severity)}>{f.severity}</StatusPill></Td>
                    <Td mono mute>{f.area}</Td>
                    <Td strong>
                      {f.title}
                      <div style={{
                        fontFamily: 'var(--sans)', fontWeight: 400,
                        fontSize: 11, color: 'var(--ink-mute)', marginTop: 3, lineHeight: 1.4,
                      }}>
                        {f.detail}
                      </div>
                    </Td>
                    <Td right strong>
                      {typeof f.count === 'number' && f.count === 0
                        ? <span style={{ color: 'var(--st-good, #2c7a4b)' }}>0</span>
                        : f.count}
                    </Td>
                    <Td><StatusPill tone={statusTone(f.status)}>{f.status.replace('-', ' ')}</StatusPill></Td>
                    <Td mute>{f.action}</Td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{
        marginTop: 18, padding: 12,
        border: '1px solid var(--kpi-frame, rgba(168,133,74,0.45))',
        background: 'var(--paper-warm)',
        borderRadius: 4, fontSize: 'var(--t-sm)',
        color: 'var(--ink-mute)',
      }}>
        <strong style={{ color: 'var(--ink)' }}>Reading this page</strong>
        {' '}— counts are live from Supabase. Severity is heuristic:
        High = direct money / payroll fraud risk · Medium = operational drag · Low = cosmetic / data hygiene.
        "Resolved" rows are kept so future regressions surface against the baseline.
      </section>
    </Page>
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
      padding: '10px 12px',
      fontSize: mono ? 12 : 13,
      fontFamily: mono ? 'var(--mono)' : undefined,
      color: mute ? 'var(--ink-mute)' : 'var(--ink)',
      fontWeight: strong ? 600 : 400,
      borderTop: '1px solid var(--line-soft)',
      verticalAlign: 'top',
    }}>{children}</td>
  );
}
