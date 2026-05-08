/**
 * HOME — Architect / CEO Entry Page
 * ticket #159 · full-viewport black entry point
 *
 * Brand palette sourced from marketing.v_property_card:
 *   Black     #000000  — background
 *   Forest    #084838  — primary / logo accent
 *   Leaf      #8AC479  — CTA accent
 *   Stone     #CBC2BB  — subtext
 *   Deep Brown #33221C — dividers
 */

import Link from 'next/link';

export const dynamic = 'force-dynamic';

const NAV_LINKS = [
  { href: '/revenue-v2',    label: 'Revenue',      description: 'Pulse · Segments · Pace' },
  { href: '/operations',    label: 'Operations',   description: 'Housekeeping · Maintenance · F&B' },
  { href: '/finance',       label: 'Finance',      description: 'P&L · Cash · Budgets' },
  { href: '/marketing',     label: 'Marketing',    description: 'Campaigns · Leads · Analytics' },
  { href: '/sustainability', label: 'Sustainability', description: 'Carbon · Farm · Certifications' },
  { href: '/cockpit',       label: 'AI Cockpit',   description: 'Agent activity · Tickets · Audit' },
] as const;

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        background: 'var(--color-black, #000000)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        fontFamily: 'TT Drugs, "Times New Roman", Georgia, serif',
      }}
    >
      {/* ── WORDMARK ── */}
      <header style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
        <p
          style={{
            fontSize: '0.7rem',
            letterSpacing: '0.35em',
            textTransform: 'uppercase',
            color: 'var(--color-stone, #CBC2BB)',
            marginBottom: '0.75rem',
          }}
        >
          Small Luxury Hotels of the World
        </p>
        <h1
          style={{
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 400,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#ffffff',
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          Namkhan
        </h1>
        <p
          style={{
            fontSize: '0.65rem',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: 'var(--color-forest, #084838)',
            marginTop: '0.5rem',
          }}
        >
          Business Intelligence
        </p>
      </header>

      {/* ── NAV GRID ── */}
      <nav
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1px',
          width: '100%',
          maxWidth: '900px',
          background: 'var(--color-deep-brown, #33221C)',
          border: '1px solid var(--color-deep-brown, #33221C)',
        }}
      >
        {NAV_LINKS.map(({ href, label, description }) => (
          <Link
            key={href}
            href={href}
            style={{
              display: 'block',
              padding: '1.75rem 1.5rem',
              background: 'var(--color-black, #000000)',
              color: '#ffffff',
              textDecoration: 'none',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background =
                'var(--color-forest, #084838)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background =
                'var(--color-black, #000000)';
            }}
          >
            <span
              style={{
                display: 'block',
                fontSize: '0.65rem',
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                color: 'var(--color-leaf, #8AC479)',
                marginBottom: '0.4rem',
              }}
            >
              {label}
            </span>
            <span
              style={{
                display: 'block',
                fontSize: '0.75rem',
                color: 'var(--color-stone, #CBC2BB)',
                letterSpacing: '0.04em',
              }}
            >
              {description}
            </span>
          </Link>
        ))}
      </nav>

      {/* ── FOOTER ── */}
      <footer
        style={{
          marginTop: '3rem',
          fontSize: '0.6rem',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--color-deep-brown, #33221C)',
        }}
      >
        © {new Date().getFullYear()} Namkhan Resort · Luang Prabang, Lao PDR
      </footer>
    </main>
  );
}
