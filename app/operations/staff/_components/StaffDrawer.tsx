'use client';

// app/operations/staff/_components/StaffDrawer.tsx
// PBS 2026-05-13 — redesigned slide-in. Canonical for both properties.
//
// Layout (top → bottom):
//   1. HEADER     — photo/avatar · name · position · dept · status badge · close
//   2. CONTACT    — phone (tap to call/WhatsApp) · email (mailto) · bank
//   3. IDENTITY   — emp_id · type · hire/seniority · tenure · DOB · contract hrs
//   4. COMPENSATION — monthly base · hourly · last payroll · last raise (stub)
//   5. DOCUMENTS  — contract · payslip · last slip
//   6. LEAVE      — AL used · AL open · public holidays · sick · days worked YTD
//   7. EVALUATION — quality block, stub for now (no data tracked yet)
//   8. ACTIONS    — mark repeat · contact · full profile

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchStaffDetail, type StaffDetail } from '../_actions/fetchStaffDetail';

const ANNUAL_LEAVE_ENTITLEMENT = 30; // Spain default; Laos varies — config later

// Native-currency formatter — handles EUR (Donna), LAK (Namkhan), USD (default).
// Replaces fmtMoney which only supports LAK/USD.
function fmtNative(n: number | null | undefined, ccy: string | null | undefined): string {
  if (n == null || n === 0) return '—';
  const c = (ccy ?? 'LAK').toUpperCase();
  if (c === 'EUR') {
    if (Math.abs(n) >= 1000) return `€${(n / 1000).toFixed(1)}k`;
    return `€${Math.round(n).toLocaleString('de-DE')}`;
  }
  if (c === 'USD') {
    if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
    return `$${Math.round(n).toLocaleString('en-US')}`;
  }
  // LAK
  if (Math.abs(n) >= 1_000_000_000) return `₭${(n / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000) return `₭${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `₭${Math.round(n / 1000).toLocaleString('en-US')}k`;
  return `₭${Math.round(n).toLocaleString('en-US')}`;
}

interface Props {
  staffId: string | null;
  onClose: () => void;
}

export function StaffDrawer({ staffId, onClose }: Props) {
  const [detail, setDetail] = useState<StaffDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  if (!staffId) return null;

  return (
    <>
      <div onClick={onClose} style={S.scrim} />
      <aside style={S.drawer} role="dialog" aria-label="Staff profile">
        {loading && <div style={S.muted}>Loading…</div>}
        {!loading && !detail && <div style={S.muted}>No detail found for #{staffId}.</div>}
        {!loading && detail && (
          <>
            {/* 1. HEADER */}
            <Header detail={detail} onClose={onClose} />
            {/* 2. CONTACT */}
            <ContactStrip detail={detail} onToast={setToast} />

            <div style={S.body}>
              {/* 3. IDENTITY */}
              <Section title="Identity">
                <Field label="Employee ID"     value={detail.emp_id ?? '—'} mono />
                <Field label="Employment type" value={detail.employment_type ?? '—'} />
                <Field label="Hire date"       value={detail.hire_date ?? '—'} mono />
                {detail.seniority_date && detail.seniority_date !== detail.hire_date && (
                  <Field label="Seniority date" value={detail.seniority_date} mono />
                )}
                <Field label="Tenure"          value={detail.tenure_years != null ? `${detail.tenure_years.toFixed(1)} yr` : '—'} />
                <Field label="Contract hours"  value={detail.contract_hours_pw != null ? `${detail.contract_hours_pw} h/wk` : '—'} />
                {detail.date_of_birth && (
                  <Field label="Date of birth" value={detail.date_of_birth} mono />
                )}
                {detail.nationality && (
                  <Field label="Nationality" value={detail.nationality} />
                )}
                {detail.end_date && (
                  <Field label="End date" value={detail.end_date} mono />
                )}
              </Section>

              {/* 4. COMPENSATION */}
              <Section title="Compensation">
                <Field
                  label={`Monthly base${detail.salary_currency ? ' · ' + detail.salary_currency : ''}`}
                  value={fmtNative(detail.monthly_salary, detail.salary_currency)}
                  mono
                />
                <Field
                  label="Hourly cost"
                  value={detail.hourly_cost_lak ? fmtNative(detail.hourly_cost_lak, 'LAK') : '—'}
                  mono
                  hint={detail.hourly_cost_lak ? undefined : (detail.salary_currency === 'EUR' ? 'derived from monthly · not tracked' : undefined)}
                />
                <Field label="Last payroll" value={detail.last_payroll_period ?? '—'} mono />
                <Field label="Last paid USD" value={detail.last_payroll_total_usd != null ? `$${Math.round(detail.last_payroll_total_usd).toLocaleString()}` : '—'} mono />
                <Field label="Days worked"   value={detail.last_payroll_days_worked != null ? String(detail.last_payroll_days_worked) : '—'} />
                <Field label="Last raise"    value="—" hint="salary-history not tracked yet" />
              </Section>

              {/* 5. DOCUMENTS */}
              <Section title="Documents">
                <Field label="Contract"   value={detail.contract_doc_id ? '✓ uploaded' : '— missing'} mono />
                <Field label="Payslip"    value={detail.payslip_pdf_status ?? 'never'} mono />
                <Field label="Last slip"  value={detail.last_payslip_period ?? '—'} mono />
              </Section>

              {/* 6. LEAVE — sourced from staff_attendance YTD */}
              <Section title="Leave & attendance (YTD)">
                <LeaveGrid detail={detail} />
              </Section>

              {/* 7. EVALUATION & QUALITY — stub block, no source yet */}
              <Section title="Evaluation & quality">
                <EvaluationStub />
              </Section>

              {/* Skills (if any) */}
              {detail.skills && detail.skills.length > 0 && (
                <Section title="Skills">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {detail.skills.map((s) => (
                      <span key={s} style={S.chip}>{s}</span>
                    ))}
                  </div>
                </Section>
              )}

              {/* DQ flags */}
              {detail.dq_flags && detail.dq_flags.length > 0 && (
                <Section title="Data quality flags">
                  <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--oxblood-soft)', fontSize: 12 }}>
                    {detail.dq_flags.map((f) => <li key={f}>{f}</li>)}
                  </ul>
                </Section>
              )}

              <div style={{ paddingTop: 4 }}>
                <Link href={`/operations/staff/${encodeURIComponent(staffId)}`} style={S.fullLink}>
                  Open full profile · payroll history · attendance · availability →
                </Link>
              </div>
            </div>
          </>
        )}
        {toast && (
          <div role="status" aria-live="polite" style={S.toast}>{toast}</div>
        )}
      </aside>
    </>
  );
}

// ===== Header =================================================================

function Header({ detail, onClose }: { detail: StaffDetail; onClose: () => void }) {
  const initials = (detail.full_name || '?')
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((s) => s[0]).join('').toUpperCase();
  return (
    <header style={S.header}>
      <div style={S.avatar}>
        {detail.photo_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={detail.photo_path} alt="" style={S.avatarImg} />
        ) : (
          <span style={S.avatarInitials}>{initials || '?'}</span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={S.eyebrow}>Operations · Staff</div>
        <h2 style={S.title}>{detail.full_name ?? '—'}</h2>
        <div style={S.sub}>
          {detail.position_title ?? '—'} · {detail.dept_name ?? '—'}
          {' '}
          {detail.is_active === false && <span style={S.badgeArchived}>archived</span>}
          {detail.is_active === true && <span style={S.badgeActive}>active</span>}
        </div>
      </div>
      <button onClick={onClose} style={S.close} aria-label="Close drawer">✕</button>
    </header>
  );
}

// ===== Contact strip ==========================================================

function ContactStrip({
  detail,
  onToast,
}: {
  detail: StaffDetail;
  onToast: (msg: string) => void;
}) {
  const email = detail.email || detail.personal_email;
  const phone = detail.phone_canonical || detail.phone;
  const wa = phone && /^\+\d{6,}/.test(phone.replace(/\s+/g, ''))
    ? `https://wa.me/${phone.replace(/\D/g, '')}` : null;

  const handleCopyBank = () => {
    if (!detail.bank_account_no) return;
    navigator.clipboard?.writeText(detail.bank_account_no).then(
      () => onToast('Account number copied'),
      () => onToast('Could not copy')
    );
  };

  return (
    <div style={S.contactStrip}>
      <ContactCell
        label="Phone"
        value={phone}
        href={phone ? (wa ?? `tel:${phone.replace(/\s+/g, '')}`) : undefined}
        target={wa ? '_blank' : undefined}
      />
      <ContactCell
        label="Email"
        value={email}
        href={email ? `mailto:${email}` : undefined}
      />
      <ContactCell
        label="Bank"
        value={detail.bank_name}
        subValue={detail.bank_account_no}
        onClick={detail.bank_account_no ? handleCopyBank : undefined}
        title={detail.bank_account_name ?? undefined}
      />
    </div>
  );
}

function ContactCell({
  label,
  value,
  subValue,
  href,
  target,
  onClick,
  title,
}: {
  label: string;
  value: string | null | undefined;
  subValue?: string | null;
  href?: string;
  target?: string;
  onClick?: () => void;
  title?: string;
}) {
  const filled = value && value.trim() !== '';
  const inner = (
    <>
      <div style={S.contactLabel}>{label}</div>
      <div style={{ ...S.contactValue, color: filled ? 'var(--ink)' : 'var(--ink-faint)' }}>
        {filled ? value : '—'}
      </div>
      {subValue && <div style={S.contactSub}>{subValue}</div>}
    </>
  );
  const style: React.CSSProperties = {
    ...S.contactCell,
    cursor: filled && (href || onClick) ? 'pointer' : 'default',
    opacity: filled ? 1 : 0.6,
  };
  if (href && filled) {
    return (
      <a href={href} target={target} rel={target === '_blank' ? 'noopener noreferrer' : undefined}
         style={{ ...style, textDecoration: 'none' }} title={title}>
        {inner}
      </a>
    );
  }
  if (onClick && filled) {
    return (
      <button onClick={onClick} style={{ ...style, background: 'transparent', border: 'none', textAlign: 'left', width: '100%' }} title={title}>
        {inner}
      </button>
    );
  }
  return <div style={style} title={title}>{inner}</div>;
}

// ===== Leave grid =============================================================

function LeaveGrid({ detail }: { detail: StaffDetail }) {
  const used = detail.annual_leave_used_ytd ?? 0;
  const open = Math.max(0, ANNUAL_LEAVE_ENTITLEMENT - used);
  return (
    <div style={S.leaveGrid}>
      <LeaveTile label="Annual leave used" value={used} unit="d" tone={used > ANNUAL_LEAVE_ENTITLEMENT * 0.8 ? 'warn' : 'neutral'} />
      <LeaveTile label="Open balance" value={open} unit="d" tone="good" hint={`of ${ANNUAL_LEAVE_ENTITLEMENT}d entitlement`} />
      <LeaveTile label="Public holidays" value={detail.public_holiday_ytd ?? 0} unit="d" />
      <LeaveTile label="Sick days" value={detail.sick_days_ytd ?? 0} unit="d" tone={(detail.sick_days_ytd ?? 0) > 10 ? 'warn' : 'neutral'} hint={detail.sick_days_ytd == null ? 'not tracked yet' : undefined} />
      <LeaveTile label="Days worked" value={detail.days_worked_ytd ?? 0} unit="d" />
    </div>
  );
}

function LeaveTile({
  label,
  value,
  unit,
  tone = 'neutral',
  hint,
}: {
  label: string;
  value: number;
  unit?: string;
  tone?: 'good' | 'warn' | 'neutral';
  hint?: string;
}) {
  const color =
    tone === 'good' ? 'var(--st-good, #6b9379)' :
    tone === 'warn' ? 'var(--brass)' :
    'var(--ink)';
  return (
    <div style={S.leaveTile}>
      <div style={S.contactLabel}>{label}</div>
      <div style={{ ...S.leaveValue, color }}>
        {value}
        {unit && <span style={S.leaveUnit}>{unit}</span>}
      </div>
      {hint && <div style={S.contactSub}>{hint}</div>}
    </div>
  );
}

// ===== Evaluation stub ========================================================

function EvaluationStub() {
  return (
    <div style={S.evalBox}>
      <div style={{ fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.5 }}>
        Performance reviews and quality scores are not tracked yet.
        Set up <code style={S.code}>ops.staff_evaluations</code> to record:
      </div>
      <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: 11, color: 'var(--ink-mute)' }}>
        <li>Last review date · score · reviewer</li>
        <li>Quality flags (guest feedback, incidents)</li>
        <li>Next review due</li>
      </ul>
    </div>
  );
}

// ===== Generic atoms ==========================================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={S.section}>
      <div style={S.sectionTitle}>{title}</div>
      {children}
    </section>
  );
}

function Field({ label, value, mono, hint }: { label: string; value: string; mono?: boolean; hint?: string }) {
  return (
    <div style={S.field}>
      <span style={S.fieldLabel}>{label}</span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
        <span style={{ ...S.fieldValue, fontFamily: mono ? 'var(--mono)' : undefined }}>{value}</span>
        {hint && <span style={S.contactSub}>{hint}</span>}
      </span>
    </div>
  );
}

// ===== Styles =================================================================

const S: Record<string, React.CSSProperties> = {
  scrim: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    zIndex: 9000, backdropFilter: 'blur(2px)',
  },
  drawer: {
    /* PBS 2026-05-13 rev4: theme-adaptive. Uses canonical tokens that
     * ThemeInjector overrides per property (Donna = cream, Namkhan = dark). */
    position: 'fixed', top: 0, right: 0, bottom: 0,
    width: 'min(560px, 100vw)',
    background: 'var(--paper)',
    color: 'var(--ink)',
    borderLeft: '1px solid var(--kpi-frame, rgba(168,133,74,0.45))',
    boxShadow: '-12px 0 40px rgba(0,0,0,0.45)',
    zIndex: 9001,
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '18px 20px',
    background: 'var(--paper)',
    borderBottom: '1px solid var(--line)',
  },
  avatar: {
    width: 56, height: 56, borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--brass-soft) 0%, var(--brass) 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, overflow: 'hidden',
    border: '1px solid var(--kpi-frame)',
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarInitials: {
    fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600,
    color: '#1a160f',
  },
  close: {
    background: 'transparent',
    border: '1px solid var(--kpi-frame)',
    color: 'var(--ink-mute)', cursor: 'pointer',
    width: 30, height: 30, borderRadius: 6,
    fontSize: 14, lineHeight: 1, flexShrink: 0,
  },
  eyebrow: {
    fontFamily: 'var(--mono)',
    fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
    color: 'var(--brass)', marginBottom: 4,
  },
  title: {
    fontFamily: 'var(--serif)',
    fontSize: 22, fontWeight: 500, margin: 0, color: 'var(--ink)',
    lineHeight: 1.15,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  sub: {
    fontSize: 12, color: 'var(--ink-mute)', marginTop: 4,
    display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
  },
  badgeArchived: {
    background: 'var(--paper-deep)', color: 'var(--oxblood-soft)',
    padding: '1px 6px', borderRadius: 3,
    fontFamily: 'var(--mono)',
    fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em',
    border: '1px solid var(--kpi-frame)',
  },
  badgeActive: {
    background: 'var(--paper-deep)', color: 'var(--st-good, #2c7a4b)',
    padding: '1px 6px', borderRadius: 3,
    fontFamily: 'var(--mono)',
    fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em',
    border: '1px solid var(--kpi-frame)',
  },
  contactStrip: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1,
    background: 'var(--kpi-frame, rgba(168,133,74,0.45))',
    borderBottom: '1px solid var(--line)',
  },
  contactCell: {
    background: 'var(--paper-warm)',
    padding: '10px 14px',
    display: 'flex', flexDirection: 'column', gap: 2,
    minHeight: 56,
  },
  contactLabel: {
    fontFamily: 'var(--mono)',
    fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase',
    color: 'var(--brass)',
  },
  contactValue: {
    fontFamily: 'var(--sans)',
    fontSize: 13, fontWeight: 500,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  contactSub: {
    fontFamily: 'var(--mono)', fontSize: 10,
    color: 'var(--ink-mute)',
  },
  body: { flex: 1, overflowY: 'auto', padding: '14px 20px 24px' },
  muted: { color: 'var(--ink-mute)', fontStyle: 'italic', textAlign: 'center', padding: 30 },
  section: {
    marginBottom: 16, paddingBottom: 14,
    borderBottom: '1px solid var(--line-soft)',
  },
  sectionTitle: {
    fontFamily: 'var(--mono)',
    fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
    color: 'var(--brass)', marginBottom: 10,
  },
  field: { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, padding: '4px 0' },
  fieldLabel: { color: 'var(--ink-mute)' },
  fieldValue: { color: 'var(--ink)' },
  chip: {
    background: 'var(--paper-deep)', border: '1px solid var(--kpi-frame)',
    padding: '2px 8px', borderRadius: 4,
    fontSize: 11, color: 'var(--ink)',
  },
  leaveGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))', gap: 8,
  },
  leaveTile: {
    background: 'var(--paper-warm)',
    border: '1px solid var(--kpi-frame)',
    borderRadius: 6,
    padding: '10px 12px',
    display: 'flex', flexDirection: 'column', gap: 2,
  },
  leaveValue: {
    fontFamily: 'var(--sans)', fontWeight: 600,
    fontSize: 22, lineHeight: 1.1,
    fontVariantNumeric: 'tabular-nums',
    display: 'flex', alignItems: 'baseline', gap: 3,
  },
  leaveUnit: { fontSize: 11, color: 'var(--ink-mute)', fontWeight: 400 },
  evalBox: {
    background: 'var(--paper-warm)',
    border: '1px dashed var(--kpi-frame)',
    borderRadius: 6,
    padding: '12px 14px',
  },
  code: {
    fontFamily: 'var(--mono)', fontSize: 11,
    background: 'var(--paper-deep)', padding: '1px 5px', borderRadius: 3,
    color: 'var(--brass)',
  },
  fullLink: { color: 'var(--brass)', fontSize: 12, fontWeight: 600, textDecoration: 'none' },
  toast: {
    position: 'absolute', bottom: 14, left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--paper-deep)', border: '1px solid var(--kpi-frame)',
    padding: '6px 12px', borderRadius: 4,
    fontFamily: 'var(--mono)', fontSize: 11,
    color: 'var(--ink)', letterSpacing: '0.12em', textTransform: 'uppercase',
  },
};
