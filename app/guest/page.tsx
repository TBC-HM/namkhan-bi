'use client';

import Link from 'next/link';
import { useState } from 'react';

/**
 * /guest — Full-viewport black entry screen.
 * No app chrome. Standalone layout (see app/guest/layout.tsx).
 * Brand: "N" monogram + Namkhan BI wordmark on obsidian bg.
 */
export default function GuestEntryPage() {
  const [hovered, setHovered] = useState(false);

  return (
    <div style={styles.root}>
      {/* ── Top-left Home link ─────────────────────────────────────── */}
      <nav style={styles.topNav}>
        <Link href="/" style={styles.homeLink}>
          ← Home
        </Link>
      </nav>

      {/* ── Centre brand block ─────────────────────────────────────── */}
      <main style={styles.centre}>
        {/* N monogram */}
        <div style={styles.monogramWrap}>
          <span style={styles.monogram}>N</span>
        </div>

        {/* Wordmark */}
        <p style={styles.eyebrow}>NAMKHAN BI</p>
        <h1 style={styles.headline}>
          Guest&nbsp;<em style={styles.headlineEm}>Intelligence</em>
        </h1>
        <p style={styles.lede}>
          Real-time property insights — curated for partners &amp; guests.
        </p>

        {/* CTA */}
        <Link
          href="/guest/dashboard"
          style={{
            ...styles.cta,
            ...(hovered ? styles.ctaHover : {}),
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          Enter&nbsp;→
        </Link>
      </main>

      {/* ── Bottom brand line ──────────────────────────────────────── */}
      <footer style={styles.footer}>
        <span style={styles.footerText}>
          Nam Khan River Lodge &nbsp;·&nbsp; Luang Prabang, Laos
        </span>
      </footer>
    </div>
  );
}

/* ─── Inline styles — all tokens hand-rolled for zero-chrome standalone ─── */
const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: '100dvh',
    width: '100%',
    backgroundColor: '#0a0a0a',         // near-black — no --paper tokens on this standalone screen
    color: '#efe6d3',                    // --paper equivalent for reversed layout
    fontFamily: '"Inter Tight", Inter, system-ui, sans-serif',
    padding: '24px',
    boxSizing: 'border-box' as const,
    position: 'relative' as const,
    overflow: 'hidden',
  },

  /* subtle radial glow so it breathes */
  topNav: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 10,
  },

  homeLink: {
    color: '#b3a888',                   // --ink-faint equivalent reversed
    fontSize: '11px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    textDecoration: 'none',
    fontFamily: '"JetBrains Mono", monospace',
    transition: 'color 0.2s',
  },

  centre: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '16px',
    textAlign: 'center' as const,
    flex: 1,
    justifyContent: 'center',
  },

  monogramWrap: {
    width: '96px',
    height: '96px',
    borderRadius: '50%',
    border: '1px solid #a8854a',        // --brass
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '8px',
    boxShadow: '0 0 40px rgba(168, 133, 74, 0.15)',
  },

  monogram: {
    fontFamily: '"Fraunces", Georgia, serif',
    fontSize: '48px',
    fontStyle: 'italic',
    color: '#a8854a',                   // --brass
    lineHeight: 1,
    letterSpacing: '-0.01em',
  },

  eyebrow: {
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: '10px',
    letterSpacing: '0.18em',
    color: '#7d7565',                   // --ink-mute equivalent
    margin: 0,
    textTransform: 'uppercase' as const,
  },

  headline: {
    fontFamily: '"Fraunces", Georgia, serif',
    fontSize: 'clamp(28px, 5vw, 48px)',
    fontWeight: 300,
    color: '#efe6d3',
    margin: 0,
    letterSpacing: '-0.01em',
    lineHeight: 1.1,
  },

  headlineEm: {
    fontStyle: 'italic',
    color: '#a8854a',                   // --brass
  },

  lede: {
    fontFamily: '"Inter Tight", Inter, system-ui, sans-serif',
    fontSize: '13px',
    color: '#7d7565',
    margin: 0,
    maxWidth: '320px',
    lineHeight: 1.6,
  },

  cta: {
    display: 'inline-block',
    marginTop: '8px',
    padding: '12px 32px',
    borderRadius: '4px',
    border: '1px solid #a8854a',        // --brass
    color: '#a8854a',
    fontFamily: '"Inter Tight", Inter, system-ui, sans-serif',
    fontSize: '13px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    textDecoration: 'none',
    transition: 'background 0.2s, color 0.2s',
    cursor: 'pointer',
  },

  ctaHover: {
    backgroundColor: '#a8854a',
    color: '#0a0a0a',
  },

  footer: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    zIndex: 10,
  },

  footerText: {
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: '10px',
    color: '#4a443c',                   // --ink-soft reversed
    letterSpacing: '0.06em',
  },
} as const;
