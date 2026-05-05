// app/operations/staff/_components/YtdSummary.tsx
// Year-to-date roll-up across the last-12-months payroll history.
// 6 small tiles: total earned, days worked / off / annual leave / public holiday,
// payslips on record vs expected.
//
// Built so an HR manager can answer "is this person on track?" at a glance.

import UsdLak from './UsdLak';
import type { PayrollRow } from '../[staffId]/page';

interface Props {
  rows: PayrollRow[];
  /** ISO 'YYYY-MM-DD' of last paid period — used to sense YTD denominator. */
  lastPeriod: string | null;
}

export default function YtdSummary({ rows, lastPeriod }: Props) {
  // Filter to current calendar year of lastPeriod
  const year = lastPeriod ? Number(lastPeriod.slice(0, 4)) : new Date().getUTCFullYear();
  const ytd = rows.filter((r) => Number(r.period_month?.slice(0, 4)) === year);

  if (ytd.length === 0) {
    return (
      <div style={{
        padding: '16px',
        textAlign: 'center',
        color: 'var(--ink-mute)',
        fontSize: 'var(--t-sm)',
        background: 'var(--paper-warm)',
        border: '1px dashed var(--paper-deep)',
        borderRadius: 8,
      }}>
        No payroll data for {year} yet.
      </div>
    );
  }

  // Aggregate — prefer canonical fields from the view; fall back to component sum.
  const costLak = ytd.reduce((s, r) => s + Number(
    (r as any).canonical_cost_lak ??
      (Number(r.base_salary_lak ?? 0) +
       Number(r.overtime_15x_lak ?? 0) + Number(r.overtime_2x_lak ?? 0) +
       Number(r.service_charge_lak ?? 0) +
       Number(r.gasoline_allow_lak ?? 0) + Number(r.internet_allow_lak ?? 0) +
       Number(r.other_allow_lak ?? 0))
  ), 0);
  const netLak = ytd.reduce((s, r) => s + Number((r as any).canonical_net_lak ?? r.net_salary_lak ?? 0), 0);
  const benefitsLak = ytd.reduce((s, r) => s + Number(
    (r as any).benefits_lak ??
      (Number(r.service_charge_lak ?? 0) +
       Number(r.gasoline_allow_lak ?? 0) + Number(r.internet_allow_lak ?? 0) +
       Number(r.other_allow_lak ?? 0))
  ), 0);
  const taxLak = ytd.reduce((s, r) => s + Number(r.tax_lak ?? 0), 0);
  const ssoLak = ytd.reduce((s, r) => s + Number(r.sso_5_5_lak ?? 0), 0);
  const grandUsd = ytd.reduce((s, r) => s + Number((r as any).canonical_cost_usd ?? r.grand_total_usd ?? 0), 0);
  const dWorked = ytd.reduce((s, r) => s + Number(r.days_worked ?? 0), 0);
  const dOff    = ytd.reduce((s, r) => s + Number(r.days_off ?? 0), 0);
  const dAL     = ytd.reduce((s, r) => s + Number(r.days_annual_leave ?? 0), 0);
  const dPH     = ytd.reduce((s, r) => s + Number(r.days_public_holiday ?? 0), 0);
  const dSick   = ytd.reduce((s, r) => s + Number((r as any).days_sick ?? 0), 0);

  const fx = Number(ytd[0].fx_lak_usd) > 0 ? Number(ytd[0].fx_lak_usd) : 21500;

  const expectedRuns = lastPeriod ? Number(lastPeriod.slice(5, 7)) : ytd.length;
  const onTrack = ytd.length >= expectedRuns;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      <Tile label={`Total cost · YTD ${year}`} primary={
        <UsdLak usd={grandUsd} lak={costLak} fx={fx} bold />
      } sub={`Net to employee ${(netLak / 1_000_000).toFixed(0)}M · ${ytd.length} payroll run${ytd.length === 1 ? '' : 's'}`} />

      <Tile label="Benefits accrued" primary={
        benefitsLak > 0
          ? <UsdLak lak={benefitsLak} fx={fx} bold tone="pos" />
          : <span style={{ color: 'var(--ink-faint)' }}>—</span>
      } sub="SC + transport + comms + other" />

      <Tile label="Tax + SSO paid" primary={
        <UsdLak lak={taxLak + ssoLak} fx={fx} bold tone="neg" />
      } sub={`Tax ₭${Math.round(taxLak / 1_000_000)}M · SSO ₭${Math.round(ssoLak / 1_000)}k`} />

      <Tile label="Days · W/Off/AL/PH/Sick" primary={
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 'var(--t-md)',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--ink)',
          fontWeight: 600,
        }}>
          {dWorked}/{dOff}/{dAL}/{dPH}/{dSick}
        </span>
      } sub={
        <span style={{ color: onTrack ? 'var(--moss-glow)' : 'var(--st-bad)' }}>
          {ytd.length}/{expectedRuns} payroll runs · {onTrack ? 'on track' : 'gap'}
        </span>
      } />
    </div>
  );
}

function Tile({ label, primary, sub }: { label: string; primary: React.ReactNode; sub: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--paper-warm)',
      border: '1px solid var(--paper-deep)',
      borderRadius: 8,
      padding: '10px 14px',
    }}>
      <div style={{
        fontFamily: 'var(--mono)',
        fontSize: 'var(--t-xs)',
        textTransform: 'uppercase',
        letterSpacing: 'var(--ls-extra)',
        color: 'var(--brass)',
        marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--t-md)', lineHeight: 1.2 }}>
        {primary}
      </div>
      <div style={{
        marginTop: 6,
        fontSize: 'var(--t-xs)',
        color: 'var(--ink-mute)',
      }}>
        {sub}
      </div>
    </div>
  );
}
