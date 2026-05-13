// app/operations/staff/_components/StaffDetailContent.tsx
// PBS 2026-05-13 — canonical full-profile page, dual-property.
//
// Shared between:
//   /operations/staff/[staffId]                  → Namkhan
//   /h/[property_id]/operations/staff/[staffId]  → property-scoped
//
// Pulls v_staff_detail + extra-pay aggregates + last-raise + attendance score.
// Renders: header hero, KPI strip, payslip breakdown, attendance, payroll
// history, availability, documents, skills editor.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchStaffDetail } from '../_actions/fetchStaffDetail';
import { AttendanceCalendar } from './AttendanceCalendar';
import { PayrollHistory } from './PayrollHistory';
import { AvailabilityGrid } from './AvailabilityGrid';
import { DqStrip } from './DqStrip';
import CompBreakdown from './CompBreakdown';
import YtdSummary from './YtdSummary';
import { SkillsEditor } from './SkillsEditor';
import KpiStrip, { type KpiStripItem } from '@/components/kpi/KpiStrip';
import Page from '@/components/page/Page';
import NativeAmount from './NativeAmount';
import { OPERATIONS_SUBPAGES } from '../../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';

const SYM: Record<string, string> = { USD: '$', EUR: '€', LAK: '₭' };

function fmtNative(n: number | null | undefined, ccy: string): string {
  if (n == null || n === 0) return '—';
  const abs = Math.abs(n);
  const sym = SYM[ccy] ?? '$';
  if (ccy === 'LAK') {
    if (abs >= 1_000_000_000) return `${sym}${(abs / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `${sym}${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sym}${Math.round(abs / 1_000)}k`;
    return `${sym}${Math.round(abs)}`;
  }
  if (abs >= 1_000_000) return `${sym}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sym}${(abs / 1_000).toFixed(1)}k`;
  return `${sym}${Math.round(abs).toLocaleString('en-US')}`;
}

export default async function StaffDetailContent({
  staffId,
  propertyId,
  propertyLabel,
}: {
  staffId: string;
  propertyId: number;
  propertyLabel?: string;
}) {
  const d = await fetchStaffDetail(staffId);
  if (!d) return notFound();

  const ccy = (d.salary_currency ?? 'LAK').toUpperCase();
  const fx = ccy === 'EUR' ? 1.08 : ccy === 'LAK' ? 1 / 21800 : 1; // unit → USD
  const monthlyUsd = Number(d.monthly_salary || 0) * fx;
  const annualNative = Number(d.monthly_salary || 0) * 12;

  const backHref = propertyId === 260955
    ? '/operations/staff'
    : `/h/${propertyId}/operations/staff`;

  return (
    <Page
      eyebrow={
        propertyLabel
          ? `Operations · Staff · ${propertyLabel} · ${d.emp_id}`
          : `Operations · Staff · ${d.emp_id}`
      }
      title={
        <>
          {d.full_name}{' '}
          <em style={{ color: 'var(--brass)', fontStyle: 'italic', fontSize: '0.6em' }}>
            · {d.position_title}
          </em>
        </>
      }
      subPages={rewriteSubPagesForProperty(OPERATIONS_SUBPAGES, propertyId)}
    >
      {/* Breadcrumb */}
      <nav style={{
        fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 12,
      }}>
        <Link href={backHref} style={{ color: 'var(--brass)', textDecoration: 'none' }}>
          ← Staff register
        </Link>
        <span style={{ margin: '0 8px', color: 'var(--ink-faint)' }}>/</span>
        <span style={{ color: 'var(--ink-soft)' }}>{d.emp_id}</span>
        <span style={{ margin: '0 8px', color: 'var(--ink-faint)' }}>·</span>
        <StatusPill active={d.is_active} />
        <span style={{ margin: '0 8px', color: 'var(--ink-faint)' }}>·</span>
        <span style={{
          padding: '2px 8px', borderRadius: 3, border: '1px solid var(--kpi-frame)',
          background: 'var(--paper-deep)', color: 'var(--ink)',
        }}>
          {d.employment_type}
        </span>
      </nav>

      {/* DQ flags strip */}
      {d.dq_flags && d.dq_flags.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <DqStrip flags={d.dq_flags} />
        </div>
      )}

      {/* CANONICAL KPI STRIP */}
      <KpiStrip items={[
        { label: `Monthly cost · ${ccy}`, value: fmtNative(d.monthly_salary, ccy), hint: `≈ $${Math.round(monthlyUsd).toLocaleString('en-US')}` },
        { label: `Annual cost · ${ccy}`, value: fmtNative(annualNative, ccy), hint: `≈ $${Math.round(annualNative * fx).toLocaleString('en-US')}` },
        { label: 'Hourly cost · LAK', value: d.hourly_cost_lak ? fmtNative(d.hourly_cost_lak, 'LAK') : '—', hint: d.contract_hours_pw ? `${d.contract_hours_pw} h/wk` : '' },
        { label: 'Tenure', value: d.tenure_years != null ? `${d.tenure_years} yrs` : '—', hint: d.hire_date ?? 'Backfill required' },
        { label: 'Attendance score', value: d.attendance_score ?? 0, kind: 'count', tone: (d.attendance_score ?? 0) >= 80 ? 'pos' : (d.attendance_score ?? 0) >= 50 ? 'warn' : 'neg', hint: '0-100 · 30d' },
        { label: 'Hours · YTD',      value: d.attendance_hours_ytd != null ? `${Math.round(d.attendance_hours_ytd)}h` : '—', hint: 'logged clock-in' },
        { label: 'Service charge · YTD', value: d.service_charge_ytd_lak ? fmtNative(d.service_charge_ytd_lak, 'LAK') : '—', hint: 'F&B tip pool' },
      ] satisfies KpiStripItem[]} />

      {/* TWO-COLUMN BODY */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, marginTop: 20 }}>
        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Year-to-date */}
          <Panel title="Year-to-date" sub="Earnings + days · auto-derived from payroll history">
            <YtdSummary rows={d.payroll_12m ?? []} lastPeriod={d.last_payroll_period} />
          </Panel>

          {/* Last payslip breakdown */}
          <Panel
            title={`Compensation · ${d.last_payroll_period?.slice(0, 7) ?? 'last paid month'}`}
            sub="Earnings + deductions for the most recent payroll row"
          >
            <CompBreakdown row={(d.payroll_12m && d.payroll_12m[0]) || null} />
          </Panel>

          {/* Attendance calendar */}
          <Panel title="Attendance · last 90 days" sub="D = worked · X = day off · AL = annual leave · PH = public holiday">
            <AttendanceCalendar rows={d.attendance_90d ?? []} />
          </Panel>

          {/* Payroll 12m table */}
          <Panel title="Payroll · last 12 months" sub="Source: ops.payroll_monthly">
            <PayrollHistory rows={d.payroll_12m ?? []} />
          </Panel>
        </div>

        {/* RIGHT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Identity */}
          <Panel title="Identity">
            <Row label="Employee ID" value={d.emp_id ?? '—'} mono />
            <Row label="Hire date" value={d.hire_date ?? '—'} mono />
            {d.seniority_date && d.seniority_date !== d.hire_date && (
              <Row label="Seniority date" value={d.seniority_date} mono />
            )}
            <Row label="End date" value={d.end_date ?? '—'} mono />
            <Row label="Contract hours" value={d.contract_hours_pw ? `${d.contract_hours_pw} h/wk` : '—'} />
            {d.date_of_birth && <Row label="Date of birth" value={d.date_of_birth} mono />}
            {d.nationality && <Row label="Nationality" value={d.nationality} />}
            {d.email && (
              <Row label="Email" value={
                <a href={`mailto:${d.email}`} style={{ color: 'var(--brass)' }}>{d.email}</a>
              } />
            )}
            {d.phone_canonical && (
              <Row label="Phone" value={
                <a href={`tel:${d.phone_canonical.replace(/\s+/g, '')}`} style={{ color: 'var(--brass)' }}>{d.phone_canonical}</a>
              } />
            )}
          </Panel>

          {/* Last raise + extra pay */}
          <Panel title="Salary movements">
            {d.last_raise_date ? (
              <>
                <Row label="Last raise" value={
                  <span style={{ color: (d.last_raise_pct ?? 0) >= 0 ? 'var(--st-good)' : 'var(--oxblood-soft)' }}>
                    {(d.last_raise_pct ?? 0) >= 0 ? '+' : ''}{d.last_raise_pct}%
                  </span>
                } mono />
                <Row label="Date" value={d.last_raise_date.slice(0, 7)} mono />
                <Row label="From → to" value={
                  `${fmtNative(d.last_raise_old_lak, ccy)} → ${fmtNative(d.last_raise_new_lak, ccy)}`
                } mono />
              </>
            ) : (
              <Row label="Last raise" value="— none recorded" />
            )}
            {(d.extra_adjustments_pos_ytd ?? 0) > 0 && (
              <Row label="Extra pay · YTD" value={`+${fmtNative(d.extra_adjustments_pos_ytd ?? 0, ccy)}`} mono />
            )}
            {(d.extra_deductions_ytd ?? 0) > 0 && (
              <Row label="Deductions · YTD" value={`−${fmtNative(d.extra_deductions_ytd ?? 0, ccy)}`} mono />
            )}
            {(d.gasoline_ytd_lak ?? 0) > 0 && (
              <Row label="Gasoline · YTD" value={fmtNative(d.gasoline_ytd_lak ?? 0, 'LAK')} mono />
            )}
            {(d.internet_ytd_lak ?? 0) > 0 && (
              <Row label="Internet · YTD" value={fmtNative(d.internet_ytd_lak ?? 0, 'LAK')} mono />
            )}
          </Panel>

          {/* Bank */}
          {(d.bank_name || d.bank_account_no || d.bank_account_name) && (
            <Panel title="Bank">
              <Row label="Bank" value={d.bank_name ?? '—'} />
              <Row label="Account no." value={d.bank_account_no ?? '—'} mono />
              <Row label="Account name" value={d.bank_account_name ?? '—'} />
            </Panel>
          )}

          {/* Availability */}
          <Panel title="Weekly availability" sub="From ops.staff_availability">
            <AvailabilityGrid rows={d.availability ?? []} />
          </Panel>

          {/* Skills with inline editor */}
          <Panel
            title="Skills"
            action={
              <SkillsEditor
                staffId={d.staff_id}
                propertyId={d.property_id ?? propertyId}
                initialSkills={d.skills ?? []}
              />
            }
          >
            {d.skills && d.skills.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {d.skills.map((s) => (
                  <span key={s} style={chip}>{s}</span>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic' }}>
                — no skills tagged · click Edit to add
              </div>
            )}
          </Panel>

          {/* Documents */}
          <Panel title="Documents" sub="HR records linked to this employee">
            <DocRow
              label="Contract"
              ok={!!d.contract_doc_id}
              hint={d.contract_doc_id ? 'On file' : 'Not uploaded — link via docs.hr_docs'}
            />
            <DocRow
              label={`Last payslip${d.last_payslip_period ? ` (${d.last_payslip_period})` : ''}`}
              ok={d.payslip_pdf_status === 'current'}
              hint={
                d.payslip_pdf_status === 'current' ? 'Current month uploaded'
                : d.payslip_pdf_status === 'overdue' ? 'Overdue — upload to docs.hr_docs'
                : 'No payslip PDF on file'
              }
            />
            <DocRow
              label={`Last calculated payroll${d.last_payroll_period ? ` (${d.last_payroll_period})` : ''}`}
              ok={!!d.last_payroll_period}
              hint={
                d.last_payroll_period
                  ? `Net total $${Math.round(d.last_payroll_total_usd ?? 0).toLocaleString()} · ${d.last_payroll_days_worked ?? 0} days worked`
                  : 'Not yet run for last closed month'
              }
            />
          </Panel>
        </div>
      </div>
    </Page>
  );
}

// ===== presentational helpers =================================================

function Panel({
  title, sub, action, children,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={{
      borderRadius: 6,
      border: '1px solid var(--kpi-frame)',
      background: 'var(--paper-warm)',
      overflow: 'hidden',
    }}>
      <header style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--line-soft)',
        background: 'var(--paper)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <h3 style={{
            fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
            letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
            color: 'var(--brass)', margin: 0,
          }}>{title}</h3>
          {sub && (
            <p style={{ marginTop: 3, fontSize: 11, color: 'var(--ink-mute)' }}>{sub}</p>
          )}
        </div>
        {action}
      </header>
      <div style={{ padding: 14 }}>{children}</div>
    </section>
  );
}

function Row({
  label, value, mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12,
      padding: '4px 0', fontSize: 12,
    }}>
      <span style={{ color: 'var(--ink-mute)' }}>{label}</span>
      <span style={{
        color: 'var(--ink)',
        fontFamily: mono ? 'var(--mono)' : undefined,
        textAlign: 'right',
      }}>{value}</span>
    </div>
  );
}

const chip: React.CSSProperties = {
  background: 'var(--paper-deep)',
  color: 'var(--ink)',
  border: '1px solid var(--kpi-frame)',
  padding: '3px 8px',
  borderRadius: 4,
  fontSize: 11,
  fontFamily: 'var(--mono)',
  letterSpacing: '0.06em',
};

function StatusPill({ active }: { active: boolean }) {
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 3,
      background: active ? 'rgba(107,147,121,0.18)' : 'var(--paper-deep)',
      color: active ? 'var(--st-good, #2c7a4b)' : 'var(--ink-mute)',
      border: '1px solid var(--kpi-frame)',
      fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em',
      textTransform: 'uppercase', fontWeight: 600,
    }}>{active ? 'Active' : 'Archived'}</span>
  );
}

function DocRow({ label, ok, hint }: { label: string; ok: boolean; hint: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: 12, padding: '6px 0',
      borderBottom: '1px solid var(--line-soft)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: 'var(--ink)', fontWeight: 500, fontSize: 13, margin: 0 }}>{label}</p>
        <p style={{ color: 'var(--ink-mute)', fontSize: 11, margin: '2px 0 0' }}>{hint}</p>
      </div>
      <span style={{
        marginTop: 6, width: 8, height: 8, borderRadius: '50%',
        background: ok ? 'var(--st-good, #2c7a4b)' : 'var(--ink-faint)',
        flexShrink: 0,
      }} />
    </div>
  );
}
