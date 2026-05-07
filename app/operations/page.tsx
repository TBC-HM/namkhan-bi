'use client';

import Link from 'next/link';

export const dynamic = 'force-dynamic';

const NAV_ITEMS = [
  { label: 'Housekeeping', href: '/operations/housekeeping' },
  { label: 'Maintenance', href: '/operations/maintenance' },
  { label: 'F&B', href: '/operations/fnb' },
  { label: 'Staff', href: '/operations/staff' },
  { label: 'Incidents', href: '/operations/incidents' },
];

export default function OperationsEntryPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--sans, "Inter Tight", sans-serif)',
        position: 'relative',
      }}
    >
      {/* Top-left Home link */}
      <Link
        href="/"
        style={{
          position: 'absolute',
          top: 24,
          left: 28,
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: '#ffffff66',
          textDecoration: 'none',
          fontFamily: 'var(--mono, "JetBrains Mono", monospace)',
        }}
      >
        ← Home
      </Link>

      {/* N brand mark */}
      <div
        style={{
          fontSize: 96,
          fontFamily: 'var(--serif, Fraunces, serif)',
          fontStyle: 'italic',
          fontWeight: 300,
          color: '#fff',
          letterSpacing: '-0.03em',
          lineHeight: 1,
          marginBottom: 8,
          userSelect: 'none',
        }}
      >
        N
      </div>

      {/* Eyebrow */}
      <p
        style={{
          fontSize: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: '#ffffff55',
          fontFamily: 'var(--mono, "JetBrains Mono", monospace)',
          margin: '0 0 48px',
        }}
      >
        Operations
      </p>

      {/* Nav links */}
      <nav
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              fontSize: 13,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#ffffffcc',
              textDecoration: 'none',
              padding: '8px 24px',
              borderRadius: 2,
              transition: 'color 0.15s, background 0.15s',
              fontFamily: 'var(--sans, "Inter Tight", sans-serif)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = '#fff';
              (e.currentTarget as HTMLAnchorElement).style.background =
                '#ffffff0f';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = '#ffffffcc';
              (e.currentTarget as HTMLAnchorElement).style.background =
                'transparent';
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Footer rule */}
      <div
        style={{
          position: 'absolute',
          bottom: 28,
          fontSize: 10,
          letterSpacing: '0.12em',
          color: '#ffffff33',
          fontFamily: 'var(--mono, "JetBrains Mono", monospace)',
          textTransform: 'uppercase',
        }}
      >
        Namkhan · BI
      </div>
    </div>
  );
}
