'use client';

// app/holding/it/cockpit/sitemap/page.tsx
// v3: clean indented accordion tree + property switcher (Holding | Namkhan | Donna)
// Before/After restructuring panel preserved for IT Cockpit section.
// PBS 2026-07-25.

import { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { GROUPS } from '../_lib/groups';

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
      { label: 'Properties', url: '/holding/properties', status: 'new' },
      { label: 'Users & Access', url: '/holding/users', status: 'new' },
      { label: 'Bugs', url: '/holding/bugs' },
      { label: 'Settings', url: '/holding/settings' },
    ],
  },
  {
    key: 'cockpit', label: 'IT Cockpit', color: AREA_COLOR.cockpit,
    pages: [
      { label: 'Home — fleet at a glance', url: '/holding/it/cockpit' },
      { label: 'Fleet', url: '/holding/it/cockpit/team', children: [
        { label: 'Team', url: '/holding/it/cockpit/team' },
        { label: 'Skills', url: '/holding/it/cockpit/skills' },
        { label: 'Memory', url: '/holding/it/cockpit/knowledge' },
      ]},
      { label: 'Knowledge', url: '/holding/it/cockpit/docs', children: [
        { label: 'All Docs', url: '/holding/it/cockpit/docs' },
        { label: 'Schemas', url: '/holding/it/cockpit/schemas' },
        { label: 'Freshness', url: '/holding/it/cockpit/freshness' },
        { label: 'Sitemap', url: '/holding/it/cockpit/sitemap', status: 'new' },
        { label: 'Platform Map', url: '/holding/it/cockpit/platform-map', status: 'new' },
      ]},
      { label: 'Inventory group', url: '/cockpit/supabase', status: 'warn', desc: 'Broken link — pending removal' },
      { label: 'Ops', url: '/holding/it/cockpit/tasks', children: [
        { label: 'Tasks', url: '/holding/it/cockpit/tasks' },
        { label: 'Activity', url: '/holding/it/cockpit/activity' },
        { label: 'Chat', url: '/holding/it/cockpit/chat' },
        { label: 'Health', url: '/holding/it/cockpit/health' },
        { label: 'Alerts', url: '/holding/it/cockpit/notify', status: 'new', desc: 'Promoted from orphan' },
      ]},
      { label: 'Build', url: '/holding/it/cockpit/deploys', children: [
        { label: 'Deploys', url: '/holding/it/cockpit/deploys', desc: 'Live Vercel-style dashboard' },
        { label: 'Checks', url: '/holding/it/cockpit/checks' },
        { label: 'Cost', url: '/holding/it/cockpit/cost' },
        { label: 'Module Docs', url: '/holding/it/cockpit/specs' },
        { label: '+ New spec', url: '/holding/it/cockpit/specs/new' },
      ]},
    ],
  },
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

// ── Restructuring changes (Before/After for Cockpit) ─────────────────────────

const CHANGES = [
  { type: 'remove', label: 'Remove Inventory group', detail: 'Was linking to /cockpit/supabase (404).' },
  { type: 'add',    label: 'Add "Alerts" to Ops', detail: 'Promotes orphan /cockpit/notify page.' },
  { type: 'add',    label: 'Add "Platform Map" to Knowledge', detail: 'Promotes orphan page.' },
  { type: 'remove', label: 'cockpit/users → redirect to /holding/users', detail: 'Duplicate page.' },
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
  const [restructureView, setRestructureView] = useState<'current' | 'proposed'>('current');
  const [search, setSearch] = useState('');
  const [executing, startExecute] = useTransition();
  const [done, setDone] = useState(false);
  const [execErr, setExecErr] = useState<string | null>(null);

  const selectedProp = PROPERTIES.find(p => p.key === property) ?? PROPERTIES[0];

  // Count total pages
  const totalPages = useMemo(() => {
    let n = 0;
    for (const area of selectedProp.areas) {
      for (const page of area.pages) { n++; n += (page.children?.length ?? 0); }
    }
    return n;
  }, [selectedProp]);

  async function handleExecute() {
    startExecute(async () => {
      try {
        const res = await fetch('/api/cockpit/apply-nav-proposal', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        const j = await res.json();
        if (!res.ok) { setExecErr(j.error ?? 'Failed'); return; }
        setDone(true);
      } catch (e: any) { setExecErr(e.message); }
    });
  }

  return (
    <div style={{ padding: '20px 24px 64px', background: '#FFFFFF', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1B1B1B', margin: '0 0 2px' }}>Application Sitemap</h1>
          <p style={{ fontSize: 11, color: '#5A5A5A', margin: 0 }}>
            {totalPages}+ pages · {selectedProp.areas.length} areas · click any row to navigate
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

      {/* IT Cockpit restructuring panel — only on Holding */}
      {property === 'holding' && (
        <div style={{ marginBottom: 16, border: '1px solid #E6DFCC', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: '#FAFAF7', borderBottom: '1px solid #E6DFCC' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#5A5A5A', padding: '8px 14px', letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>
              IT Cockpit nav restructuring
            </div>
            {[{ key: 'current', label: 'Current' }, { key: 'proposed', label: 'Proposed' }].map(v => (
              <button key={v.key} onClick={() => setRestructureView(v.key as 'current' | 'proposed')} style={{
                fontSize: 11, fontWeight: 700, padding: '8px 16px', border: 'none', borderLeft: '1px solid #E6DFCC',
                cursor: 'pointer',
                background: restructureView === v.key ? '#1F3A2E' : '#FFFFFF',
                color: restructureView === v.key ? '#FFFFFF' : '#5A5A5A',
              }}>{v.label}</button>
            ))}
          </div>

          {restructureView === 'proposed' && (
            <div style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#1B1B1B', marginBottom: 8 }}>4 changes</div>
              {CHANGES.map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 5 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, flexShrink: 0,
                    background: c.type === 'remove' ? '#FFEBEE' : '#E8F5E9',
                    color: c.type === 'remove' ? '#D32F2F' : '#2E7D32' }}>
                    {c.type === 'remove' ? '✕ remove' : '+ add'}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#1B1B1B' }}>{c.label}</span>
                  <span style={{ fontSize: 10, color: '#8A8A8A' }}>{c.detail}</span>
                </div>
              ))}
              <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
                {done ? (
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#2E7D32' }}>✓ Executed — Vercel deploying</span>
                ) : (
                  <button onClick={handleExecute} disabled={executing} style={{ fontSize: 11, fontWeight: 700, padding: '6px 16px', borderRadius: 4, background: '#1F3A2E', color: '#FFFFFF', border: 'none', cursor: 'pointer', opacity: executing ? 0.6 : 1 }}>
                    {executing ? 'Executing…' : 'Execute restructuring →'}
                  </button>
                )}
                {execErr && <span style={{ fontSize: 11, color: '#D32F2F' }}>{execErr}</span>}
              </div>
            </div>
          )}
          {restructureView === 'current' && (
            <div style={{ padding: '8px 14px 4px', fontSize: 11, color: '#5A5A5A' }}>
              ⚠ Inventory group has broken link · notify, platform-map, cockpit/users are orphan pages · switch to Proposed to review changes.
            </div>
          )}
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
