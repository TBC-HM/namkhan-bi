'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* ─── Brand token ─────────────────────────────────────────────────────────── */
const BRASS = '#C9A84C';
const MOSS  = '#1a2e21';
const BG    = '#0d1f13';

/* ─── Nav tree ───────────────────────────────────────────────────────────── */
const NAV = [
  {
    label: 'Overview',
    href: '/overview',
    icon: '⌂',
  },
  {
    label: 'Revenue',
    icon: '₭',
    children: [
      { label: 'Dashboard',  href: '/revenue/dashboard' },
      { label: 'Pulse',      href: '/revenue/pulse' },
      { label: 'Comp Set',   href: '/revenue/compset' },
      { label: 'Parity',     href: '/revenue/parity' },
      { label: 'Channels',   href: '/revenue/channels' },
      { label: 'Pace',       href: '/revenue/pace' },
      { label: 'Pricing',    href: '/revenue/pricing' },
      { label: 'Engine',     href: '/revenue/engine' },
    ],
  },
  {
    label: 'Sales',
    icon: '◈',
    children: [
      { label: 'Dashboard',  href: '/sales/dashboard' },
      { label: 'Inquiries',  href: '/sales/inquiries' },
      { label: 'Leads',      href: '/sales/leads' },
      { label: 'B2B',        href: '/sales/b2b' },
      { label: 'Groups',     href: '/sales/groups' },
      { label: 'FIT',        href: '/sales/fit' },
      { label: 'Bookings',   href: '/sales/bookings' },
    ],
  },
  {
    label: 'Marketing',
    icon: '◉',
    children: [
      { label: 'Dashboard',  href: '/marketing/dashboard' },
      { label: 'Library',    href: '/marketing/library' },
      { label: 'Campaigns',  href: '/marketing/campaigns' },
      { label: 'Audiences',  href: '/marketing/audiences' },
      { label: 'Reviews',    href: '/marketing/reviews' },
      { label: 'BDC',        href: '/marketing/bdc' },
    ],
  },
  {
    label: 'Operations',
    icon: '⚙',
    children: [
      { label: 'Dashboard',  href: '/operations/dashboard' },
      { label: 'Today',      href: '/operations/today' },
      { label: 'Staff',      href: '/operations/staff' },
      { label: 'Restaurant', href: '/operations/restaurant' },
      { label: 'Inventory',  href: '/operations/inventory' },
      { label: 'Suppliers',  href: '/operations/suppliers' },
    ],
  },
  {
    label: 'Guest',
    icon: '✦',
    children: [
      { label: 'Dashboard',  href: '/guest/dashboard' },
      { label: 'Directory',  href: '/guest/directory' },
      { label: 'Journey',    href: '/guest/journey' },
      { label: 'Loyalty',    href: '/guest/loyalty' },
      { label: 'Reviews',    href: '/guest/reviews' },
    ],
  },
  {
    label: 'Finance',
    icon: '$',
    children: [
      { label: 'Dashboard',  href: '/finance/dashboard' },
      { label: 'P&L',        href: '/finance/pnl' },
      { label: 'Ledger',     href: '/finance/ledger' },
      { label: 'Budget',     href: '/finance/budget' },
    ],
  },
  {
    label: 'Cockpit',
    href: '/cockpit',
    icon: '⬡',
  },
] as const;

type NavLeaf   = { label: string; href: string };
type NavParent = { label: string; icon: string; children: readonly NavLeaf[] };
type NavRoot   = { label: string; href: string; icon: string };
type NavItem   = NavRoot | NavParent;

function isParent(item: NavItem): item is NavParent {
  return 'children' in item;
}

/* ─── Component ──────────────────────────────────────────────────────────── */
export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: 220,
        minHeight: '100vh',
        background: BG,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        // NO green top stripe — removed per design spec
      }}
    >
      {/* ── Logo ─────────────────────────────────────────────── */}
      <Link
        href="/"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '24px 20px 20px',
          textDecoration: 'none',
        }}
      >
        {/* Brass "N" — SVG inline so color is always correct */}
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <text
            x="50%"
            y="50%"
            dominantBaseline="central"
            textAnchor="middle"
            fontFamily="Georgia, serif"
            fontSize="26"
            fontWeight="700"
            fill={BRASS}
          >
            N
          </text>
        </svg>
        <span
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 15,
            fontWeight: 700,
            color: BRASS,
            letterSpacing: '0.06em',
            lineHeight: 1,
          }}
        >
          Namkhan
        </span>
      </Link>

      {/* ── Nav ──────────────────────────────────────────────── */}
      <nav style={{ flex: 1, padding: '4px 0 24px' }}>
        {(NAV as readonly NavItem[]).map((item) => {
          if (isParent(item)) {
            const anyActive = item.children.some((c) =>
              pathname.startsWith(c.href)
            );
            return (
              <SectionGroup
                key={item.label}
                item={item}
                pathname={pathname}
                defaultOpen={anyActive}
              />
            );
          }
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 20px',
                fontSize: 13,
                fontWeight: active ? 700 : 400,
                color: active ? BRASS : 'rgba(255,255,255,0.75)',
                textDecoration: 'none',
                background: active ? 'rgba(201,168,76,0.08)' : 'transparent',
                borderLeft: active ? `3px solid ${BRASS}` : '3px solid transparent',
                transition: 'background 0.15s',
              }}
            >
              <span style={{ fontSize: 14, width: 16, textAlign: 'center' }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* ── Footer brand line ─────────────────────────────────── */}
      <div
        style={{
          padding: '12px 20px',
          fontSize: 10,
          color: 'rgba(255,255,255,0.25)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          borderTop: `1px solid rgba(255,255,255,0.06)`,
        }}
      >
        Namkhan BI · SLH Member
      </div>
    </aside>
  );
}

/* ─── Collapsible section ────────────────────────────────────────────────── */
function SectionGroup({
  item,
  pathname,
  defaultOpen,
}: {
  item: NavParent;
  pathname: string;
  defaultOpen: boolean;
}) {
  // Simple CSS-only disclosure — no useState needed (avoids hydration mismatch)
  return (
    <details open={defaultOpen} style={{ listStyle: 'none' }}>
      <summary
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '9px 20px',
          fontSize: 12,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.45)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          userSelect: 'none',
          listStyle: 'none',
        }}
      >
        <span style={{ fontSize: 13, width: 16, textAlign: 'center' }}>{item.icon}</span>
        {item.label}
        <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.5 }}>▾</span>
      </summary>
      <div>
        {item.children.map((child) => {
          const active =
            pathname === child.href || pathname.startsWith(child.href + '/');
          return (
            <Link
              key={child.href}
              href={child.href}
              style={{
                display: 'block',
                padding: '7px 20px 7px 46px',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: active ? BRASS : 'rgba(255,255,255,0.65)',
                textDecoration: 'none',
                background: active ? 'rgba(201,168,76,0.07)' : 'transparent',
                borderLeft: active ? `3px solid ${BRASS}` : '3px solid transparent',
                transition: 'background 0.15s',
              }}
            >
              {child.label}
            </Link>
          );
        })}
      </div>
    </details>
  );
}
