'use client';

// components/nav/LeftRail.tsx
// 6-pillar architecture (v10 + Marketing restore 2026-04-30):
//   01 Revenue · 02 Sales · 03 Marketing · 04 Operations · 05 Guest · 06 Finance
// Bottom utility section: Knowledge · Settings.
// Click N at top → Home (overview lives at /).
// Note: Sales glyph is '$' to avoid collision with Settings 'S'.

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
        className={`rail-icon ${active ? 'active' : ''}`}
        title={it.label}
      >
        <span className="rail-glyph">{it.glyph}</span>
        <span>{it.label}</span>
      </Link>
    );
  };

  // Overview-active when on /overview or /
  const overviewActive = pathname === '/' || pathname === '/overview';

  return (
    <aside className="rail">
      <Link
        href="/overview"
        className={`rail-mark ${overviewActive ? 'active' : ''}`}
        title="The Namkhan · Home"
      >
        N
      </Link>
      {PILLARS.map(renderItem)}
      <div className="rail-divider" />
      {UTILITY.map(renderItem)}
    </aside>
  );
}
