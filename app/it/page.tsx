'use client';

import Link from 'next/link';

export const dynamic = 'force-dynamic';

const NAV_ITEMS = [
  { label: 'Infrastructure', href: '/it/infrastructure' },
  { label: 'Agents', href: '/it/agents' },
  { label: 'Deployments', href: '/it/deployments' },
  { label: 'Data Quality', href: '/it/data-quality' },
  { label: 'Incidents', href: '/it/incidents' },
  { label: 'Cron Jobs', href: '/it/cron' },
  { label: 'Docs & ADRs', href: '/it/docs' },
  { label: 'Security', href: '/it/security' },
];

export default function ITPage() {
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
        overflow: 'hidden',
      }}
    >
      {/* Top-left Home link */}
      <Link
        href="/"
        style={{
          position: 'absolute',
          top: 20,
          left: 24,
          color: '#555',
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          textDecoration: 'none',
          fontFamily: 'var(--mono, "JetBrains Mono", monospace)',
        }}
      >
        ← Home
      </Link>

      {/* Subtle grid overlay */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          pointerEvents: 'none',
        }}
      />

      {/* Central N monogram */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 40,
        }}
      >
        {/* N brand mark */}
        <div
          style={{
            width: 80,
            height: 80,
            border: '1px solid rgba(168, 133, 74, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--serif, "Fraunces", serif)',
              fontSize: 42,
              fontWeight: 900,
              fontStyle: 'italic',
              color: '#a8854a',
              lineHeight: 1,
              letterSpacing: '-0.01em',
            }}
          >
            N
          </span>
          {/* Corner accents */}
          <span style={{ position: 'absolute', top: -1, left: -1, width: 8, height: 8, borderTop: '1px solid #a8854a', borderLeft: '1px solid #a8854a' }} />
          <span style={{ position: 'absolute', top: -1, right: -1, width: 8, height: 8, borderTop: '1px solid #a8854a', borderRight: '1px solid #a8854a' }} />
          <span style={{ position: 'absolute', bottom: -1, left: -1, width: 8, height: 8, borderBottom: '1px solid #a8854a', borderLeft: '1px solid #a8854a' }} />
          <span style={{ position: 'absolute', bottom: -1, right: -1, width: 8, height: 8, borderBottom: '1px solid #a8854a', borderRight: '1px solid #a8854a' }} />
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center' }}>
          <p
            style={{
              fontFamily: 'var(--mono, "JetBrains Mono", monospace)',
              fontSize: 10,
              letterSpacing: '0.18em',
              color: '#a8854a',
              textTransform: 'uppercase',
              margin: '0 0 10px',
            }}
          >
            IT Manager
          </p>
          <h1
            style={{
              fontFamily: 'var(--serif, "Fraunces", serif)',
              fontSize: 30,
              fontStyle: 'italic',
              fontWeight: 600,
              color: '#fff',
              letterSpacing: '-0.01em',
              margin: 0,
            }}
          >
            Infrastructure & Systems
          </h1>
          <p
            style={{
              fontFamily: 'var(--sans, "Inter Tight", sans-serif)',
              fontSize: 13,
              color: '#555',
              marginTop: 8,
              letterSpacing: '0.02em',
            }}
          >
            Namkhan BI · Internal operations console
          </p>
        </div>

        {/* Nav grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 160px)',
            gap: 1,
            background: 'rgba(255,255,255,0.04)',
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
                padding: '18px 12px',
                background: '#000',
                color: '#888',
                fontSize: 11,
                fontFamily: 'var(--mono, "JetBrains Mono", monospace)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                textDecoration: 'none',
                transition: 'color 0.15s, background 0.15s',
                textAlign: 'center',
                border: '1px solid transparent',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.color = '#a8854a';
                (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(168,133,74,0.3)';
                (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(168,133,74,0.05)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.color = '#888';
                (e.currentTarget as HTMLAnchorElement).style.borderColor = 'transparent';
                (e.currentTarget as HTMLAnchorElement).style.background = '#000';
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Footer status line */}
        <p
          style={{
            fontFamily: 'var(--mono, "JetBrains Mono", monospace)',
            fontSize: 10,
            color: '#333',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            margin: 0,
          }}
        >
          Stack: Next.js 14 · Supabase · Vercel · Anthropic
        </p>
      </div>
    </div>
  );
}
