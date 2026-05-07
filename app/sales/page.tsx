'use client';

import Link from 'next/link';

export const dynamic = 'force-dynamic';

const NAV_ITEMS = [
  { label: 'Proposals', href: '/sales/proposals' },
  { label: 'Pipeline', href: '/sales/pipeline' },
  { label: 'Accounts', href: '/sales/accounts' },
  { label: 'Calendar', href: '/sales/calendar' },
];

export default function SalesEntryPage() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-mono, monospace)',
        zIndex: 0,
      }}
    >
      {/* Top nav bar */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
          height: 56,
          borderBottom: '1px solid #222',
          flexShrink: 0,
        }}
      >
        <Link
          href="/"
          style={{
            color: '#fff',
            textDecoration: 'none',
            fontSize: 13,
            letterSpacing: '0.12em',
            opacity: 0.55,
          }}
        >
          ← Home
        </Link>

        <nav style={{ display: 'flex', gap: 32 }}>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                color: '#fff',
                textDecoration: 'none',
                fontSize: 12,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                opacity: 0.5,
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <span
          style={{
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            opacity: 0.3,
          }}
        >
          Sales
        </span>
      </header>

      {/* Hero centre */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 48,
          padding: '0 32px',
        }}
      >
        {/* N logotype */}
        <div
          style={{
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            color: '#fff',
            fontFamily: 'var(--font-sans, sans-serif)',
            userSelect: 'none',
          }}
        >
          N
        </div>

        <p
          style={{
            fontSize: 12,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            opacity: 0.35,
            margin: 0,
          }}
        >
          Namkhan · Sales Intelligence
        </p>

        {/* Quick-action grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 220px)',
            gap: 2,
            marginTop: 16,
          }}
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 64,
                background: '#0a0a0a',
                border: '1px solid #1a1a1a',
                color: '#fff',
                textDecoration: 'none',
                fontSize: 11,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                opacity: 0.65,
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          padding: '16px 32px',
          borderTop: '1px solid #111',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 10, opacity: 0.2, letterSpacing: '0.1em' }}>
          NAMKHAN BI · SALES
        </span>
        <span style={{ fontSize: 10, opacity: 0.2, letterSpacing: '0.1em' }}>
          {new Date().getFullYear()}
        </span>
      </footer>
    </div>
  );
}
