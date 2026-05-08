'use client';
// components/nav/LeftRail.tsx
// 7-pillar architecture (v10 + Marketing restore 2026-04-30 + Front Office unfold 2026-05-01):
// 01 Revenue · 02 Sales · 03 Marketing · 04 Operations · 04b Front Office · 05 Guest · 06 Finance
// Bottom utility section: Knowledge · Settings.
// Click N at top → Home (overview lives at /).
// Note: Sales glyph is '$' to avoid collision with Settings 'S'.
// Front Office glyph is 'A' (Arrivals) — distinct from Operations 'O' and Marketing 'M'.
// 2026-05-08: Added explicit Home rail item (⌂/H) between N logo and pillar list (slice of #159).

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface RailItem {
  href: string;
  glyph: string;
  label: string;
  matches: string[]; // pathname prefixes that activate this rail item
}

const PILLARS: RailItem[] = [
  {
    href: '/revenue',
    glyph: 'R',
    label: 'Revenue',
    matches: ['/revenue'],
  },
  {
    href: '/sales/inquiries',
    glyph: '$',
    label: 'Sales',
    matches: ['/sales'],
  },
  {
    href: '/marketing',
    glyph: 'M',
    label: 'Marketing',
    // marketing owns reviews/social/influencers/media as sub-tabs
    matches: ['/marketing'],
  },
  {
    href: '/operations',
    glyph: 'O',
    label: 'Ops',
    // operations folds in: today, departments, action plans
    matches: ['/operations', '/today', '/departments', '/actions'],
  },
  {
    href: '/front-office/arrivals',
    glyph: 'A',
    label: 'Front',
    matches: ['/front-office'],
  },
  {
    href: '/guest',
    glyph: 'G',
    label: 'Guest',
    matches: ['/guest'],
  },
  {
    href: '/finance',
    glyph: 'F',
    label: 'Finance',
    matches: ['/finance'],
  },
];

const UTILITY: RailItem[] = [
  {
    href: '/knowledge',
    glyph: 'K',
    label: 'Knowledge',
    matches: ['/knowledge', '/agents'],
  },
  {
    href: '/settings',
    glyph: 'S',
    label: 'Settings',
    matches: ['/settings'],
  },
];

export default function LeftRail() {
  const pathname = usePathname();

  const renderItem = (it: RailItem) => {
    const active = it.matches.some(
      (m) => pathname === m || pathname.startsWith(m + '/')
    );
    return (
      <Link
        key={it.href}
        href={it.href}
        title={it.label}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          padding: '10px 0',
          textDecoration: 'none',
          color: active ? '#fff' : 'rgba(255,255,255,0.55)',
          fontWeight: active ? 700 : 400,
          fontSize: 11,
          borderLeft: active ? '2px solid #fff' : '2px solid transparent',
          transition: 'color 0.15s, border-color 0.15s',
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>{it.glyph}</span>
        <span>{it.label}</span>
      </Link>
    );
  };

  // Overview-active when on /overview or /
  const overviewActive = pathname === '/' || pathname === '/overview';

  return (
    <nav
      style={{
        width: 56,
        minHeight: '100vh',
        background: '#111',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 12,
        gap: 0,
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 100,
      }}
    >
      {/* N — property logo / wordmark, always links to / */}
      <Link
        href="/"
        title="Namkhan BI"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          borderRadius: 6,
          background: '#2a2a2a',
          color: '#fff',
          fontWeight: 800,
          fontSize: 18,
          textDecoration: 'none',
          marginBottom: 8,
          flexShrink: 0,
        }}
      >
        N
      </Link>

      {/* ── HOME LINK (slice of #159) ── inserted between N and pillar list */}
      <Link
        href="/"
        title="Home"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          padding: '10px 0',
          width: '100%',
          textDecoration: 'none',
          color: overviewActive ? '#fff' : 'rgba(255,255,255,0.55)',
          fontWeight: overviewActive ? 700 : 400,
          fontSize: 11,
          borderLeft: overviewActive ? '2px solid #fff' : '2px solid transparent',
          transition: 'color 0.15s, border-color 0.15s',
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>⌂</span>
        <span>Home</span>
      </Link>

      {/* ── DIVIDER ── */}
      <div
        style={{
          width: 32,
          height: 1,
          background: 'rgba(255,255,255,0.12)',
          margin: '4px 0 4px',
          flexShrink: 0,
        }}
      />

      {/* ── PILLARS ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center' }}>
        {PILLARS.map(renderItem)}
      </div>

      {/* ── UTILITY ── */}
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center' }}>
        <div
          style={{
            width: 32,
            height: 1,
            background: 'rgba(255,255,255,0.12)',
            margin: '4px 0 4px',
            flexShrink: 0,
          }}
        />
        {UTILITY.map(renderItem)}
      </div>
    </nav>
  );
}
