// app/operations/inventory/suppliers/[id]/page.tsx
//
// Vendor detail — LIVE WIRED to gl.* schema.
// Routing key is encodeURIComponent(vendor_name); we decodeURIComponent here.
// Source: gl.v_supplier_overview + gl.vendors + gl.v_supplier_transactions
//         + gl.v_supplier_vendor_account + gl.v_supplier_account_anomalies.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import Page from '@/components/page/Page';
import { OPERATIONS_SUBPAGES } from '../../../_subpages';
import KpiBox from '@/components/kpi/KpiBox';
import StatusPill from '@/components/ui/StatusPill';
import { fmtIsoDate, EMPTY } from '@/lib/format';
import { getGlVendorDetail } from '../../_data';
import {
  AccountSplitsTable,
  AnomaliesTable,
  TransactionsTable,
} from './_GlDetailTablesClient';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

const sectionH: React.CSSProperties = {
  marginTop: 28,
  marginBottom: 10,
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)',
  textTransform: 'uppercase',
  color: 'var(--brass)',
};

const metaRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: 12,
  marginTop: 10,
  padding: '12px 14px',
  background: 'var(--paper-warm)',
  borderLeft: '3px solid var(--brass)',
  fontSize: 'var(--t-sm)',
  color: 'var(--ink-soft)',
};

const metaLabel: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)',
  textTransform: 'uppercase',
  color: 'var(--ink-mute)',
  marginBottom: 2,
};

function spanDays(first: string | null, last: string | null): number | null {
  if (!first || !last) return null;
  const a = new Date(first).getTime();
  const b = new Date(last).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(1, Math.round((b - a) / (24 * 3600 * 1000)));
}

export default async function VendorDetailPage({ params }: { params: { id: string } }) {
  // [id] = URL-encoded vendor_name
  const vendorName = decodeURIComponent(params.id);
  const bundle = await getGlVendorDetail(vendorName);
  const ov = bundle.overview;
  if (!ov) notFound();

  const span = spanDays(ov.first_txn_date, ov.last_txn_date);

  return (
    <Page
      eyebrow="Operations · Inventory · Suppliers · Vendor"
      title={<em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>{ov.vendor_name}</em>}
      subPages={OPERATIONS_SUBPAGES}
      topRight={
        <Link
          href="/operations/inventory/suppliers"
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 'var(--t-xs)',
            letterSpacing: 'var(--ls-extra)',
            textTransform: 'uppercase',
            color: 'var(--brass)',
            textDecoration: 'none',
            padding: '4px 10px',
            border: '1px solid var(--brass-soft, #c4a06b)',
          }}
        >← Back to vendors</Link>
      }
    >

      {/* KPI strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: 12,
        marginTop: 18,
      }}>
        <KpiBox value={ov.gross_spend_usd} unit="usd" label="Gross spend" tooltip={`Sum of debit lines · ${ov.line_count} lines total`} />
        <KpiBox value={ov.net_amount_usd} unit="usd" label="Net amount" tooltip="Gross minus credits / refunds" />
        <KpiBox value={ov.line_count} unit="count" label="Lines" tooltip="Total GL entries for this vendor" />
        <KpiBox value={ov.distinct_accounts} unit="count" label="Accounts" tooltip="Distinct GL account_ids hit by this vendor" />
        <KpiBox value={ov.distinct_classes} unit="count" label="Classes" tooltip="Distinct QuickBooks classes (departments)" />
        <KpiBox value={ov.active_periods} unit="count" label="Active periods" tooltip="Distinct YYYY-MM with activity" />
      </div>

      {/* Meta strip — only fields derived from transactions (no fake master joins) */}
      <h2 style={sectionH}>Activity window</h2>
      <div style={metaRow}>
        <div>
          <div style={metaLabel}>First txn</div>
          <div style={{ fontFamily: 'var(--mono)' }}>{fmtIsoDate(ov.first_txn_date)}</div>
        </div>
        <div>
          <div style={metaLabel}>Last txn</div>
          <div style={{ fontFamily: 'var(--mono)' }}>{fmtIsoDate(ov.last_txn_date)}</div>
        </div>
        <div>
          <div style={metaLabel}>Span</div>
          <div style={{ fontFamily: 'var(--mono)' }}>{span != null ? `${span}d` : EMPTY}</div>
        </div>
        <div>
          <div style={metaLabel}>Currency (guess)</div>
          <div style={{ fontFamily: 'var(--mono)' }}>{ov.currency_guess ?? EMPTY}</div>
        </div>
      </div>

      {/* Account splits */}
      <h2 style={sectionH}>Account split · {bundle.account_splits.length} period × account combos</h2>
      <AccountSplitsTable rows={bundle.account_splits} />

      {/* Anomalies */}
      <h2 style={sectionH}>Anomalies · {bundle.anomalies.length} flagged</h2>
      <AnomaliesTable rows={bundle.anomalies} />

      {/* Recent transactions */}
      <h2 style={sectionH}>Transactions · last {bundle.transactions.length} (cap 500)</h2>
      <TransactionsTable rows={bundle.transactions} />

      <div style={{
        marginTop: 18,
        padding: '12px 14px',
        background: 'var(--paper-deep, #f6f3ec)',
        borderLeft: '2px solid var(--brass)',
        fontSize: 'var(--t-xs)',
        color: 'var(--ink-soft)',
        lineHeight: 1.6,
      }}>
        <div style={{
          fontFamily: 'var(--mono)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--ls-extra)',
          color: 'var(--brass)',
          fontSize: 'var(--t-xs)',
          marginBottom: 6,
        }}>Data lineage</div>
        Vendor name = raw <code style={{ fontFamily: 'var(--mono)' }}>gl.gl_entries.customer_name</code> (QB transaction Name field).
        Aggregates: <code style={{ fontFamily: 'var(--mono)' }}>gl.v_supplier_overview</code>.
        Splits: <code style={{ fontFamily: 'var(--mono)' }}>gl.v_supplier_vendor_account</code>.
        Anomalies: <code style={{ fontFamily: 'var(--mono)' }}>gl.v_supplier_account_anomalies</code>.
        Lines: <code style={{ fontFamily: 'var(--mono)' }}>gl.v_supplier_transactions</code> (last 500 by date).
        No <code style={{ fontFamily: 'var(--mono)' }}>gl.vendors</code> master join (it's empty). Curated attributes (contacts/terms/lead time) → <code style={{ fontFamily: 'var(--mono)' }}>suppliers.*</code> Phase 2.5b.
      </div>
    </Page>
  );
}
