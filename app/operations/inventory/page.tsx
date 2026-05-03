// app/operations/inventory/page.tsx
//
// Inventory snapshot — Phase 2.5 module landing.
//
// Layout:
//   1. KPI strip (12 tiles spanning items, value, POs, suppliers, FA NBV, capex)
//   2. Heatmap: category × location stock health (OK/LOW/OUT/OVR)
//   3. Three side-by-side tables: open POs · open requests · capex pipeline
//   4. Suppliers strip (top 5 by reliability)
//   5. Quick-link grid to sub-routes

import Link from 'next/link';
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import { fmtMoney, EMPTY } from '@/lib/format';
import {
  getInventorySnapshot,
  getStockHeatmap,
  getCapexPipeline,
  getOpenPOs,
  getOpenRequests,
  getGlSupplierKpis,
} from './_data';
import Heatmap from './_components/Heatmap';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

const QUICK_LINKS: Array<{ href: string; label: string; description: string; status: 'live' | 'planned' }> = [
  { href: '/operations/inventory/stock',     label: 'Stock',           description: 'On-hand · days of cover · slow movers · expiring', status: 'live' },
  { href: '/operations/inventory/par',       label: 'Par levels',      description: 'Items below par + reorder $ value',               status: 'live' },
  { href: '/operations/inventory/suppliers', label: 'Suppliers',       description: 'Vendor register + contacts + price history',       status: 'live' },
  { href: '/operations/inventory/catalog',   label: 'Catalog admin',   description: 'Item master + bulk CSV upload',                    status: 'live' },
  { href: '/operations/inventory/orders',    label: 'Purchase orders', description: 'PO list + receiving (Phase 2.5b)',                 status: 'planned' },
  { href: '/operations/inventory/requests',  label: 'Requests',        description: 'Department PR queue + approvals (Phase 2.5b)',     status: 'planned' },
  { href: '/operations/inventory/assets',    label: 'Fixed assets',    description: 'FF&E register + depreciation (Phase 2.5b)',        status: 'planned' },
  { href: '/operations/inventory/capex',     label: 'CapEx pipeline',  description: 'Proposed → approved capital (Phase 2.5b)',         status: 'planned' },
];

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  draft:               { bg: '#eee9d8', fg: '#6c5d2a' },
  sent:                { bg: '#fbecc4', fg: '#7d5a18' },
  partially_received:  { bg: '#d6e6f1', fg: '#1f4f6e' },
  received:            { bg: '#dcebe0', fg: '#2f6f3a' },
  invoiced:            { bg: '#dcebe0', fg: '#2f6f3a' },
  closed:              { bg: '#e3dfd3', fg: 'var(--ink-soft)' },
  cancelled:           { bg: '#f5d4d0', fg: '#8a3026' },
  submitted:           { bg: '#fbecc4', fg: '#7d5a18' },
  pending_gm:          { bg: '#fbecc4', fg: '#7d5a18' },
  pending_owner:       { bg: '#fbecc4', fg: '#7d5a18' },
  auto_approved:       { bg: '#dcebe0', fg: '#2f6f3a' },
  approved:            { bg: '#dcebe0', fg: '#2f6f3a' },
  rejected:            { bg: '#f5d4d0', fg: '#8a3026' },
  proposed:            { bg: '#eee9d8', fg: '#6c5d2a' },
  under_review:        { bg: '#fbecc4', fg: '#7d5a18' },
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#8a3026',
  high:   '#7d5a18',
  normal: 'var(--ink-soft)',
  low:    'var(--ink-faint)',
};

function StatusPill({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: 'var(--paper-deep, #f6f3ec)', fg: 'var(--ink-soft)' };
  return (
    <span style={{
      background: c.bg,
      color: c.fg,
      padding: '2px 6px',
      fontFamily: 'var(--mono)',
      fontSize: 'var(--t-xs)',
      letterSpacing: 'var(--ls-extra)',
      textTransform: 'uppercase',
      borderRadius: 2,
      whiteSpace: 'nowrap',
    }}>{status.replace(/_/g, ' ')}</span>
  );
}

export default async function InventoryOverviewPage() {
  const [snap, heatmap, capex, pos, prs, glKpis] = await Promise.all([
    getInventorySnapshot(),
    getStockHeatmap(),
    getCapexPipeline(),
    getOpenPOs(),
    getOpenRequests(),
    getGlSupplierKpis(),
  ]);

  return (
    <>
      <PageHeader
        pillar="Operations"
        tab="Inventory · Snapshot"
        title={<>Property <em style={{ color: 'var(--brass)' }}>inventory</em></>}
        lede={<>Catalog · stock · suppliers · purchasing · fixed assets. Live from <code style={{ fontFamily: 'var(--mono)' }}>inv</code> · <code style={{ fontFamily: 'var(--mono)' }}>fa</code> · <code style={{ fontFamily: 'var(--mono)' }}>suppliers</code> · <code style={{ fontFamily: 'var(--mono)' }}>proc</code> schemas.</>}
      />

      {/* === KPI strip — 6 tiles === */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: 12,
        marginTop: 18,
      }}>
        <KpiBox value={snap.inventoryValueUsd} unit="usd" label="Inv on hand" tooltip={`${snap.itemsActive} active items @ last cost`} />
        <KpiBox value={snap.belowPar} unit="count" label="Below par" tooltip="SKUs at or under reorder point at default location" />
        <KpiBox value={snap.slowMovers} unit="count" label="Slow movers" tooltip="No movement >60 days, qty > 0" />
        <KpiBox value={snap.openPosUsd} unit="usd" label="Open POs" tooltip={`${pos.filter(p => p.status !== 'received' && p.status !== 'closed').length} POs in flight`} />
        <KpiBox value={snap.pendingRequests} unit="count" label="Pending requests" tooltip="Requests awaiting GM/owner approval" />
        <KpiBox value={glKpis.vendor_count} unit="count" label="QB vendors" tooltip={`${glKpis.active_recent_count} active in last 90d · live from gl.v_supplier_overview`} />
        <KpiBox value={glKpis.ytd_gross_spend_usd} unit="usd" label="Vendor spend YTD" tooltip={`Top vendor: ${glKpis.top_vendor_name ?? '—'} (${glKpis.top_vendor_share_pct?.toFixed(1) ?? '—'}% share)`} />
        <KpiBox value={glKpis.anomaly_count} unit="count" label="Vendor anomalies" tooltip="Vendor × account combinations flagged in gl.v_supplier_account_anomalies" />
        <KpiBox value={snap.faNbvUsd} unit="usd" label="Fixed asset NBV" tooltip="Net book value, straight-line dep" />
        <KpiBox value={snap.capexApprovedUsd} unit="usd" label="CapEx approved" tooltip="Approved + not yet received" />
        <KpiBox value={snap.capexProposedUsd} unit="usd" label="CapEx proposed" tooltip="In pipeline, awaiting decision" />
        <KpiBox value={snap.itemsActive} unit="count" label="Active SKUs" />
        <KpiBox value={snap.wastageValueMtdUsd} unit="usd" label="Wastage MTD" tooltip="inv.movements WHERE movement_type='write_off' AND date >= month start · valued at recorded total_cost_usd" />
        <KpiBox value={snap.stockTurnAnnualized} unit="nights" label="Stock turn" dp={2} tooltip={`Annualized: 90d cogs ($${Math.round(snap.cogs90dUsd).toLocaleString()}) × 365/90 ÷ on-hand value ($${Math.round(snap.inventoryValueUsd).toLocaleString()})`} />
      </div>

      {/* === Heatmap === */}
      <h2 style={{
        marginTop: 28, marginBottom: 10,
        fontFamily: 'var(--mono)',
        fontSize: 'var(--t-xs)',
        letterSpacing: 'var(--ls-extra)',
        textTransform: 'uppercase',
        color: 'var(--brass)',
      }}>Stock health · category × location</h2>
      <Heatmap cells={heatmap} />

      {/* === 3-up: Open POs · Requests · CapEx === */}
      <div style={{
        marginTop: 28,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: 14,
      }}>
        {/* Open POs */}
        <div style={{ border: '1px solid var(--rule, #e3dfd3)', background: 'var(--paper, #fbf9f3)' }}>
          <div style={{
            padding: '8px 12px',
            fontFamily: 'var(--mono)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--ls-extra)',
            color: 'var(--brass)',
            fontSize: 'var(--t-xs)',
            borderBottom: '1px solid var(--rule, #e3dfd3)',
            background: 'var(--paper-deep, #f6f3ec)',
            display: 'flex',
            justifyContent: 'space-between',
          }}>
            <span>Open POs · {pos.filter(p => p.status !== 'received' && p.status !== 'closed').length}</span>
            <Link href="/operations/inventory/orders" style={{ color: 'var(--brass)', textDecoration: 'none' }}>open →</Link>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-sm)' }}>
            <tbody>
              {pos.slice(0, 6).map(p => (
                <tr key={p.po_number ?? Math.random()} style={{ borderBottom: '1px solid var(--rule, #e3dfd3)' }}>
                  <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{p.po_number ?? EMPTY}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--ink-soft)' }}>{p.vendor_name ?? EMPTY}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{fmtMoney(p.total_usd, 'USD')}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right' }}><StatusPill status={p.status} /></td>
                </tr>
              ))}
              {pos.length === 0 && (
                <tr><td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: 'var(--ink-soft)' }}>{EMPTY} no open POs</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Open Requests */}
        <div style={{ border: '1px solid var(--rule, #e3dfd3)', background: 'var(--paper, #fbf9f3)' }}>
          <div style={{
            padding: '8px 12px',
            fontFamily: 'var(--mono)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--ls-extra)',
            color: 'var(--brass)',
            fontSize: 'var(--t-xs)',
            borderBottom: '1px solid var(--rule, #e3dfd3)',
            background: 'var(--paper-deep, #f6f3ec)',
            display: 'flex',
            justifyContent: 'space-between',
          }}>
            <span>Requests · {prs.filter(r => !['approved','closed','rejected','converted_to_po'].includes(r.status)).length}</span>
            <Link href="/operations/inventory/requests" style={{ color: 'var(--brass)', textDecoration: 'none' }}>queue →</Link>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-sm)' }}>
            <tbody>
              {prs.slice(0, 6).map(r => (
                <tr key={r.pr_number ?? Math.random()} style={{ borderBottom: '1px solid var(--rule, #e3dfd3)' }}>
                  <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{r.pr_number ?? EMPTY}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--ink-soft)' }}>
                    {r.pr_title}
                    <div style={{ fontSize: 'var(--t-xs)', color: PRIORITY_COLORS[r.priority] ?? 'var(--ink-faint)', textTransform: 'uppercase', fontFamily: 'var(--mono)', letterSpacing: 'var(--ls-extra)' }}>
                      {r.requesting_dept ?? EMPTY} · {r.priority}
                    </div>
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{fmtMoney(r.total_estimated_usd, 'USD')}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right' }}><StatusPill status={r.status} /></td>
                </tr>
              ))}
              {prs.length === 0 && (
                <tr><td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: 'var(--ink-soft)' }}>{EMPTY} no open requests</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* CapEx pipeline */}
        <div style={{ border: '1px solid var(--rule, #e3dfd3)', background: 'var(--paper, #fbf9f3)' }}>
          <div style={{
            padding: '8px 12px',
            fontFamily: 'var(--mono)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--ls-extra)',
            color: 'var(--brass)',
            fontSize: 'var(--t-xs)',
            borderBottom: '1px solid var(--rule, #e3dfd3)',
            background: 'var(--paper-deep, #f6f3ec)',
            display: 'flex',
            justifyContent: 'space-between',
          }}>
            <span>CapEx pipeline · {capex.length}</span>
            <Link href="/operations/inventory/capex" style={{ color: 'var(--brass)', textDecoration: 'none' }}>open →</Link>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-sm)' }}>
            <tbody>
              {capex.slice(0, 6).map(c => (
                <tr key={c.capex_code ?? c.title} style={{ borderBottom: '1px solid var(--rule, #e3dfd3)' }}>
                  <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{c.capex_code ?? EMPTY}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--ink-soft)' }}>
                    {c.title}
                    <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-faint)', fontFamily: 'var(--mono)' }}>
                      FY{c.fiscal_year}{c.fiscal_quarter ? ` Q${c.fiscal_quarter}` : ''} · {c.category_code ?? EMPTY}
                    </div>
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{fmtMoney(c.estimated_cost_usd, 'USD')}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right' }}><StatusPill status={c.status} /></td>
                </tr>
              ))}
              {capex.length === 0 && (
                <tr><td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: 'var(--ink-soft)' }}>{EMPTY} no proposals</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* === Suppliers strip removed 2026-05-03 — replaced by live gl-driven /suppliers page (135 vendors) ===
          KPIs above show: QB vendors / Vendor spend YTD / Vendor anomalies (live from gl.*).
          Click "Suppliers" in the sub-nav for the full vendor register + click-through detail. */}

      {/* === Quick links === */}
      <h2 style={{
        marginTop: 28, marginBottom: 10,
        fontFamily: 'var(--mono)',
        fontSize: 'var(--t-xs)',
        letterSpacing: 'var(--ls-extra)',
        textTransform: 'uppercase',
        color: 'var(--brass)',
      }}>Inventory routes</h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
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
              <div style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-lg)', fontStyle: 'italic', marginBottom: 2 }}>{q.label}</div>
              <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-soft)' }}>{q.description}</div>
              {q.status !== 'live' && (
                <div style={{ marginTop: 6, fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)' }}>Coming soon</div>
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
