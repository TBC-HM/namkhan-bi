'use client';
// components/nav/LeftRail.tsx
// 7-pillar architecture (v10 + Marketing restore 2026-04-30 + Front Office unfold 2026-05-01):
// 01 Revenue · 02 Sales · 03 Marketing · 04 Operations · 04b Front Office · 05 Guest · 06 Finance
// Bottom utility section: Knowledge · Settings.
// Click N at top → Home (overview lives at /).
// Home link sits between the N-logo and the first pillar (Revenue), linking to /.
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
          justifyContent: 'center',
          width: 48,
          height: 48,
          borderRadius: 8,
          textDecoration: 'none',
          fontSize: 10,
          fontWeight: 600,
          gap: 2,
          color: active ? 'var(--rail-active-fg, #fff)' : 'var(--rail-fg, rgba(255,255,255,0.6))',
          background: active ? 'var(--rail-active-bg, rgba(255,255,255,0.15))' : 'transparent',
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>{it.glyph}</span>
        <span>{it.label}</span>
      </Link>
    );
  };

  // Overview-active when on /overview or /
  const overviewActive = pathname === '/' || pathname === '/overview';
  // Home link active on / only (distinct from the N logo)
  const homeActive = pathname === '/' || pathname === '/overview';

  return (
    <nav
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: 64,
        minHeight: '100vh',
        background: 'var(--rail-bg, #1a1a2e)',
        paddingTop: 12,
        paddingBottom: 12,
        gap: 4,
      }}
    >
      {/* N — property logo / brand mark */}
      <Link
        href="/"
        title="Home"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          borderRadius: 8,
          background: 'var(--brand-primary, #c8a96e)',
          color: '#fff',
          fontWeight: 800,
          fontSize: 20,
          textDecoration: 'none',
          marginBottom: 4,
        }}
      >
        N
      </Link>

      {/* Home link — sits between N logo and first pillar */}
      <Link
        href="/"
        title="Home"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: 48,
          height: 48,
          borderRadius: 8,
          textDecoration: 'none',
          fontSize: 10,
          fontWeight: 600,
          gap: 2,
          color: homeActive
            ? 'var(--rail-active-fg, #fff)'
            : 'var(--rail-fg, rgba(255,255,255,0.6))',
          background: homeActive
            ? 'var(--rail-active-bg, rgba(255,255,255,0.15))'
            : 'transparent',
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>⌂</span>
        <span>Home</span>
      </Link>

      {/* Pillar divider */}
      <div
        style={{
          width: 32,
          height: 1,
          background: 'rgba(255,255,255,0.12)',
          marginBottom: 4,
        }}
      />

      {/* Pillar nav items */}
      {PILLARS.map(renderItem)}

      {/* Spacer pushes utility items to bottom */}
      <div style={{ flex: 1 }} />

      {/* Utility nav items */}
      {UTILITY.map(renderItem)}
    </nav>
  );
}
