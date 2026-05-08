'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// ─── Nav structure ────────────────────────────────────────────────────────────
const NAV = [
  {
    pillar: 'Overview',
    href: '/overview',
    icon: '◈',
  },
  {
    pillar: 'Revenue',
    icon: '◈',
    children: [
      { label: 'Compset',  href: '/revenue/compset' },
      { label: 'Parity',   href: '/revenue/parity' },
      { label: 'Channels', href: '/revenue/channels' },
      { label: 'Pace',     href: '/revenue/pace' },
      { label: 'Pricing',  href: '/revenue/pricing' },
    ],
  },
  {
    pillar: 'Sales',
    icon: '◈',
    children: [
      { label: 'Inquiries', href: '/sales/inquiries' },
      { label: 'Leads',     href: '/sales/leads' },
      { label: 'Pipeline',  href: '/sales/pipeline' },
      { label: 'B2B',       href: '/sales/b2b' },
      { label: 'Bookings',  href: '/sales/bookings' },
    ],
  },
  {
    pillar: 'Guest',
    icon: '◈',
    children: [
      { label: 'Directory',  href: '/guest/directory' },
      { label: 'Pre-Arrival', href: '/guest/pre-arrival' },
      { label: 'Reviews',    href: '/guest/reviews' },
    ],
  },
  {
    pillar: 'Operations',
    icon: '◈',
    children: [
      { label: 'Today',     href: '/operations/today' },
      { label: 'Restaurant', href: '/operations/restaurant' },
      { label: 'Spa',       href: '/operations/spa' },
      { label: 'Inventory', href: '/operations/inventory' },
      { label: 'Suppliers', href: '/operations/suppliers' },
      { label: 'Staff',     href: '/operations/staff' },
    ],
  },
  {
    pillar: 'Finance',
    icon: '◈',
    children: [
      { label: 'Ledger',    href: '/finance/ledger' },
      { label: 'P&L',       href: '/finance/pl' },
      { label: 'Cash Flow', href: '/finance/cash-flow' },
    ],
  },
  {
    pillar: 'Marketing',
    icon: '◈',
    children: [
      { label: 'Library',   href: '/marketing/library' },
      { label: 'Campaigns', href: '/marketing/campaigns' },
      { label: 'BDC',       href: '/marketing/bdc' },
      { label: 'Reviews',   href: '/marketing/reviews' },
    ],
  },
  {
    pillar: 'Cockpit',
    href: '/cockpit',
    icon: '◈',
  },
  {
    pillar: 'Settings',
    icon: '◈',
    children: [
      { label: 'Cockpit',      href: '/settings/cockpit' },
      { label: 'Platform Map', href: '/settings/platform-map' },
    ],
  },
];

// ─── Logo mark — brass "N", no green stripe ───────────────────────────────────
function LogoMark() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '20px 18px 16px',
      borderBottom: '1px solid var(--border-soft)',
      // NO green stripe — intentionally omitted per design update
    }}>
      {/* Brass N lettermark */}
      <span style={{
        fontFamily: 'var(--font-serif, "Fraunces", Georgia, serif)',
        fontStyle: 'italic',
        fontWeight: 700,
        fontSize: 28,
        lineHeight: 1,
        color: 'var(--brass, #c79a6b)',
        letterSpacing: '-0.5px',
        userSelect: 'none',
      }}>
        N
      </span>
      <span style={{
        fontFamily: 'var(--font-serif, "Fraunces", Georgia, serif)',
        fontStyle: 'italic',
        fontSize: 13,
        color: 'var(--text-muted, #888)',
        letterSpacing: '0.02em',
        lineHeight: 1.2,
      }}>
        Namkhan<br />
        <span style={{ fontSize: 10, opacity: 0.7 }}>Intelligence</span>
      </span>
    </div>
  );
}

// ─── Single nav item ──────────────────────────────────────────────────────────
function NavItem({ label, href }: { label: string; href: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + '/');
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        padding: '6px 18px 6px 28px',
        fontSize: 13,
        fontFamily: 'var(--font-mono, monospace)',
        color: active ? 'var(--brass, #c79a6b)' : 'var(--text-muted, #888)',
        textDecoration: 'none',
        borderLeft: active ? '2px solid var(--brass, #c79a6b)' : '2px solid transparent',
        background: active ? 'rgba(199,154,107,0.06)' : 'transparent',
        transition: 'color 0.15s, background 0.15s',
      }}
    >
      {label}
    </Link>
  );
}

// ─── Pillar group ─────────────────────────────────────────────────────────────
function PillarGroup({
  pillar,
  href,
  children,
}: {
  pillar: string;
  href?: string;
  children?: { label: string; href: string }[];
}) {
  const pathname = usePathname();
  const isActive = href
    ? pathname === href
    : children?.some(c => pathname.startsWith(c.href));

  return (
    <div style={{ marginBottom: 4 }}>
      {href ? (
        <Link
          href={href}
          style={{
            display: 'block',
            padding: '7px 18px',
            fontSize: 11,
            fontFamily: 'var(--font-mono, monospace)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: isActive ? 'var(--brass, #c79a6b)' : 'var(--text-muted, #888)',
            textDecoration: 'none',
            fontWeight: 600,
            borderLeft: isActive ? '2px solid var(--brass, #c79a6b)' : '2px solid transparent',
          }}
        >
          {pillar}
        </Link>
      ) : (
        <div
          style={{
            padding: '7px 18px',
            fontSize: 11,
            fontFamily: 'var(--font-mono, monospace)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: isActive ? 'var(--brass, #c79a6b)' : 'var(--text-muted, #999)',
            fontWeight: 600,
          }}
        >
          {pillar}
        </div>
      )}
      {children?.map(c => (
        <NavItem key={c.href} label={c.label} href={c.href} />
      ))}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
export default function Sidebar() {
  return (
    <nav
      style={{
        width: 200,
        minWidth: 200,
        height: '100vh',
        position: 'sticky',
        top: 0,
        overflowY: 'auto',
        background: 'var(--panel, #15151a)',
        borderRight: '1px solid var(--border-soft, #222)',
        display: 'flex',
        flexDirection: 'column',
        // NO green top stripe
      }}
    >
      <LogoMark />
      <div style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
        {NAV.map(item => (
          <PillarGroup
            key={item.pillar}
            pillar={item.pillar}
            href={item.href}
            children={item.children}
          />
        ))}
      </div>
    </nav>
  );
}
