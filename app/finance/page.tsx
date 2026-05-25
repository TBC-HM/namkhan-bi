// app/finance/page.tsx
// PBS #204 — Finance HoD landing on shared primitive (matches /revenue).
// USALI task #17 — Add "Create report" section: 7 preset finance reports
// each routing to the page that already renders that data, pre-configured.
import HodLanding from '@/app/_components/HodLanding';
import { Container } from '@/app/(cockpit)/_design';
import Link from 'next/link';

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

export default function FinancePage() {
  return (
    <>
      <HodLanding slug="finance" />
      <div style={{ marginTop: 14, gridColumn: '1 / -1' }}>
        <Container title="Create report" subtitle="Pre-configured finance reports · click to open with the matching dataset loaded">
          <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {REPORT_PRESETS.map((r) => (
              <Link key={r.code} href={r.href} style={{
                textDecoration: 'none', color: 'inherit',
                border: '1px solid var(--hairline, #E6DFCC)',
                borderRadius: 6, padding: '12px 14px',
                background: 'var(--paper, #FFFFFF)',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink, #1B1B1B)' }}>{r.label}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft, #5A5A5A)' }}>{r.desc}</div>
              </Link>
            ))}
          </div>
        </Container>
      </div>
    </>
  );
}
