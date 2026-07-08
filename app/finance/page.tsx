// app/finance/page.tsx
// PBS #204 — Finance HoD landing on shared primitive (matches /revenue).
// USALI task #17 — "Create report" section: 7 preset finance reports.
// PBS 2026-07-07 — Conclusions container from lib/rules/finance.ts.

import HodLanding from '@/app/_components/HodLanding';
import { Container } from '@/app/(cockpit)/_design';
import TenantLink from '@/components/nav/TenantLink';
import { PROPERTY_ID } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { evaluateFinanceRules, type FinanceContext, type FinanceTargets } from '@/lib/rules/finance';

export const dynamic = 'force-dynamic';

const REPORT_PRESETS: { code: string; label: string; desc: string; href: string }[] = [
  { code: 'pl_month',     label: 'P&L · month',           desc: 'USALI dept schedule for a selected month',  href: '/h/260955/finance/pnl' },
  { code: 'pl_ytd',       label: 'P&L · YTD',             desc: 'YTD performance vs LY, all departments',     href: '/h/260955/finance/pnl?period=YTD-2026' },
  { code: 'cash_flow',    label: 'Cash flow',             desc: 'Bank movements + outstanding AR/AP',         href: '/h/260955/finance/banks' },
  { code: 'banks',        label: 'Banks snapshot',        desc: 'Current balances + last 30 days movement',   href: '/h/260955/finance/banks' },
  { code: 'payroll',      label: 'Payroll · month',       desc: 'HR payroll register for selected period',    href: '/h/260955/finance/hr/payroll' },
  { code: 'budget',       label: 'Budget vs Actual',      desc: 'Variance report per USALI department',       href: '/h/260955/finance/budget' },
  { code: 'transactions', label: 'Transactions explorer', desc: 'GL entry search + categorisation',           href: '/h/260955/finance/transactions' },
];

async function buildFinanceContext(propertyId: number): Promise<FinanceContext> {
  const sb = getSupabaseAdmin();
  const currency = propertyId === 1000001 ? '€' : '$';

  const targets: FinanceTargets = {};
  try {
    const { data } = await sb
      .from('guardrails')
      .select('rule_key, threshold_val')
      .eq('property_id', propertyId).eq('domain', 'finance').eq('active', true);
    for (const g of (data ?? []) as Array<{ rule_key: string; threshold_val: number | string }>) {
      const n = typeof g.threshold_val === 'string' ? Number(g.threshold_val) : g.threshold_val;
      if (!Number.isFinite(n)) continue;
      if (g.rule_key === 'ap_late_days') targets.ap_late_days = n;
      else if (g.rule_key === 'ar_days_max') targets.ar_days_max = n;
      else if (g.rule_key === 'cash_days_min') targets.cash_days_min = n;
      else if (g.rule_key === 'payroll_pct_target') targets.payroll_pct_target = n;
      else if (g.rule_key === 'gop_margin_target') targets.gop_margin_target = n;
      else if (g.rule_key === 'variance_pl_pp') targets.variance_pl_pp = n;
    }
  } catch { /* ignore */ }

  // Best-effort data pulls — leave null on any miss, rules skip cleanly.
  return {
    currencySymbol: currency,
    cashDaysRunway: null,
    arOverdueDays: null,
    apOverdueDays: null,
    payrollPctRevenue: null,
    gopMarginPctMtd: null,
    variancePlPp: null,
    targets,
  };
}

export default async function FinancePage() {
  const pid = PROPERTY_ID;
  const ctx = await buildFinanceContext(pid);
  const insights = evaluateFinanceRules(ctx);
  const activeTargets = Object.entries(ctx.targets).map(([k, v]) => `${k}=${v}`).join(' · ') || 'no DB targets';

  return (
    <>
      <HodLanding
        slug="finance"
        conclusions={{
          insights,
          title: 'CONCLUSIONS · cash · AR · AP · payroll · margin · variance',
          subtitle: `DB targets: ${activeTargets} — most rules await data-source wiring (cash/AR/AP RPCs)`,
        }}
      />
      <div style={{ marginTop: 14, gridColumn: '1 / -1' }}>
        <Container title="Create report" subtitle="Pre-configured finance reports · click to open with the matching dataset loaded">
          <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {REPORT_PRESETS.map((r) => (
              <TenantLink key={r.code} href={r.href} style={{
                textDecoration: 'none', color: 'inherit',
                border: '1px solid var(--hairline, #E6DFCC)',
                borderRadius: 6, padding: '12px 14px',
                background: 'var(--paper, #FFFFFF)',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink, #1B1B1B)' }}>{r.label}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft, #5A5A5A)' }}>{r.desc}</div>
              </TenantLink>
            ))}
          </div>
        </Container>
      </div>
    </>
  );
}
