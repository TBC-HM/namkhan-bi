// app/holding/it/cockpit/sitemap/page.tsx
// Dynamic application sitemap — derived from live GROUPS config + known app tree.
// PBS 2026-07-25. Lives under Knowledge → Sitemap.

import Link from 'next/link';
import { GROUPS } from '../_lib/groups';

export const dynamic = 'force-dynamic';

// ── Full app route tree (kept here, updated when routes change) ──────────────
const APP_TREE = [
  {
    area: 'Holding', color: '#1F3A2E', prefix: '/holding',
    routes: [
      { url: '/holding/it', label: 'IT · HoD landing (Module Docs)' },
      { url: '/holding/ceo', label: 'CEO dashboard' },
      { url: '/holding/legal', label: 'Legal' },
      { url: '/holding/finance', label: 'Finance (clients + invoices)' },
      { url: '/holding/strategy', label: 'Strategy' },
      { url: '/holding/bugs', label: 'Bugs' },
      { url: '/holding/properties', label: 'Properties portfolio' },
      { url: '/holding/users', label: 'Users & Access' },
    ],
  },
  {
    area: 'Revenue', color: '#1565C0', prefix: '/revenue',
    note: 'Also at /h/[pid]/revenue/*',
    routes: [
      { url: '/revenue', label: 'HoD landing' },
      { url: '/revenue/pulse', label: 'Pulse — live KPIs' },
      { url: '/revenue/briefing', label: 'Briefing — guardrail conclusions' },
      { url: '/revenue/pickup', label: 'Pickup matrix' },
      { url: '/revenue/pace', label: 'Pace tracking' },
      { url: '/revenue/demand', label: 'Demand analytics' },
      { url: '/revenue/markets', label: 'Markets — nationality/room heatmaps' },
      { url: '/revenue/compset', label: 'Competitive set' },
      { url: '/revenue/parity', label: 'OTA parity' },
      { url: '/revenue/channels', label: 'Channel mix' },
      { url: '/revenue/channels/[source]', label: '→ Per-channel landing (dynamic)' },
      { url: '/revenue/rateplans', label: 'Rate plans' },
      { url: '/revenue/pricing', label: 'Pricing' },
      { url: '/revenue/inventory', label: 'Room inventory' },
      { url: '/revenue/rooms', label: 'Room type analytics' },
      { url: '/revenue/reports', label: 'Reports' },
      { url: '/revenue/leakage', label: 'Revenue leakage' },
      { url: '/revenue/lighthouse', label: 'Lighthouse rate shop' },
      { url: '/revenue/promotions', label: 'Promotions' },
      { url: '/revenue/forecasts', label: 'Demand forecasting' },
      { url: '/revenue/cancellations', label: 'Cancellations' },
    ],
  },
  {
    area: 'Marketing', color: '#E65100', prefix: '/marketing',
    note: 'Also at /h/[pid]/marketing/*',
    routes: [
      { url: '/marketing', label: 'HoD landing' },
      { url: '/marketing/overview', label: 'Overview — real KPIs' },
      { url: '/marketing/audience', label: 'Audience — groups + subscribers' },
      { url: '/marketing/campaigns', label: 'Campaigns' },
      { url: '/marketing/media', label: 'Media — photos + videos + AI Studio' },
      { url: '/marketing/media/profiles', label: '→ OTA media profiles' },
      { url: '/marketing/social/google-business', label: 'Google Business Profile' },
      { url: '/marketing/youtube', label: 'YouTube — dashboard + playlists + production' },
      { url: '/marketing/subscribers', label: 'Newsletter subscribers' },
      { url: '/marketing/compiler', label: 'Compiler ⚠️ legacy design' },
      { url: '/guest/newsletters', label: 'Newsletters (under Guest)' },
    ],
  },
  {
    area: 'Operations', color: '#2E7D32', prefix: '/operations',
    note: 'Also at /h/[pid]/operations/*',
    routes: [
      { url: '/operations', label: 'HoD landing' },
      { url: '/operations/inventory', label: 'Inventory (12 sub-pages)' },
      { url: '/operations/qa', label: 'QA proposals' },
      { url: '/operations/sops', label: 'SOPs' },
      { url: '/operations/restaurant', label: 'F&B' },
      { url: '/operations/spa', label: 'Spa' },
      { url: '/operations/retail', label: 'Retail' },
      { url: '/operations/transport', label: 'Transport' },
      { url: '/operations/rooms', label: 'Rooms' },
      { url: '/operations/staff', label: 'Staff' },
      { url: '/operations/maintenance', label: 'Maintenance' },
      { url: '/operations/menus', label: 'Menus' },
      { url: '/operations/today', label: 'Today' },
    ],
  },
  {
    area: 'Sales', color: '#6A1B9A', prefix: '/sales',
    note: 'Also at /h/[pid]/sales/*',
    routes: [
      { url: '/sales', label: 'HoD — Create New · Pipeline · Accounts' },
      { url: '/sales/pipeline', label: 'Pipeline' },
      { url: '/sales/accounts', label: 'Accounts' },
      { url: '/sales/inquiries', label: 'Inquiries' },
      { url: '/sales/packages', label: 'Packages' },
      { url: '/sales/leads', label: 'Leads' },
      { url: '/sales/mails', label: 'Shared mailbox' },
      { url: '/sales/proposals', label: 'Proposals' },
    ],
  },
  {
    area: 'Finance', color: '#880E4F', prefix: '/finance',
    note: 'Also at /h/[pid]/finance/*',
    routes: [
      { url: '/finance', label: 'HoD landing' },
      { url: '/finance/pnl', label: 'P&L' },
      { url: '/finance/ledger', label: 'General ledger' },
      { url: '/finance/budget', label: 'Budget' },
      { url: '/finance/hr', label: 'HR & payroll (8 sub-pages)' },
      { url: '/finance/pos', label: 'POS transactions' },
      { url: '/finance/transactions', label: 'All transactions' },
      { url: '/finance/reports', label: 'Reports' },
    ],
  },
  {
    area: 'Guest', color: '#004D40', prefix: '/guest',
    note: 'Also at /h/[pid]/guest/*',
    routes: [
      { url: '/guest', label: 'HoD landing' },
      { url: '/guest/reputation', label: 'Reputation (Google + TripAdvisor)' },
      { url: '/guest/newsletters', label: 'Newsletter engine' },
      { url: '/guest/reviews', label: 'Reviews' },
      { url: '/guest/retreats', label: 'Retreats' },
      { url: '/guest/loyalty', label: 'Loyalty' },
      { url: '/guest/directory', label: 'Guest directory' },
      { url: '/guest/behaviour', label: 'Behaviour analytics' },
      { url: '/guest/journey', label: 'Guest journey' },
    ],
  },
  {
    area: 'Settings', color: '#5A5A5A', prefix: '/settings',
    note: 'h/[pid]/settings/property has 12 tabs',
    routes: [
      { url: '/settings', label: 'Settings root' },
      { url: '/settings/users', label: 'Users & roles' },
      { url: '/h/[pid]/settings/property', label: 'Property (Rooms/Activities/Facilities/Transport/Imekong/Meeting/Identity/Team/Sidebar/Calendar/Audience)' },
      { url: '/h/[pid]/settings/brain', label: 'AI brain settings' },
      { url: '/h/[pid]/settings/media', label: 'Media settings (guardrails/channels/naming)' },
      { url: '/h/[pid]/settings/rate-plans', label: 'Rate plans' },
      { url: '/h/[pid]/settings/guardrails', label: 'Data quality rules' },
    ],
  },
  {
    area: 'University', color: '#283593', prefix: '/university',
    routes: [
      { url: '/university', label: 'Help engine' },
      { url: '/university/[slug]', label: '→ Article (dynamic)' },
      { url: '/university/ask', label: 'AI ask-window' },
    ],
  },
  {
    area: 'System / Legacy', color: '#8A8A8A', prefix: '/',
    routes: [
      { url: '/mail', label: 'Full-screen mail client' },
      { url: '/cockpit', label: 'Old system cockpit ⚠️ legacy' },
      { url: '/cockpit/supabase', label: 'DB management ⚠️ IT nav still links here' },
      { url: '/admin/gmail-connect', label: 'Gmail OAuth setup' },
    ],
  },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

function RouteRow({ url, label }: { url: string; label: string }) {
  const isWarning = label.includes('⚠️') || label.includes('legacy');
  const isDynamic = url.includes('[');
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline',
      padding: '4px 0', borderBottom: '1px solid #F4EFE2' }}>
      <code style={{ fontSize: 11, color: isWarning ? '#B8542A' : isDynamic ? '#1565C0' : '#1F3A2E',
        background: '#F9F7F2', padding: '1px 5px', borderRadius: 3, flexShrink: 0,
        minWidth: 240, fontFamily: 'monospace' }}>
        {url}
      </code>
      <span style={{ fontSize: 11, color: '#5A5A5A' }}>{label}</span>
      {!isDynamic && !isWarning && (
        <Link href={url} style={{ fontSize: 10, color: '#1F3A2E', marginLeft: 'auto',
          textDecoration: 'none', flexShrink: 0 }}>→</Link>
      )}
    </div>
  );
}

export default function SitemapPage() {
  const totalRoutes = APP_TREE.reduce((n, a) => n + a.routes.length, 0)
    + GROUPS.reduce((n, g) => n + 1 + g.subs.length, 0);

  return (
    <div style={{ maxWidth: 960, padding: '24px 24px 64px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1B1B1B', margin: '0 0 4px' }}>
          Application Sitemap
        </h1>
        <p style={{ fontSize: 12, color: '#5A5A5A', margin: 0 }}>
          ~{totalRoutes}+ routes · dynamic = reading live nav config · updated when groups.ts changes
        </p>
      </div>

      {/* IT Cockpit — derived from live GROUPS array */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: '#1F3A2E' }}>IT Cockpit</span>
          <span style={{ fontSize: 10, color: '#8A8A8A' }}>
            from live groups.ts · {GROUPS.length} groups · {GROUPS.reduce((n,g)=>n+g.subs.length,0)} sub-tabs
          </span>
          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 99,
            background: '#E8F5E9', color: '#2E7D32', fontWeight: 700 }}>LIVE</span>
        </div>
        <div style={{ border: '1px solid #E6DFCC', borderRadius: 6, overflow: 'hidden' }}>
          {GROUPS.map((g, gi) => (
            <div key={g.key} style={{ borderBottom: gi < GROUPS.length - 1 ? '1px solid #E6DFCC' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 14px', background: '#FAFAF7' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1B1B1B',
                  minWidth: 80 }}>{g.label}</span>
                <code style={{ fontSize: 11, color: '#1F3A2E', background: '#F4EFE2',
                  padding: '1px 6px', borderRadius: 3 }}>{g.href}</code>
                {g.href === '/cockpit/supabase' && (
                  <span style={{ fontSize: 9, color: '#B8542A', fontWeight: 700 }}>⚠️ BROKEN LINK</span>
                )}
              </div>
              {g.subs.map(s => (
                <div key={s.href} style={{ display: 'flex', gap: 8, alignItems: 'center',
                  padding: '5px 14px 5px 28px', borderTop: '1px solid #F4EFE2' }}>
                  <span style={{ fontSize: 10, color: '#8A8A8A' }}>└</span>
                  <Link href={s.href} style={{ fontSize: 11, color: '#1565C0',
                    textDecoration: 'none', flex: 1 }}>{s.label}</Link>
                  <code style={{ fontSize: 10, color: '#5A5A5A', background: '#F9F7F2',
                    padding: '1px 5px', borderRadius: 3 }}>{s.href}</code>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Full app tree */}
      {APP_TREE.map(area => (
        <section key={area.area} style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: area.color }}>{area.area}</span>
            <span style={{ fontSize: 10, color: '#8A8A8A' }}>
              {(area as any).note ?? ''}
            </span>
            <span style={{ fontSize: 10, color: '#8A8A8A', marginLeft: 4 }}>
              · {area.routes.length} routes
            </span>
          </div>
          <div style={{ border: '1px solid #E6DFCC', borderRadius: 6,
            overflow: 'hidden', padding: '4px 8px' }}>
            {area.routes.map((r: any) => <RouteRow key={r.url} url={r.url} label={r.label} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
