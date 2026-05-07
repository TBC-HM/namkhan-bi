'use client';
// components/nav/LeftRail.tsx
// 7-pillar architecture (v10 + Marketing restore 2026-04-30 + Front Office unfold 2026-05-01):
// 01 Revenue · 02 Sales · 03 Marketing · 04 Operations · 04b Front Office · 05 Guest · 06 Finance
// Bottom utility section: Knowledge · Settings.
// Click N at top → Home (overview lives at /).
// Home link added 2026-05-08: explicit 'H' glyph between N brand and pillar list.
// Note: Sales glyph is '$' to avoid collision with Settings 'S'.
// Front Office glyph is 'A' (Arrivals) — distinct from Operations 'O' and Marketing 'M'.

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
    const active = it.matches.some((m) => pathname === m || pathname.startsWith(m + '/'));
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
          color: active ? '#fff' : '#666',
          textDecoration: 'none',
          fontSize: 11,
          fontWeight: active ? 700 : 400,
          borderLeft: active ? '2px solid #fff' : '2px solid transparent',
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>{it.glyph}</span>
        <span>{it.label}</span>
      </Link>
    );
  };

  // Overview-active when on /overview or /
  const overviewActive = pathname === '/' || pathname === '/overview';
  // Home-active when on / or /overview (same condition — Home IS the overview)
  const homeActive = overviewActive;

  return (
    <nav
      style={{
        width: 56,
        minHeight: '100vh',
        background: '#0a0a0a',
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
      {/* N brand glyph — clickable to Home */}
      <Link
        href="/"
        title="Home"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          background: '#fff',
          color: '#000',
          fontWeight: 900,
          fontSize: 20,
          borderRadius: 6,
          textDecoration: 'none',
          marginBottom: 8,
          flexShrink: 0,
        }}
      >
        N
      </Link>

      {/* Explicit Home link — between N brand and department pillars */}
      <Link
        href="/"
        title="Home"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          padding: '10px 0',
          color: homeActive ? '#fff' : '#666',
          textDecoration: 'none',
          fontSize: 11,
          fontWeight: homeActive ? 700 : 400,
          borderLeft: homeActive ? '2px solid #fff' : '2px solid transparent',
          width: '100%',
          paddingLeft: 2,
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>⌂</span>
        <span>Home</span>
      </Link>

      {/* Divider */}
      <div
        style={{
          width: 32,
          height: 1,
          background: '#222',
          margin: '4px 0 8px',
          flexShrink: 0,
        }}
      />

      {/* Department pillars */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', alignItems: 'center' }}>
        {PILLARS.map(renderItem)}
      </div>

      {/* Utility items at bottom */}
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center' }}>
        {UTILITY.map(renderItem)}
      </div>
    </nav>
  );
}
