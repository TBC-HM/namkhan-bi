'use client';

// app/operations/staff/_components/StaffDrawer.tsx
// PBS 2026-05-09: staff detail slides in from the right (mirrors guest
// directory ProfileDrawer pattern). Loads on demand via fetchStaffDetail.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fmtMoney, FX_LAK_PER_USD } from '@/lib/format';
import { fetchStaffDetail, type StaffDetail } from '../_actions/fetchStaffDetail';

interface Props {
  staffId: string | null;
  onClose: () => void;
}

export function StaffDrawer({ staffId, onClose }: Props) {
  const [detail, setDetail] = useState<StaffDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!staffId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchStaffDetail(staffId)
      .then((d) => { if (!cancelled) setDetail(d); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [staffId]);

  if (!staffId) return null;

  return (
    <>
      <div onClick={onClose} style={S.scrim} />
      <aside style={S.drawer}>
        <header style={S.header}>
          <button onClick={onClose} style={S.close} aria-label="Close drawer">✕</button>
          <div style={{ flex: 1 }}>
            <div style={S.eyebrow}>Operations · Staff</div>
            <h2 style={S.title}>{detail?.full_name ?? '—'}</h2>
            <div style={S.sub}>
              {detail?.position_title ?? '—'} · {detail?.dept_name ?? '—'}{' '}
              {detail?.is_active === false && <span style={S.badgeArchived}>archived</span>}
            </div>
          </div>
        </header>

        <div style={S.body}>
          {loading && <div style={S.muted}>Loading…</div>}
          {!loading && !detail && <div style={S.muted}>No detail found for #{staffId}.</div>}
          {!loading && detail && (
            <>
              <section style={S.section}>
                <div style={S.sectionTitle}>Identity</div>
                <Field label="Employee ID"     value={detail.emp_id} mono />
                <Field label="Employment type" value={detail.employment_type} />
                <Field label="Hire date"       value={detail.hire_date ?? '—'} mono />
                <Field label="End date"        value={detail.end_date ?? '—'} mono />
                <Field label="Tenure"          value={detail.tenure_years != null ? `${detail.tenure_years.toFixed(1)} yr` : '—'} />
                <Field label="Contract hours"  value={detail.contract_hours_pw != null ? `${detail.contract_hours_pw}/wk` : '—'} />
              </section>

              <section style={S.section}>
                <div style={S.sectionTitle}>Compensation</div>
                <Field label="Monthly base" value={fmtMoney(detail.monthly_salary, (detail.salary_currency as 'LAK' | 'USD') ?? 'LAK')} mono />
                <Field label="Hourly cost"  value={fmtMoney(detail.hourly_cost_lak, 'LAK')} mono />
                <Field label="Last payroll" value={detail.last_payroll_period ?? '—'} mono />
                <Field label="Last paid USD" value={detail.last_payroll_total_usd != null ? `$${Math.round(detail.last_payroll_total_usd).toLocaleString()}` : '—'} mono />
                <Field label="Days worked"  value={detail.last_payroll_days_worked != null ? String(detail.last_payroll_days_worked) : '—'} />
              </section>

              <section style={S.section}>
                <div style={S.sectionTitle}>Documents</div>
                <Field label="Contract"   value={detail.contract_doc_id ? '✓ uploaded' : '— missing'} mono />
                <Field label="Payslip"    value={detail.payslip_pdf_status ?? 'never'} mono />
                <Field label="Last slip"  value={detail.last_payslip_period ?? '—'} mono />
              </section>

              {detail.skills && detail.skills.length > 0 && (
                <section style={S.section}>
                  <div style={S.sectionTitle}>Skills</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {detail.skills.map((s) => (
                      <span key={s} style={S.chip}>{s}</span>
                    ))}
                  </div>
                </section>
              )}

              {detail.dq_flags && detail.dq_flags.length > 0 && (
                <section style={S.section}>
                  <div style={{ ...S.sectionTitle, color: '#ff8a8a' }}>Data quality flags</div>
                  <ul style={{ margin: 0, paddingLeft: 18, color: '#ff8a8a', fontSize: 12 }}>
                    {detail.dq_flags.map((f) => <li key={f}>{f}</li>)}
                  </ul>
                </section>
              )}

              <section style={S.section}>
                <Link href={`/operations/staff/${encodeURIComponent(staffId)}`} style={S.fullLink}>
                  Open full profile · payroll history · attendance · availability →
                </Link>
              </section>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={S.field}>
      <span style={S.fieldLabel}>{label}</span>
      <span style={{ ...S.fieldValue, fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined }}>{value}</span>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  scrim: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    zIndex: 9000, backdropFilter: 'blur(2px)',
  },
  drawer: {
    position: 'fixed', top: 0, right: 0, bottom: 0,
    width: 'min(520px, 100vw)',
    background: '#0e0e0c',
    color: '#e9e1ce',
    borderLeft: '1px solid #2a2520',
    boxShadow: '-12px 0 40px rgba(0,0,0,0.55)',
    zIndex: 9001,
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    padding: '16px 18px',
    borderBottom: '1px solid #2a2520',
  },
  close: {
    background: 'transparent', border: '1px solid #2a2520',
    color: '#d8cca8', cursor: 'pointer',
    width: 28, height: 28, borderRadius: 4,
    fontSize: 14, lineHeight: 1,
  },
  eyebrow: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
    color: '#a8854a', marginBottom: 4,
  },
  title: {
    fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic',
    fontSize: 24, fontWeight: 400, margin: 0, color: '#e9e1ce',
  },
  sub: { fontSize: 12, color: '#9b907a', marginTop: 4 },
  badgeArchived: {
    background: '#2a261d', color: '#ff8a8a',
    padding: '1px 6px', borderRadius: 3, marginLeft: 6,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 9, textTransform: 'uppercase',
  },
  body: { flex: 1, overflowY: 'auto', padding: 18 },
  muted: { color: '#7d7565', fontStyle: 'italic', textAlign: 'center', padding: 24 },
  section: {
    marginBottom: 18, paddingBottom: 14,
    borderBottom: '1px solid #1f1c15',
  },
  sectionTitle: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
    color: '#a8854a', marginBottom: 8,
  },
  field: { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, padding: '3px 0' },
  fieldLabel: { color: '#7d7565' },
  fieldValue: { color: '#e9e1ce' },
  chip: {
    background: '#1a1812', border: '1px solid #2a2520',
    padding: '2px 8px', borderRadius: 4,
    fontSize: 11, color: '#d8cca8',
  },
  fullLink: { color: '#d9bf8e', fontSize: 12, fontWeight: 600, textDecoration: 'none' },
};
