'use client';

import { useRouter } from 'next/navigation';

// ─── Home / Architect / CEO entry ────────────────────────────────────────────
// Full-viewport black entry. No data fetch required at this level — this is a
// pure navigation hub. Sub-routes (revenue-v2, operations, etc.) each own their
// own data loading.
//
// Assumptions:
//  1. No v_overview_kpis view exists yet — KPI tiles are nav cards, not live data.
//  2. Brand colours from property_settings: Forest Green #084838, Leaf #8AC479,
//     black background per ticket spec "full-viewport black".
//  3. TT Drugs font not bundled locally; falls back to Georgia in the stack.
//  4. Auth middleware is disabled in Phase 1 (SSO coming Phase 4); no guard here.
// ─────────────────────────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  {
    label: 'Revenue',
    icon: '📈',
    href: '/revenue-v2',
    description: 'ADR · RevPAR · OCC · Comp-set index',
    accent: '#8AC479',
  },
  {
    label: 'Operations',
    icon: '⚙️',
    href: '/operations',
    description: 'Housekeeping · Maintenance · F&B',
    accent: '#8AC479',
  },
  {
    label: 'Finance',
    icon: '💰',
    href: '/finance',
    description: 'P&L · USALI GOP · Cashflow',
    accent: '#8AC479',
  },
  {
    label: 'Marketing',
    icon: '📣',
    href: '/marketing',
    description: 'Media · Social · Content pipeline',
    accent: '#8AC479',
  },
  {
    label: 'Intelligence',
    icon: '🧠',
    href: '/intelligence',
    description: 'Agent cockpit · Incidents · KB',
    accent: '#084838',
  },
];

export default function HomePage() {
  const router = useRouter();

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#000',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'TT Drugs, Times New Roman, Georgia, serif',
        padding: '48px 24px',
        boxSizing: 'border-box',
      }}
    >
      {/* ── Wordmark ── */}
      <header style={{ textAlign: 'center', marginBottom: 64 }}>
        <p
          style={{
            fontSize: 11,
            letterSpacing: '0.35em',
            textTransform: 'uppercase',
            color: '#8AC479',
            marginBottom: 8,
            fontFamily: 'Lora, Georgia, serif',
          }}
        >
          SLH · Small Luxury Hotels of the World
        </p>
        <h1
          style={{
            fontSize: 'clamp(32px, 6vw, 72px)',
            fontWeight: 700,
            letterSpacing: '0.04em',
            margin: 0,
            lineHeight: 1.05,
          }}
        >
          The Namkhan
        </h1>
        <p
          style={{
            fontSize: 13,
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            color: '#CBC2BB',
            marginTop: 12,
            fontFamily: 'Lora, Georgia, serif',
          }}
        >
          Business Intelligence Portal
        </p>
      </header>

      {/* ── Nav grid ── */}
      <nav
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          width: '100%',
          maxWidth: 960,
        }}
      >
        {NAV_SECTIONS.map((s) => (
          <button
            key={s.href}
            onClick={() => router.push(s.href)}
            style={{
              background: '#0a0a0a',
              border: '1px solid #222',
              borderRadius: 8,
              padding: '28px 24px',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'border-color 0.15s, background 0.15s',
              color: '#fff',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = s.accent;
              (e.currentTarget as HTMLButtonElement).style.background = '#111';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#222';
              (e.currentTarget as HTMLButtonElement).style.background = '#0a0a0a';
            }}
          >
            <span style={{ fontSize: 28, display: 'block', marginBottom: 12 }}>
              {s.icon}
            </span>
            <span
              style={{
                fontSize: 18,
                fontWeight: 600,
                display: 'block',
                marginBottom: 6,
                fontFamily: 'TT Drugs, Georgia, serif',
              }}
            >
              {s.label}
            </span>
            <span
              style={{
                fontSize: 12,
                color: '#8a8a8a',
                fontFamily: 'Lora, Georgia, serif',
                lineHeight: 1.5,
              }}
            >
              {s.description}
            </span>
          </button>
        ))}
      </nav>

      {/* ── Footer ── */}
      <footer
        style={{
          marginTop: 80,
          fontSize: 11,
          color: '#444',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          fontFamily: 'Lora, Georgia, serif',
        }}
      >
        Namkhan BI · Internal Operations · Confidential
      </footer>
    </main>
  );
}
