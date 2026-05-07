'use client';
// components/nav/LeftRail.tsx
// 7-pillar architecture (v10 + Marketing restore 2026-04-30 + Front Office unfold 2026-05-01):
// 01 Revenue · 02 Sales · 03 Marketing · 04 Operations · 04b Front Office · 05 Guest · 06 Finance
// Bottom utility section: Knowledge · Settings.
// Click N at top → Home (overview lives at /).
// Home link added 2026-05-08 (ticket #190) — sits between N glyph and pillar list.
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
    matches: ['/marketing'],
  },
  {
    href: '/operations',
    glyph: 'O',
    label: 'Ops',
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
          padding: '8px 0',
          color: active ? '#fff' : 'rgba(255,255,255,0.45)',
          textDecoration: 'none',
          fontSize: 10,
          fontWeight: active ? 700 : 400,
          borderLeft: active ? '2px solid #fff' : '2px solid transparent',
          width: '100%',
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>{it.glyph}</span>
        {it.label}
      </Link>
    );
  };

  // Overview-active when on / or /overview or /architect
  const overviewActive = pathname === '/' || pathname === '/overview' || pathname === '/architect';

  return (
    <nav
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: 56,
        minHeight: '100vh',
        background: '#111',
        paddingTop: 12,
        paddingBottom: 12,
        gap: 4,
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 100,
      }}
    >
      {/* N brand — links to home */}
      <Link
        href="/"
        title="Namkhan BI"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          padding: '8px 0',
          color: '#fff',
          textDecoration: 'none',
          fontSize: 20,
          fontWeight: 800,
          letterSpacing: '-0.5px',
          width: '100%',
          marginBottom: 4,
        }}
      >
        N
      </Link>

      {/* Home link — sits between N and pillars */}
      <Link
        href="/architect"
        title="Home"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          padding: '8px 0',
          color: overviewActive ? '#fff' : 'rgba(255,255,255,0.45)',
          textDecoration: 'none',
          fontSize: 10,
          fontWeight: overviewActive ? 700 : 400,
          borderLeft: overviewActive ? '2px solid #fff' : '2px solid transparent',
          width: '100%',
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>⌂</span>
        Home
      </Link>

      <div
        style={{
          width: 32,
          height: 1,
          background: 'rgba(255,255,255,0.1)',
          marginBottom: 4,
        }}
      />

      {PILLARS.map(renderItem)}

      <div style={{ flex: 1 }} />

      {UTILITY.map(renderItem)}
    </nav>
  );
}
