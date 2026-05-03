// app/operations/inventory/suppliers/[id]/page.tsx
//
// Supplier detail — header + KPIs + 4 panels (contacts · items · alternates · price history)
// + inline price-history form. Source: suppliers.* tables via getSupplierDetail().

import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import StatusPill from '@/components/ui/StatusPill';
import { fmtIsoDate, EMPTY } from '@/lib/format';
import { getSupplierDetail } from '../../_data';
import {
  ContactsTable,
  ItemsSuppliedTable,
  AlternatesTable,
  PriceHistoryTable,
} from './_DetailTablesClient';
import PriceForm from './_PriceForm';

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

function statusToPill(s: string) {
  switch (s) {
    case 'active':   return <StatusPill tone="active">Active</StatusPill>;
    case 'inactive': return <StatusPill tone="inactive">Inactive</StatusPill>;
    case 'pending':  return <StatusPill tone="pending">Pending</StatusPill>;
    case 'suspended':
    case 'blocked':  return <StatusPill tone="expired">{s}</StatusPill>;
    default:         return <StatusPill tone="info">{s}</StatusPill>;
  }
}

function pctScore(n: number | null | undefined): number | null {
  if (n == null) return null;
  return n <= 1 ? n * 100 : n;
}

export default async function SupplierDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const bundle = await getSupplierDetail(id);
  const s = bundle.supplier;
  if (!s) notFound();

  return (
    <>
      <PageHeader
        pillar="Operations"
        tab="Inventory · Suppliers · Detail"
        title={<><em style={{ color: 'var(--brass)' }}>{s.name}</em></>}
        lede={
          <>
            <span style={{ fontFamily: 'var(--mono)' }}>{s.code}</span>
            {' · '}
            {s.city ? `${s.city}, ${s.country}` : s.country}
            {s.is_local_sourcing && <span style={{ marginLeft: 8, fontFamily: 'var(--mono)', color: 'var(--moss-glow)' }}>· LOCAL SOURCING</span>}
            {' · '}
            {statusToPill(s.status)}
          </>
        }
        rightSlot={
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
          >← Back to suppliers</Link>
        }
      />

      {/* KPI strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: 12,
        marginTop: 18,
      }}>
        <KpiBox value={s.lead_time_days} unit="d" label="Lead time" tooltip="Days from order to delivery"
          state={s.lead_time_days == null ? 'data-needed' : 'live'} needs={s.lead_time_days == null ? 'lead_time_days field' : undefined} />
        <KpiBox value={pctScore(s.reliability_score)} unit="pct" label="Reliability" dp={0}
          state={s.reliability_score == null ? 'data-needed' : 'live'} needs={s.reliability_score == null ? 'reliability_score field' : undefined} />
        <KpiBox value={pctScore(s.quality_score)} unit="pct" label="Quality" dp={0}
          state={s.quality_score == null ? 'data-needed' : 'live'} needs={s.quality_score == null ? 'quality_score field' : undefined} />
        <KpiBox value={s.items_supplied} unit="count" label="Items supplied" tooltip="Items where this supplier is primary or alternate vendor" />
        <KpiBox value={s.contact_count} unit="count" label="Contacts" />
        <KpiBox value={s.payment_terms_days} unit="d" label="Payment terms"
          state={s.payment_terms_days == null ? 'data-needed' : 'live'} needs={s.payment_terms_days == null ? 'payment_terms_days field' : undefined} />
      </div>

      {/* Meta strip */}
      <h2 style={sectionH}>Profile</h2>
      <div style={metaRow}>
        <div>
          <div style={metaLabel}>Legal name</div>
          <div>{s.legal_name ?? EMPTY}</div>
        </div>
        <div>
          <div style={metaLabel}>Type</div>
          <div>{s.supplier_type ?? EMPTY}</div>
        </div>
        <div>
          <div style={metaLabel}>Distance</div>
          <div style={{ fontFamily: 'var(--mono)' }}>{s.distance_km != null ? `${s.distance_km} km` : EMPTY}</div>
        </div>
        <div>
          <div style={metaLabel}>Currency</div>
          <div style={{ fontFamily: 'var(--mono)' }}>{s.currency}</div>
        </div>
        <div>
          <div style={metaLabel}>Email</div>
          <div style={{ fontFamily: 'var(--mono)' }}>
            {s.email ? <a href={`mailto:${s.email}`} style={{ color: 'var(--brass)' }}>{s.email}</a> : EMPTY}
          </div>
        </div>
        <div>
          <div style={metaLabel}>Phone</div>
          <div style={{ fontFamily: 'var(--mono)' }}>{s.phone ?? EMPTY}</div>
        </div>
        <div>
          <div style={metaLabel}>Website</div>
          <div style={{ fontFamily: 'var(--mono)' }}>
            {s.website
              ? <a href={s.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brass)' }}>{s.website}</a>
              : EMPTY}
          </div>
        </div>
        <div>
          <div style={metaLabel}>Last price update</div>
          <div style={{ fontFamily: 'var(--mono)' }}>{fmtIsoDate(s.last_price_update)}</div>
        </div>
      </div>

      {/* Contacts */}
      <h2 style={sectionH}>Contacts · {bundle.contacts.length}</h2>
      <ContactsTable rows={bundle.contacts} />

      {/* Items supplied */}
      <h2 style={sectionH}>Items supplied · {bundle.items_supplied.length}</h2>
      <ItemsSuppliedTable rows={bundle.items_supplied} />

      {/* Alternates */}
      <h2 style={sectionH}>Alternate suppliers · {bundle.alternates.length}</h2>
      <AlternatesTable rows={bundle.alternates} />

      {/* Price history + form */}
      <h2 style={sectionH}>Price history · last {bundle.price_history.length}</h2>
      <PriceHistoryTable rows={bundle.price_history} />
      <PriceForm supplierId={s.supplier_id} supplierName={s.name} />
    </>
  );
}
