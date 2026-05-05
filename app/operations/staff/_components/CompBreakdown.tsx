// app/operations/staff/_components/CompBreakdown.tsx
// Compensation breakdown for the most recent payroll period.
// Two columns — Earnings (gross) and Deductions — with totals + Net.
// Format: USD primary, LAK in small parens.
//
// Source: ops.payroll_monthly via v_staff_detail.payroll_12m[0].

import UsdLak from './UsdLak';
import type { PayrollRow } from '../[staffId]/page';

interface Props {
  /** The most recent payroll row, if any. */
  row: PayrollRow | null;
}

function periodLabel(iso: string | null): string {
  if (!iso) return '—';
  const [y, m] = iso.split('-').map(Number);
  const monthName = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1];
  return `${monthName} ${y}`;
}

export default function CompBreakdown({ row }: Props) {
  if (!row) {
    return (
      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--ink-mute)', fontSize: 'var(--t-sm)' }}>
        No payroll has been calculated yet for this employee.
      </div>
    );
  }

  const fx = Number(row.fx_lak_usd) > 0 ? Number(row.fx_lak_usd) : 21500;

  const base = Number(row.base_salary_lak ?? 0);
  const ot15 = Number(row.overtime_15x_lak ?? 0);
  const ot2  = Number(row.overtime_2x_lak ?? 0);
  const sc   = Number(row.service_charge_lak ?? 0);
  const gas  = Number(row.gasoline_allow_lak ?? 0);
  const net  = Number(row.internet_allow_lak ?? 0);
  const oth  = Number(row.other_allow_lak ?? 0);
  const adj  = Number(row.adjustment_lak ?? 0);
  const ded  = Number(row.deduction_lak ?? 0);
  const sso  = Number(row.sso_5_5_lak ?? 0);
  const tax  = Number(row.tax_lak ?? 0);

  const grossLak = base + ot15 + ot2 + sc + gas + net + oth;
  const benefitsLak = sc + gas + net + oth; // pooled tip + transport + comms + other
  const deductionsLak = sso + tax + ded - adj;
  // Canonical net comes straight from the view (always = earnings − deductions),
  // backed by a BEFORE INSERT/UPDATE trigger so the source can never drift again.
  const netLak = Number((row as any).canonical_net_lak ?? (grossLak + adj - sso - tax - ded));
  const netUsd = Number((row as any).canonical_net_usd ?? (netLak / (fx || 1)));
  const costLak = Number((row as any).canonical_cost_lak ?? grossLak);
  const costUsd = Number((row as any).canonical_cost_usd ?? (costLak / (fx || 1)));

  type Line = { label: string; lak: number; tone?: 'default' | 'pos' | 'neg' | 'mute' };

  const earnings: Line[] = [
    { label: 'Base salary',       lak: base },
    { label: 'Overtime 1.5×',     lak: ot15 },
    { label: 'Overtime 2.0×',     lak: ot2 },
    { label: 'Service charge',    lak: sc, tone: 'pos' },
    { label: 'Gasoline allowance', lak: gas, tone: 'pos' },
    { label: 'Internet allowance', lak: net, tone: 'pos' },
    { label: 'Other allowances',  lak: oth, tone: 'pos' },
  ];

  const deductions: Line[] = [
    { label: 'SSO (5.5%)',        lak: sso, tone: 'neg' },
    { label: 'Income tax',        lak: tax, tone: 'neg' },
    { label: 'Special deduction', lak: ded, tone: 'neg' },
    { label: 'Adjustment',        lak: -adj, tone: adj < 0 ? 'neg' : 'pos' },
  ];

  return (
    <div>
      <div style={{
        fontFamily: 'var(--mono)',
        fontSize: 'var(--t-xs)',
        textTransform: 'uppercase',
        letterSpacing: 'var(--ls-extra)',
        color: 'var(--ink-mute)',
        marginBottom: 12,
      }}>
        Period · {periodLabel(row.period_month)} · FX ₭{fx.toLocaleString()} per $
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* EARNINGS */}
        <Section title="Earnings" totalLabel="Gross" totalLak={grossLak} fx={fx} tone="pos">
          {earnings.map((ln) => (
            <Line key={ln.label} label={ln.label} lak={ln.lak} fx={fx} tone={ln.tone} />
          ))}
          {benefitsLak > 0 && (
            <Subtotal label="of which benefits" lak={benefitsLak} fx={fx} />
          )}
        </Section>

        {/* DEDUCTIONS */}
        <Section title="Deductions" totalLabel="Total deductions" totalLak={deductionsLak} fx={fx} tone="neg">
          {deductions.map((ln) => (
            <Line key={ln.label} label={ln.label} lak={ln.lak} fx={fx} tone={ln.tone} />
          ))}
        </Section>
      </div>

      {/* NET PAY (employee receives) + COMPANY COST */}
      <div style={{
        marginTop: 16,
        background: 'var(--moss)',
        color: '#f4ecd8',
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}>
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 'var(--t-xs)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--ls-extra)',
            color: '#c4a06b',
          }}>Net pay · employee receives</span>
          <span style={{
            fontFamily: 'var(--serif)',
            fontStyle: 'italic',
            fontSize: 'var(--t-xl)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            ${Math.round(netUsd).toLocaleString('en-US')}
            <span style={{
              fontFamily: 'var(--mono)',
              fontStyle: 'normal',
              fontSize: 'var(--t-xs)',
              marginLeft: 8,
              color: '#c4a06b',
            }}>
              (₭{Math.round(netLak / 1_000_000).toLocaleString()}M)
            </span>
          </span>
        </div>
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid rgba(196,160,107,0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          background: 'rgba(0,0,0,0.15)',
        }}>
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 'var(--t-xs)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--ls-extra)',
            color: '#c4a06b',
            opacity: 0.85,
          }}>Total cost · company pays</span>
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 'var(--t-sm)',
            fontVariantNumeric: 'tabular-nums',
            color: '#f4ecd8',
          }}>
            ${Math.round(costUsd).toLocaleString('en-US')}
            <span style={{ marginLeft: 6, color: '#c4a06b', fontSize: 'var(--t-xs)' }}>
              (₭{Math.round(costLak / 1_000_000).toLocaleString()}M · gross before tax/SSO)
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

function Section({ title, totalLabel, totalLak, fx, tone, children }: {
  title: string;
  totalLabel: string;
  totalLak: number;
  fx: number;
  tone: 'pos' | 'neg';
  children: React.ReactNode;
}) {
  return (
    <div style={{
      background: 'var(--paper)',
      border: '1px solid var(--paper-deep)',
      borderRadius: 8,
      padding: '12px 14px',
    }}>
      <div style={{
        fontFamily: 'var(--mono)',
        fontSize: 'var(--t-xs)',
        textTransform: 'uppercase',
        letterSpacing: 'var(--ls-extra)',
        color: 'var(--brass)',
        marginBottom: 10,
      }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {children}
      </div>
      <div style={{
        marginTop: 10,
        paddingTop: 8,
        borderTop: '1px solid var(--line-soft)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
      }}>
        <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-soft)', fontWeight: 600 }}>
          {totalLabel}
        </span>
        <UsdLak lak={totalLak} fx={fx} bold tone={tone} />
      </div>
    </div>
  );
}

function Line({ label, lak, fx, tone }: { label: string; lak: number; fx: number; tone?: 'default' | 'pos' | 'neg' | 'mute' }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: 12,
      fontSize: 'var(--t-sm)',
    }}>
      <span style={{ color: 'var(--ink-soft)' }}>{label}</span>
      <UsdLak lak={lak} fx={fx} tone={tone} />
    </div>
  );
}

function Subtotal({ label, lak, fx }: { label: string; lak: number; fx: number }) {
  return (
    <div style={{
      marginTop: 4,
      paddingTop: 4,
      borderTop: '1px dashed var(--line-soft)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      fontSize: 'var(--t-xs)',
      color: 'var(--ink-mute)',
      fontStyle: 'italic',
    }}>
      <span>{label}</span>
      <UsdLak lak={lak} fx={fx} tone="mute" />
    </div>
  );
}
