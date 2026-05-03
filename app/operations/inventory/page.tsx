// app/operations/inventory/page.tsx
//
// Inventory snapshot — landing page for the Phase 2.5 inventory module.
// Schemas live in `inv` / `fa` / `proc` / `suppliers` (NOT `qb.*` — that
// schema was reverted; see SUPABASE_STATE_HANDOVER.md line 127).
//
// Phase A scope (this deploy):
//   - 6 KPI tiles (counts; values come online once items are loaded)
//   - Quick links to Catalog Admin (with Upload Products button) and
//     placeholders for the other 7 spec pages.
//
// Empty-state friendly: every helper catches errors and returns null/0,
// so the page renders cleanly while inv.items is still empty.

import Link from 'next/link';
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface InvSnapshot {
  itemsTotal: number;
  itemsActive: number;
  locations: number;
  suppliers: number;
  pendingPos: number;
  capexProposed: number;
}

async function getSnapshot(): Promise<InvSnapshot> {
  const empty: InvSnapshot = { itemsTotal: 0, itemsActive: 0, locations: 0, suppliers: 0, pendingPos: 0, capexProposed: 0 };
  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[inventory/snapshot] supabaseAdmin', e);
    return empty;
  }
  const safe = async <T,>(p: PromiseLike<T>, fallback: T): Promise<T> => {
    try { return await Promise.resolve(p); } catch { return fallback; }
  };

  const [itemsAll, itemsActive, locs, sups, pos, capex] = await Promise.all([
    safe(admin.schema('inv').from('items').select('*', { count: 'exact', head: true }).then(r => r.count ?? 0), 0),
    safe(admin.schema('inv').from('items').select('*', { count: 'exact', head: true }).eq('is_active', true).then(r => r.count ?? 0), 0),
    safe(admin.schema('inv').from('locations').select('*', { count: 'exact', head: true }).eq('is_active', true).then(r => r.count ?? 0), 0),
    safe(admin.schema('suppliers').from('suppliers').select('*', { count: 'exact', head: true }).then(r => r.count ?? 0), 0),
    safe(admin.schema('proc').from('purchase_orders').select('*', { count: 'exact', head: true }).then(r => r.count ?? 0), 0),
    safe(admin.schema('fa').from('capex_pipeline').select('*', { count: 'exact', head: true }).then(r => r.count ?? 0), 0),
  ]);

  return {
    itemsTotal: itemsAll,
    itemsActive,
    locations: locs,
    suppliers: sups,
    pendingPos: pos,
    capexProposed: capex,
  };
}

const QUICK_LINKS: Array<{ href: string; label: string; description: string; status: 'live' | 'planned' }> = [
  { href: '/operations/inventory/catalog', label: 'Catalog Admin',  description: 'Manage items, bulk-upload from Cloudbeds CSV', status: 'live' },
  { href: '/operations/inventory/shop',     label: 'Shop',           description: 'HOD request UI', status: 'planned' },
  { href: '/operations/inventory/requests', label: 'Requests',       description: 'Purchase request queue', status: 'planned' },
  { href: '/operations/inventory/orders',   label: 'Orders',         description: 'PO Officer view', status: 'planned' },
  { href: '/operations/inventory/assets',   label: 'Assets',         description: 'Fixed assets register', status: 'planned' },
  { href: '/operations/inventory/capex',    label: 'CapEx Pipeline', description: 'Capital project queue', status: 'planned' },
];

export default async function InventoryOverviewPage() {
  const snap = await getSnapshot();

  return (
    <>
      <PageHeader
        pillar="Operations"
        tab="Inventory · Snapshot"
        title={<>Property <em style={{ color: 'var(--brass)' }}>inventory</em></>}
        lede={<>Catalog · stock · suppliers · purchasing · fixed assets. Phase 2.5 foundation — backend live, UI rolling out one route at a time.</>}
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: 12,
        marginTop: 18,
      }}>
        <KpiBox
          value={snap.itemsActive}
          unit="count"
          label="Items active"
          tooltip={`${snap.itemsTotal} total in catalog, ${snap.itemsActive} active`}
        />
        <KpiBox
          value={snap.locations}
          unit="count"
          label="Locations"
        />
        <KpiBox
          value={snap.suppliers}
          unit="count"
          label="Suppliers"
          state={snap.suppliers === 0 ? 'data-needed' : 'live'}
          needs={snap.suppliers === 0 ? 'Load supplier roster' : undefined}
        />
        <KpiBox
          value={snap.pendingPos}
          unit="count"
          label="Open POs"
        />
        <KpiBox
          value={snap.capexProposed}
          unit="count"
          label="CapEx pipeline"
        />
        <KpiBox
          value={null}
          unit="usd"
          label="Inv on hand"
          state="data-needed"
          needs="Items + counts required"
        />
      </div>

      <h2 style={{
        marginTop: 28,
        marginBottom: 10,
        fontFamily: 'var(--mono)',
        fontSize: 'var(--t-xs)',
        letterSpacing: 'var(--ls-extra)',
        textTransform: 'uppercase',
        color: 'var(--brass)',
      }}>Inventory routes</h2>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 10,
      }}>
        {QUICK_LINKS.map(q => {
          const cardStyle: React.CSSProperties = {
            display: 'block',
            padding: '12px 14px',
            border: '1px solid var(--rule, #e3dfd3)',
            background: q.status === 'live' ? 'var(--paper, #fbf9f3)' : 'transparent',
            textDecoration: 'none',
            color: 'var(--ink, #2c2a25)',
            cursor: q.status === 'live' ? 'pointer' : 'default',
            opacity: q.status === 'live' ? 1 : 0.55,
          };
          const inner = (
            <>
              <div style={{
                fontFamily: 'var(--serif)',
                fontSize: 'var(--t-lg)',
                fontStyle: 'italic',
                marginBottom: 2,
              }}>{q.label}</div>
              <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-soft)' }}>{q.description}</div>
              {q.status !== 'live' && (
                <div style={{
                  marginTop: 6,
                  fontFamily: 'var(--mono)',
                  fontSize: 'var(--t-xs)',
                  letterSpacing: 'var(--ls-extra)',
                  textTransform: 'uppercase',
                  color: 'var(--brass)',
                }}>Coming soon</div>
              )}
            </>
          );
          return q.status === 'live' ? (
            <Link key={q.href} href={q.href} style={cardStyle}>{inner}</Link>
          ) : (
            <div key={q.href} style={cardStyle} aria-disabled="true">{inner}</div>
          );
        })}
      </div>
    </>
  );
}
