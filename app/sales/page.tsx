'use client';

import Link from 'next/link';

export default function SalesEntryPage() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        backgroundColor: '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-sans, sans-serif)',
        padding: '2rem',
        position: 'relative',
      }}
    >
      {/* Home top link */}
      <nav
        style={{
          position: 'absolute',
          top: '1.5rem',
          left: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <Link
          href="/"
          style={{
            color: 'rgba(255,255,255,0.45)',
            fontSize: '0.75rem',
            fontWeight: 500,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            textDecoration: 'none',
          }}
        >
          ← Home
        </Link>
      </nav>

      {/* N brand mark */}
      <div
        style={{
          fontSize: '5rem',
          fontWeight: 800,
          color: '#fff',
          lineHeight: 1,
          letterSpacing: '-0.04em',
          marginBottom: '1rem',
          userSelect: 'none',
        }}
      >
        N
      </div>

      {/* Title */}
      <h1
        style={{
          fontSize: '1.5rem',
          fontWeight: 600,
          color: '#fff',
          margin: '0 0 0.5rem 0',
          letterSpacing: '0.02em',
          textAlign: 'center',
        }}
      >
        Sales
      </h1>

      {/* Lede */}
      <p
        style={{
          fontSize: '0.875rem',
          color: 'rgba(255,255,255,0.45)',
          margin: '0 0 3rem 0',
          textAlign: 'center',
          maxWidth: '28rem',
          lineHeight: 1.6,
        }}
      >
        Leads, contracts, B2B accounts — everything revenue that isn&apos;t a reservation.
      </p>

      {/* Nav tiles */}
      <nav
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          width: '100%',
          maxWidth: '52rem',
        }}
      >
        {[
          { label: 'Inquiries', href: '/sales/inquiries', desc: 'Triage & auto-quote' },
          { label: 'Leads', href: '/sales/leads', desc: 'Pipeline & follow-ups' },
          { label: 'Contracts', href: '/sales/contracts', desc: 'B2B agreements' },
          { label: 'Accounts', href: '/sales/accounts', desc: 'Corporate & groups' },
        ].map(({ label, href, desc }) => (
          <Link
            key={href}
            href={href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.375rem',
              padding: '1.25rem 1.5rem',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              transition: 'border-color 0.15s ease, background 0.15s ease',
              background: 'rgba(255,255,255,0.03)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor =
                'rgba(255,255,255,0.35)';
              (e.currentTarget as HTMLAnchorElement).style.background =
                'rgba(255,255,255,0.07)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor =
                'rgba(255,255,255,0.12)';
              (e.currentTarget as HTMLAnchorElement).style.background =
                'rgba(255,255,255,0.03)';
            }}
          >
            <span
              style={{
                fontSize: '0.9375rem',
                fontWeight: 600,
                color: '#fff',
                letterSpacing: '0.01em',
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontSize: '0.8125rem',
                color: 'rgba(255,255,255,0.45)',
                lineHeight: 1.4,
              }}
            >
              {desc}
            </span>
          </Link>
        ))}
      </nav>
    </main>
  );
}
