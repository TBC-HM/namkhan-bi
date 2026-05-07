'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

const NAV_ITEMS = [
  { label: 'P&L', href: '/finance/pl', description: 'Income · Expenses · EBITDA' },
  { label: 'Cash Flow', href: '/finance/cashflow', description: 'Operating · Investing · Financing' },
  { label: 'Budget vs Actual', href: '/finance/budget', description: 'Variance · Tracking · Forecast' },
  { label: 'Balance Sheet', href: '/finance/balance', description: 'Assets · Liabilities · Equity' },
  { label: 'Tax & Compliance', href: '/finance/tax', description: 'VAT · Withholding · Filings' },
  { label: 'Payroll', href: '/finance/payroll', description: 'Salaries · Benefits · Accruals' },
];

export default function FinancePage() {
  const router = useRouter();

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--sans, "Inter Tight", Inter, sans-serif)',
        color: '#fff',
      }}
    >
      {/* Top bar */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 32px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: 'var(--mono, "JetBrains Mono", monospace)',
            fontSize: 'var(--t-xs, 10px)',
            letterSpacing: 'var(--ls-extra, 0.18em)',
            color: 'rgba(255,255,255,0.4)',
            textDecoration: 'none',
            textTransform: 'uppercase',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => ((e.target as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.9)')}
          onMouseLeave={e => ((e.target as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.4)')}
        >
          ← Home
        </Link>

        {/* N wordmark */}
        <span
          style={{
            fontFamily: 'var(--serif, Fraunces, Georgia, serif)',
            fontSize: '22px',
            fontStyle: 'italic',
            fontWeight: 300,
            color: 'rgba(255,255,255,0.9)',
            letterSpacing: '-0.02em',
          }}
        >
          N
        </span>

        {/* spacer mirror */}
        <span style={{ width: 60 }} />
      </header>

      {/* Hero */}
      <section
        style={{
          flex: '0 0 auto',
          padding: '72px 32px 48px',
          maxWidth: 960,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--mono, "JetBrains Mono", monospace)',
            fontSize: 'var(--t-xs, 10px)',
            letterSpacing: 'var(--ls-extra, 0.18em)',
            color: 'rgba(255,255,255,0.35)',
            textTransform: 'uppercase',
            margin: '0 0 16px',
          }}
        >
          Finance
        </p>
        <h1
          style={{
            fontFamily: 'var(--serif, Fraunces, Georgia, serif)',
            fontSize: 'var(--t-3xl, 30px)',
            fontStyle: 'italic',
            fontWeight: 300,
            letterSpacing: 'var(--ls-tight, -0.01em)',
            color: '#fff',
            margin: '0 0 12px',
            lineHeight: 1.15,
          }}
        >
          Every number,{' '}
          <em style={{ color: 'var(--brass, #b8975a)' }}>accounted for.</em>
        </h1>
        <p
          style={{
            fontSize: 'var(--t-md, 13px)',
            color: 'rgba(255,255,255,0.45)',
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          P&amp;L · Cash Flow · Budget · Balance Sheet · Tax · Payroll
        </p>
      </section>

      {/* Nav grid */}
      <section
        style={{
          flex: '1 1 auto',
          padding: '0 32px 80px',
          maxWidth: 960,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 2,
          }}
        >
          {NAV_ITEMS.map(item => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 4,
                padding: '28px 24px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = 'rgba(255,255,255,0.07)';
                el.style.borderColor = 'rgba(255,255,255,0.18)';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = 'rgba(255,255,255,0.03)';
                el.style.borderColor = 'rgba(255,255,255,0.07)';
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--serif, Fraunces, Georgia, serif)',
                  fontSize: 'var(--t-xl, 16px)',
                  fontStyle: 'italic',
                  fontWeight: 300,
                  color: '#fff',
                  marginBottom: 6,
                  letterSpacing: 'var(--ls-tight, -0.01em)',
                }}
              >
                {item.label}
              </div>
              <div
                style={{
                  fontFamily: 'var(--mono, "JetBrains Mono", monospace)',
                  fontSize: 'var(--t-xs, 10px)',
                  letterSpacing: 'var(--ls-extra, 0.18em)',
                  color: 'rgba(255,255,255,0.3)',
                  textTransform: 'uppercase',
                }}
              >
                {item.description}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Footer rule */}
      <footer
        style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '16px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--mono, "JetBrains Mono", monospace)',
            fontSize: 'var(--t-xs, 10px)',
            letterSpacing: 'var(--ls-extra, 0.18em)',
            color: 'rgba(255,255,255,0.15)',
            textTransform: 'uppercase',
          }}
        >
          Namkhan BI · Finance
        </span>
      </footer>
    </div>
  );
}
