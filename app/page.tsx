'use client';

import Link from 'next/link';

const PILLARS = [
  {
    href: '/revenue-v2',
    label: 'Revenue',
    description: 'Pulse · Compset · Parity · Forecast',
    icon: '📈',
  },
  {
    href: '/frontoffice',
    label: 'Front Office',
    description: 'Arrivals · In-house · Departures',
    icon: '🛎',
  },
  {
    href: '/finance',
    label: 'Finance',
    description: 'P&L · USALI · GL Entries',
    icon: '💰',
  },
  {
    href: '/sales',
    label: 'Sales',
    description: 'Inquiries · Contracts · Pipeline',
    icon: '🤝',
  },
  {
    href: '/marketing',
    label: 'Marketing',
    description: 'Content · Channels · Performance',
    icon: '📣',
  },
  {
    href: '/ops',
    label: 'Operations',
    description: 'Maintenance · Inventory · HR',
    icon: '⚙️',
  },
];

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        fontFamily: 'var(--sans, "Inter Tight", sans-serif)',
      }}
    >
      {/* Wordmark */}
      <div style={{ textAlign: 'center', marginBottom: 64 }}>
        <p
          style={{
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#7d7565',
            margin: '0 0 12px',
          }}
        >
          The Namkhan · Business Intelligence
        </p>
        <h1
          style={{
            fontFamily: 'var(--serif, Fraunces, serif)',
            fontSize: 'clamp(36px, 6vw, 72px)',
            fontWeight: 300,
            fontStyle: 'italic',
            color: '#a8854a',
            letterSpacing: '-0.01em',
            margin: '0 0 16px',
            lineHeight: 1.1,
          }}
        >
          Namkhan BI
        </h1>
        <p
          style={{
            fontSize: 14,
            color: '#7d7565',
            margin: 0,
            letterSpacing: '0.02em',
          }}
        >
          Considerate luxury on the river — command view
        </p>
      </div>

      {/* Pillar grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          width: '100%',
          maxWidth: 900,
          marginBottom: 64,
        }}
      >
        {PILLARS.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            style={{
              display: 'block',
              padding: '24px 20px',
              backgroundColor: '#111',
              border: '1px solid #2a2520',
              borderRadius: 8,
              textDecoration: 'none',
              transition: 'border-color 0.15s, background-color 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = '#a8854a';
              (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#141210';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = '#2a2520';
              (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#111';
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 10 }}>{p.icon}</div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: '#efe6d3',
                letterSpacing: '0.02em',
                marginBottom: 6,
              }}
            >
              {p.label}
            </div>
            <div style={{ fontSize: 11, color: '#7d7565', lineHeight: 1.5 }}>
              {p.description}
            </div>
          </Link>
        ))}
      </div>

      {/* Cockpit shortcut */}
      <div style={{ textAlign: 'center' }}>
        <Link
          href="/cockpit"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 24px',
            backgroundColor: '#1a2e21',
            border: '1px solid #2d4a35',
            borderRadius: 6,
            color: '#6b9379',
            fontSize: 12,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            textDecoration: 'none',
          }}
        >
          <span>⚡</span>
          Agent Cockpit
        </Link>
        <p style={{ marginTop: 12, fontSize: 10, color: '#4a443c', letterSpacing: '0.06em' }}>
          SLH · HILTON HONORS · ASEAN GREEN HOTEL
        </p>
      </div>
    </main>
  );
}
