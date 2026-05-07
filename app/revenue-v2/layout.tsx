// app/revenue-v2/layout.tsx
// Shared layout for all /revenue-v2/* pages.
// Mirrors the /revenue layout but scoped to v2 routes so both pillars
// can coexist on staging until PBS promotes v2 to production.
import { ReactNode } from 'react';
import Link from 'next/link';

const NAV_LINKS = [
  { href: '/revenue-v2/pulse',     label: 'Pulse' },
  { href: '/revenue-v2/pace',      label: 'Pace' },
  { href: '/revenue-v2/channels',  label: 'Channels' },
  { href: '/revenue-v2/rateplans', label: 'Rate Plans' },
  { href: '/revenue-v2/pricing',   label: 'Pricing' },
  { href: '/revenue-v2/compset',   label: 'Compset' },
  { href: '/revenue-v2/parity',    label: 'Parity' },
  { href: '/revenue-v2/agents',    label: 'Agents' },
];

export default function RevenueV2Layout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #f7f5f0)' }}>
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '0 24px',
        borderBottom: '1px solid var(--paper-deep, #e2ddd5)',
        background: 'var(--paper-warm, #faf8f4)',
        overflowX: 'auto',
      }}>
        <span style={{
          fontFamily: 'var(--mono, monospace)',
          fontSize: 'var(--t-xs, 11px)',
          letterSpacing: '0.08em',
          color: 'var(--ink-mute, #9e9790)',
          marginRight: 12,
          whiteSpace: 'nowrap',
        }}>REVENUE v2</span>
        {NAV_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            style={{
              fontFamily: 'var(--mono, monospace)',
              fontSize: 'var(--t-xs, 11px)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--ink, #2c2820)',
              textDecoration: 'none',
              padding: '10px 14px',
              whiteSpace: 'nowrap',
              borderBottom: '2px solid transparent',
            }}
          >
            {label}
          </Link>
        ))}
      </nav>
      <main style={{ padding: '0 0 80px 0' }}>
        {children}
      </main>
    </div>
  );
}
