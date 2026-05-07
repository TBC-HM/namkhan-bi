'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// ─── Marketing Entry Page ───────────────────────────────────────────────────
// Full-viewport black, N-brand, no shell chrome. Links out to sub-sections.
// Ticket #159 slice: all-black hero + nav grid, Home top link.

const NAV_TILES = [
  { label: 'Brand Reach', href: '/marketing/reach', desc: 'Social, reviews, influencer pipeline' },
  { label: 'Photo Library', href: '/marketing/library', desc: '36 ingested assets · tier-tagged' },
  { label: 'Channel Handles', href: '/marketing/channels', desc: '7 of 8 channels claimed' },
  { label: 'Profile Completeness', href: '/marketing/profile', desc: '~85% · 13 open todos' },
  { label: 'Campaigns', href: '/marketing/campaigns', desc: 'Upcoming & active campaigns' },
  { label: 'Settings', href: '/settings/property', desc: 'Edit property factsheet' },
];

export default function MarketingEntryPage() {
  const router = useRouter();

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#000',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'TT Drugs, "Times New Roman", Georgia, serif',
      }}
    >
      {/* ── Top bar ── */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 32px',
          borderBottom: '1px solid #1a1a1a',
        }}
      >
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'none',
            border: 'none',
            color: '#8AC479',
            cursor: 'pointer',
            fontSize: 13,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: 0,
          }}
        >
          ← Home
        </button>

        {/* N wordmark */}
        <span
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: '#fff',
          }}
        >
          N
        </span>

        <span
          style={{
            fontSize: 12,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#363C3D',
          }}
        >
          Marketing
        </span>
      </header>

      {/* ── Hero ── */}
      <section
        style={{
          flex: '0 0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '72px 32px 48px',
          textAlign: 'center',
          borderBottom: '1px solid #111',
        }}
      >
        {/* Badge */}
        <span
          style={{
            display: 'inline-block',
            fontSize: 10,
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            color: '#8AC479',
            border: '1px solid #8AC479',
            borderRadius: 2,
            padding: '3px 10px',
            marginBottom: 24,
          }}
        >
          THE RESORT · MARKETING HQ
        </span>

        <h1
          style={{
            fontSize: 'clamp(36px, 6vw, 80px)',
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            margin: '0 0 20px',
            color: '#fff',
          }}
        >
          Namkhan<br />
          <span style={{ color: '#084838' }}>Boutique Inn</span>
        </h1>

        <p
          style={{
            fontSize: 15,
            color: '#CBC2BB',
            maxWidth: 480,
            lineHeight: 1.7,
            margin: 0,
            fontFamily: 'Lora, Georgia, "Times New Roman", serif',
          }}
        >
          Brand presence · content · channel management.
          <br />
          Everything marketing, in one place.
        </p>
      </section>

      {/* ── Nav grid ── */}
      <main
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 1,
          background: '#111',
          padding: 1,
        }}
      >
        {NAV_TILES.map((tile) => (
          <button
            key={tile.href}
            onClick={() => router.push(tile.href)}
            style={{
              background: '#000',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              padding: '36px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#0a0a0a';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#000';
            }}
          >
            <span
              style={{
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: '#fff',
              }}
            >
              {tile.label}
            </span>
            <span
              style={{
                fontSize: 13,
                color: '#5a5a5a',
                lineHeight: 1.5,
                fontFamily: 'Lora, Georgia, "Times New Roman", serif',
                fontWeight: 400,
              }}
            >
              {tile.desc}
            </span>
            <span
              style={{
                marginTop: 'auto',
                fontSize: 18,
                color: '#8AC479',
                lineHeight: 1,
              }}
            >
              →
            </span>
          </button>
        ))}
      </main>

      {/* ── Footer rule ── */}
      <footer
        style={{
          padding: '16px 32px',
          borderTop: '1px solid #111',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 11, color: '#2a2a2a', letterSpacing: '0.1em' }}>
          NAMKHAN BI · MARKETING
        </span>
        <span
          style={{
            fontSize: 11,
            color: '#084838',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Small Luxury Hotels of the World
        </span>
      </footer>
    </div>
  );
}
