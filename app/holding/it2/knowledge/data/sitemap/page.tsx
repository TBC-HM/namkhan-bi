'use client';

// app/holding/it2/knowledge/data/sitemap/page.tsx
// Moved it2-native from /holding/it/cockpit/sitemap (it-area-reorg-v1 final
// slice). Changes vs v3: the IT area is now DERIVED from the live IT2 GROUPS
// nav spec (one fact = one surface — the sitemap can never drift from the
// nav again), and the pre-IT2 "restructuring Before/After" panel + its
// apply-nav-proposal executor are retired (that restructuring shipped as
// /holding/it2; proposing the old nav again would be actively misleading).
// Property trees + switcher (Holding | Namkhan | Donna) preserved.

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { GROUPS } from '@/app/holding/it2/_lib/groups';

// ── Types ─────────────────────────────────────────────────────────────────────

type PageStatus = 'ok' | 'warn' | 'new';

type SitemapPage = {
  label: string;
  url: string;
  desc?: string;
  status?: PageStatus;
  children?: SitemapPage[];
};

type SitemapArea = {
  key: string;
  label: string;
  color: string;
  pages: SitemapPage[];
};

// ── Area color palette ────────────────────────────────────────────────────────

const AREA_COLOR: Record<string, string> = {
  holding: '#1F3A2E',
  revenue: '#1565C0',
  marketing: '#E65100',
  operations: '#2E7D32',
  sales: '#6A1B9A',
  finance: '#880E4F',
  guest: '#004D40',
  settings: '#5A5A5A',
  university: '#283593',
  mail: '#37474F',
  cockpit: '#1F3A2E',
};

// ── IT area — derived live from the IT2 nav spec (never hand-written) ─────────

const IT2_AREA: SitemapArea = {
  key: 'it2', label: 'IT (IT2)', color: AREA_COLOR.cockpit,
  pages: (GROUPS.map((g) => ({
    label: g.label,
    url: g.href,
    children: g.subs.map((s) => ({ label: s.label, url: s.href })),
  })) as SitemapPage[]).concat([
    { label: 'Decision Inbox', url: '/holding/it2/questions', desc: 'Linked from Action Center Zone 1' },
  ]),
};

// ── HOLDING tree ──────────────────────────────────────────────────────────────

const HOLDING_AREAS: SitemapArea[] = [
  {
    key: 'holding', label: 'Holding (BC)', color: AREA_COLOR.holding,
    pages: [
      { label: 'CEO dashboard', url: '/holding/ceo' },
      { label: 'Legal', url: '/holding/legal', children: [
        { label: 'Legal (Lao)', url: '/holding/legal-lao' },
      ]},
      { label: 'Finance', url: '/holding/finance', children: [
        { label: 'Clients', url: '/holding/finance/clients' },
        { label: 'Invoices', url: '/holding/finance/invoices' },
      ]},
      { label: 'Strategy', url: '/holding/strategy' },
      { label: 'Properties', url: '/holding/properties' },
      { label: 'Users & Access', url: '/holding/users' },
      { label: 'Bugs', url: '/holding/bugs' },
      { label: 'Settings', url: '/holding/settings' },
    ],
  },
  IT2_AREA,
];

// ── PROPERTY tree (shared structure, pid-parameterized) ───────────────────────

function propertyAreas(pid: number): SitemapArea[] {
  const base = `/h/${pid}`;
  return [
    {
      key: 'revenue', label: 'Revenue', color: AREA_COLOR.revenue,
      pages: [
        { label: 'HoD landing', url: base + '/revenue' },
        { label: 'Pulse — live KPIs', url: base + '/revenue/pulse' },
        { label: 'Briefing — guardrail conclusions', url: base + '/revenue/briefing' },
        { label: 'Pickup matrix', url: base + '/revenue/pickup' },
        { label: 'Pace tracking', url: base + '/revenue/pace' },
        { label: 'Demand analytics', url: base + '/revenue/demand' },
        { label: 'Markets — nationality / room heatmaps', url: base + '/revenue/markets' },
        { label: 'Competitive set', url: base + '/revenue/compset', children: [
          { label: '[hotel] deep landing', url: base + '/revenue/compset' },
        ]},
        { label: 'OTA parity', url: base + '/revenue/parity' },
        { label: 'Channels', url: base + '/revenue/channels', children: [
          { label: '[source] landing', url: base + '/revenue/channels/[source]' },
          { label: 'Promotions', url: base + '/revenue/promotions' },
          { label: 'Booking.com', url: base + '/revenue/channels/booking-com' },
          { label: 'Expedia', url: base + '/revenue/channels/expedia' },
        ]},
        { label: 'Rate plans', url: base + '/revenue/rateplans' },
        { label: 'Pricing', url: base + '/revenue/pricing', children: [
          { label: 'Calendar view', url: base + '/revenue/pricing/calendar' },
        ]},
        { label: 'Room inventory', url: base + '/revenue/inventory' },
        { label: 'Reports', url: base + '/revenue/reports', children: [
          { label: 'Render', url: base + '/revenue/reports/render' },
          { label: 'Scheduled', url: base + '/revenue/reports/scheduled' },
        ]},
        { label: 'Leakage analysis', url: base + '/revenue/leakage' },
        { label: 'Lighthouse rate shop', url: base + '/revenue/lighthouse' },
        { label: 'Forecasts', url: base + '/revenue/forecasts' },
        { label: 'Cancellations', url: base + '/revenue/cancellations' },
      ],
    },
    {
      key: 'marketing', label: 'Marketing', color: AREA_COLOR.marketing,
      pages: [
        { label: 'HoD landing', url: base + '/marketing' },
        { label: 'Overview — real KPIs', url: base + '/marketing/overview' },
        { label: 'Audience groups', url: base + '/marketing/audience' },
        { label: 'Campaigns', url: base + '/marketing/campaigns', children: [
          { label: 'New campaign', url: base + '/marketing/campaigns/new' },
          { label: '[id]', url: base + '/marketing/campaigns/[id]' },
        ]},
        { label: 'Media', url: base + '/marketing/media', children: [
          { label: 'Pics (approved photos)', url: base + '/marketing/media' },
          { label: 'Videos', url: base + '/marketing/media' },
          { label: 'Clarify (triage)', url: base + '/marketing/media' },
          { label: 'Coverage matrix', url: base + '/marketing/media' },
          { label: 'OTA Profiles', url: base + '/marketing/media/profiles' },
        ]},
        { label: 'YouTube', url: base + '/marketing/youtube', children: [
          { label: 'Dashboard', url: base + '/marketing/youtube' },
          { label: 'Playlists', url: base + '/marketing/youtube/playlists' },
          { label: 'Planning', url: base + '/marketing/youtube/planning' },
          { label: 'Production', url: base + '/marketing/youtube/production' },
        ]},
        { label: 'Google Business Profile', url: base + '/marketing/social/google-business' },
        { label: 'Subscribers', url: base + '/marketing/subscribers' },
        { label: 'Compiler', url: base + '/marketing/compiler', status: 'warn', desc: 'Legacy design — pending modernize' },
      ],
    },
    {
      key: 'operations', label: 'Operations', color: AREA_COLOR.operations,
      pages: [
        { label: 'HoD landing', url: base + '/operations' },
        { label: 'Inventory', url: base + '/operations/inventory', children: [
          { label: 'Items', url: base + '/operations/inventory/items' },
          { label: 'Stock levels', url: base + '/operations/inventory/stock' },
          { label: 'Movements', url: base + '/operations/inventory/movements' },
          { label: 'Low stock alerts', url: base + '/operations/inventory/low-stock' },
          { label: 'Suppliers', url: base + '/operations/inventory/suppliers' },
          { label: 'Purchase orders', url: base + '/operations/inventory/purchase-orders' },
        ]},
        { label: 'QA proposals', url: base + '/operations/qa', children: [
          { label: 'Registry', url: base + '/operations/qa/registry' },
        ]},
        { label: 'SOPs', url: base + '/operations/sops', children: [
          { label: '[sop] preview/edit', url: base + '/operations/sops/[id]' },
          { label: 'Send as .doc', url: base + '/operations/sops/[id]/send' },
        ]},
        { label: 'Restaurant', url: base + '/operations/restaurant' },
        { label: 'Spa', url: base + '/operations/spa' },
        { label: 'Retail', url: base + '/operations/retail' },
        { label: 'Transport', url: base + '/operations/transport' },
        { label: 'Staff', url: base + '/operations/staff' },
        { label: 'Attendance', url: base + '/operations/attendance' },
        { label: 'Menus', url: base + '/operations/menus' },
        { label: 'Maintenance', url: base + '/operations/maintenance' },
        { label: 'Today tasks', url: base + '/operations/today' },
      ],
    },
    {
      key: 'sales', label: 'Sales', color: AREA_COLOR.sales,
      pages: [
        { label: 'HoD — Create New · Pipeline · Accounts', url: base + '/sales' },
        { label: 'Pipeline', url: base + '/sales/pipeline' },
        { label: 'Accounts', url: base + '/sales/accounts' },
        { label: 'Inquiries', url: base + '/sales/inquiries' },
        { label: 'Leads', url: base + '/sales/leads' },
        { label: 'Packages', url: base + '/sales/packages' },
        { label: 'Proposals', url: base + '/sales/proposals' },
        { label: 'Shared mailbox (book@ gm@)', url: base + '/sales/mails' },
      ],
    },
    {
      key: 'finance', label: 'Finance', color: AREA_COLOR.finance,
      pages: [
        { label: 'HoD landing', url: base + '/finance' },
        { label: 'P&L statement', url: base + '/finance/pnl' },
        { label: 'General ledger', url: base + '/finance/ledger' },
        { label: 'Budget', url: base + '/finance/budget' },
        { label: 'HR & Payroll', url: base + '/finance/hr', children: [
          { label: 'Schedule planner', url: base + '/finance/hr/schedule' },
          { label: 'Attendance', url: base + '/finance/hr/attendance' },
          { label: 'Onboarding', url: base + '/finance/hr/onboarding' },
          { label: 'Recruitment', url: base + '/finance/hr/recruitment' },
          { label: '[staff] payslip', url: base + '/finance/hr/[staffId]' },
        ]},
        { label: 'POS transactions', url: base + '/finance/pos' },
        { label: 'All transactions', url: base + '/finance/transactions' },
        { label: 'Reports', url: base + '/finance/reports' },
        { label: 'Archive', url: base + '/finance/archive' },
      ],
    },
    {
      key: 'guest', label: 'Guest', color: AREA_COLOR.guest,
      pages: [
        { label: 'HoD landing', url: base + '/guest' },
        { label: 'Newsletters — engine', url: base + '/guest/newsletters', children: [
          { label: 'Broadcasts', url: base + '/guest/newsletters' },
          { label: 'Sequences', url: base + '/guest/newsletters' },
          { label: 'AI Director Studio', url: base + '/guest/newsletters' },
        ]},
        { label: 'Reputation (Google + TripAdvisor)', url: base + '/guest/reputation' },
        { label: 'Retreats', url: base + '/guest/retreats', children: [
          { label: '[program] landing', url: base + '/guest/retreats/[program]' },
        ]},
        { label: 'Reviews', url: base + '/guest/reviews' },
        { label: 'Loyalty', url: base + '/guest/loyalty' },
        { label: 'Guest directory', url: base + '/guest/directory' },
        { label: 'Behaviour analytics', url: base + '/guest/behaviour' },
      ],
    },
    {
      key: 'settings', label: 'Settings', color: AREA_COLOR.settings,
      pages: [
        { label: 'Property config (12 tabs)', url: base + '/settings/property', children: [
          { label: 'Rooms', url: base + '/settings/property' },
          { label: 'Activities', url: base + '/settings/property' },
          { label: 'Facilities', url: base + '/settings/property' },
          { label: 'Transport', url: base + '/settings/property' },
          { label: 'Imekong boats', url: base + '/settings/property' },
          { label: 'Meeting spaces', url: base + '/settings/property' },
          { label: 'Identity', url: base + '/settings/property' },
          { label: 'Team', url: base + '/settings/property' },
          { label: 'Audience', url: base + '/settings/property' },
        ]},
        { label: 'Brain (AI settings)', url: base + '/settings/brain' },
        { label: 'Media (guardrails, channels, naming)', url: base + '/settings/media' },
        { label: 'Rate plans', url: base + '/settings/rate-plans' },
        { label: 'Guardrails', url: base + '/settings/guardrails' },
      ],
    },
  ];
}

// ── Properties ────────────────────────────────────────────────────────────────

const PROPERTIES = [
  { key: 'holding', label: 'Holding (BC)', areas: HOLDING_AREAS },
  { key: 'namkhan', label: 'The Namkhan', areas: propertyAreas(260955) },
  { key: 'donna',   label: 'Donna Mallorca', areas: propertyAreas(1000001) },
];

// ── Page row component ────────────────────────────────────────────────────────

function PageRow({ page, depth }: { page: SitemapPage; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = (page.children ?? []).length > 0;
  const isDynamic = page.url.includes('[');

  const statusColor = page.status === 'warn' ? '#B8542A' : page.status === 'new' ? '#2E7D32' : undefined;
  const statusBg = page.status === 'warn' ? '#FFF3E0' : page.status === 'new' ? '#E8F5E9' : undefined;

  return (
    <div style={{ marginLeft: depth * 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', minHeight: 26 }}>
        {/* Expand toggle */}
        {hasChildren ? (
          <button onClick={() => setOpen(v => !v)} style={{ width: 14, height: 14, border: 'none', background: 'none', cursor: 'pointer', color: '#8A8A8A', fontSize: 10, padding: 0, flexShrink: 0 }}>
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span style={{ width: 14, flexShrink: 0, fontSize: 10, color: '#C8C0B0' }}>└</span>
        )}

        {/* Link or text */}
        {isDynamic ? (
          <span style={{ fontSize: 12, color: '#1565C0', fontStyle: 'italic' }}>{page.label}</span>
        ) : (
          <Link href={page.url} style={{ fontSize: 12, color: statusColor ?? '#1B1B1B', textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
            {page.label}
          </Link>
        )}

        {/* Status badge */}
        {page.status && (
          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99, background: statusBg, color: statusColor, letterSpacing: '0.05em', textTransform: 'uppercase' as const, flexShrink: 0 }}>
            {page.status === 'warn' ? '⚠' : page.status === 'new' ? 'new' : ''}
          </span>
        )}

        {/* Description */}
        {page.desc && <span style={{ fontSize: 10, color: '#8A8A8A' }}>{page.desc}</span>}

        {/* URL chip */}
        <code style={{ fontSize: 9, color: '#8A8A8A', background: '#F9F7F2', padding: '1px 4px', borderRadius: 3, fontFamily: 'monospace', marginLeft: 'auto', flexShrink: 0, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {page.url}
        </code>
      </div>

      {/* Children */}
      {open && hasChildren && (
        <div style={{ borderLeft: '1px solid #F0EBE0', marginLeft: 7 }}>
          {(page.children ?? []).map((child, i) => (
            <PageRow key={i} page={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Area accordion ────────────────────────────────────────────────────────────

function AreaSection({ area, defaultOpen = true }: { area: SitemapArea; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const totalPages = area.pages.reduce((n, p) => n + 1 + (p.children?.length ?? 0), 0);

  return (
    <div style={{ border: '1px solid #E6DFCC', borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
      <button onClick={() => setOpen(v => !v)} style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px',
        background: '#FAFAF7', border: 'none', cursor: 'pointer', textAlign: 'left',
      }}>
        <span style={{ fontSize: 14, color: area.color }}>{open ? '▾' : '▸'}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: area.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {area.label}
        </span>
        <span style={{ fontSize: 10, color: '#8A8A8A', marginLeft: 4 }}>{totalPages} pages</span>
      </button>
      {open && (
        <div style={{ padding: '6px 14px 10px' }}>
          {area.pages.map((page, i) => (
            <PageRow key={i} page={page} depth={0} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SitemapPage() {
  const [property, setProperty] = useState('holding');
  const [search, setSearch] = useState('');

  const selectedProp = PROPERTIES.find(p => p.key === property) ?? PROPERTIES[0];

  // Count total pages
  const totalPages = useMemo(() => {
    let n = 0;
    for (const area of selectedProp.areas) {
      for (const page of area.pages) { n++; n += (page.children?.length ?? 0); }
    }
    return n;
  }, [selectedProp]);

  return (
    <div style={{ padding: '20px 24px 64px', background: '#FFFFFF', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1B1B1B', margin: '0 0 2px' }}>Application Sitemap</h1>
          <p style={{ fontSize: 11, color: '#5A5A5A', margin: 0 }}>
            {totalPages}+ pages · {selectedProp.areas.length} areas · click any row to navigate · IT area mirrors the live IT2 nav spec
          </p>
        </div>

        {/* Property switcher */}
        <div style={{ display: 'flex', border: '1px solid #E6DFCC', borderRadius: 6, overflow: 'hidden', marginLeft: 'auto' }}>
          {PROPERTIES.map(p => (
            <button key={p.key} onClick={() => setProperty(p.key)} style={{
              fontSize: 11, fontWeight: 700, padding: '7px 16px', border: 'none', cursor: 'pointer',
              background: property === p.key ? '#1F3A2E' : '#FFFFFF',
              color: property === p.key ? '#FFFFFF' : '#5A5A5A',
              letterSpacing: '0.04em',
              borderRight: p.key !== 'donna' ? '1px solid #E6DFCC' : 'none',
            }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <input
        type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Filter pages…"
        style={{ fontSize: 12, padding: '7px 12px', border: '1px solid #E6DFCC', borderRadius: 4, background: '#FFFFFF', color: '#1B1B1B', outline: 'none', width: 260, marginBottom: 16 }}
      />

      {/* Info note for Namkhan/Donna */}
      {property !== 'holding' && (
        <div style={{ padding: '8px 12px', background: '#F4EFE2', borderRadius: 4, marginBottom: 16, fontSize: 11, color: '#5A5A5A' }}>
          Structure is identical across properties — only the property_id changes.
          Use <strong>Holding Settings → Property Menu Matrix</strong> to hide specific areas per hotel.
          {property === 'donna' && <span style={{ marginLeft: 6, color: '#1565C0', fontWeight: 600 }}>· Donna uses Factorial (HR Schedule = read-only)</span>}
        </div>
      )}

      {/* Property menu matrix teaser */}
      {property !== 'holding' && (
        <div style={{ padding: '8px 12px', background: '#EEF4FF', border: '1px solid #C5D8F8', borderRadius: 4, marginBottom: 16, fontSize: 11, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#1565C0', fontWeight: 700 }}>📋 Property Menu Matrix</span>
          <span style={{ color: '#5A5A5A' }}>Coming in Holding Settings — toggle any area on/off per property. Auto-applies to new hotels when onboarded.</span>
          <Link href="/holding/settings" style={{ fontSize: 11, fontWeight: 700, color: '#1565C0', textDecoration: 'none', marginLeft: 'auto', flexShrink: 0 }}>Settings →</Link>
        </div>
      )}

      {/* Area accordions — filter applied */}
      {selectedProp.areas.map((area, i) => {
        if (search) {
          const lower = search.toLowerCase();
          const matchingPages = area.pages.filter(p =>
            p.label.toLowerCase().includes(lower) || p.url.toLowerCase().includes(lower) ||
            p.children?.some(c => c.label.toLowerCase().includes(lower) || c.url.toLowerCase().includes(lower))
          );
          if (matchingPages.length === 0) return null;
          return <AreaSection key={area.key} area={{ ...area, pages: matchingPages }} defaultOpen={true} />;
        }
        return <AreaSection key={area.key} area={area} defaultOpen={i < 2} />;
      })}

      {/* Legend */}
      <div style={{ marginTop: 20, display: 'flex', gap: 16, fontSize: 10, color: '#8A8A8A', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, color: '#1B1B1B' }}>Legend:</span>
        <span><span style={{ fontStyle: 'italic', color: '#1565C0' }}>[brackets]</span> = dynamic route</span>
        <span style={{ color: '#B8542A', fontWeight: 700 }}>⚠</span><span>needs attention</span>
        <span style={{ color: '#2E7D32', fontWeight: 700 }}>new</span><span>recently added</span>
        <span>▸ = collapsed · ▾ = expanded · click to toggle</span>
      </div>
    </div>
  );
}
