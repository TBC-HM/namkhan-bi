'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

const NAV_ITEMS = [
  { label: 'Pulse',       href: '/revenue/pulse' },
  { label: 'Channels',    href: '/revenue/channels' },
  { label: 'Engine',      href: '/revenue/engine' },
  { label: 'Segments',    href: '/revenue/segments' },
  { label: 'Compset',     href: '/revenue/compset' },
  { label: 'Pace',        href: '/revenue/pace' },
];

export default function RevenuePage() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        backgroundColor: '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        position: 'relative',
      }}
    >
      {/* Home top-left link */}
      <Link
        href="/"
        style={{
          position: 'absolute',
          top: 24,
          left: 28,
          color: 'rgba(255,255,255,0.45)',
          fontSize: 12,
          letterSpacing: '0.12em',
          textDecoration: 'none',
          textTransform: 'uppercase',
          fontWeight: 500,
        }}
      >
        ← Home
      </Link>

      {/* N brand mark */}
      <div
        style={{
          fontSize: 72,
          fontWeight: 700,
          color: '#fff',
          letterSpacing: '-0.04em',
          lineHeight: 1,
          marginBottom: 4,
          userSelect: 'none',
        }}
      >
        N
      </div>

      {/* Pillar label */}
      <p
        style={{
          color: 'rgba(255,255,255,0.38)',
          fontSize: 11,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          margin: '0 0 48px',
          fontWeight: 500,
        }}
      >
        Revenue
      </p>

      {/* Nav grid */}
      <nav
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px 16px',
          width: '100%',
          maxWidth: 360,
          padding: '0 24px',
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
              height: 52,
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: 6,
              color: 'rgba(255,255,255,0.82)',
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: '0.06em',
              textDecoration: 'none',
              textTransform: 'uppercase',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.55)';
              (e.currentTarget as HTMLAnchorElement).style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.14)';
              (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.82)';
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Footer hint */}
      <p
        style={{
          position: 'absolute',
          bottom: 24,
          color: 'rgba(255,255,255,0.18)',
          fontSize: 11,
          letterSpacing: '0.1em',
          margin: 0,
        }}
      >
        Namkhan Boutique Intelligence
      </p>
    </div>
  );
}
