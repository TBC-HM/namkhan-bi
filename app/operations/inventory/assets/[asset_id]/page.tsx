// app/operations/inventory/assets/[asset_id]/page.tsx
// Asset detail — header, depreciation, maintenance log, documents.

import Link from 'next/link';
import Card from '@/components/sections/Card';
import { getAssetDetail } from '@/lib/inv-data';
import { fmtMoney } from '@/lib/format';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props { params: { asset_id: string } }

export default async function AssetDetailPage({ params }: Props) {
  const { asset, dep, mlog, docs } = await getAssetDetail(params.asset_id);

  if (!asset) {
    return <Card title="Asset" emphasis="not found"><p><Link href="/operations/inventory/assets">← Back</Link></p></Card>;
  }

  const accumDepreciation = dep?.book_value_usd != null && asset.purchase_cost_usd != null
    ? Number(asset.purchase_cost_usd) - Number(dep.book_value_usd)
    : null;

  return (
    <>
      <div className="breadcrumb">
        <Link href="/operations/inventory/assets">Assets</Link>{' · '}
        <strong>{asset.asset_tag}</strong>
      </div>

      <Card title={asset.name?.toUpperCase()} emphasis={asset.asset_tag} sub={`${asset.category?.name ?? '—'} · ${asset.location ?? '—'}`}>
        <div className="two-col-grid">
          <dl className="inv-dl">
            <dt>Acquired</dt>
            <dd>{asset.purchase_date ?? '—'}</dd>
            <dt>In service</dt>
            <dd>{asset.in_service_date ?? '—'}</dd>
            <dt>Acquisition cost</dt>
            <dd>{fmtMoney(Number(asset.purchase_cost_usd ?? 0))}</dd>
            <dt>Useful life</dt>
            <dd>{asset.useful_life_years ?? asset.category?.default_useful_life_years ?? '—'} yrs</dd>
            <dt>Depreciation method</dt>
            <dd>{asset.depreciation_method ?? asset.category?.default_depreciation_method ?? '—'}</dd>
          </dl>
          <dl className="inv-dl">
            <dt>Net book value</dt>
            <dd>{dep?.book_value_usd != null ? fmtMoney(Number(dep.book_value_usd)) : '—'}</dd>
            <dt>Accum. depreciation</dt>
            <dd>{accumDepreciation != null ? fmtMoney(accumDepreciation) : '—'}</dd>
            <dt>Insurance value</dt>
            <dd>{fmtMoney(Number(asset.insurance_value_usd ?? 0))}</dd>
            <dt>Warranty</dt>
            <dd>{asset.warranty_expiry ?? '—'}</dd>
            <dt>Serial #</dt>
            <dd>{asset.serial_number ?? '—'}</dd>
            <dt>Vendor</dt>
            <dd>{asset.supplier?.name ?? '—'}</dd>
          </dl>
        </div>
      </Card>

      <div className="two-col-grid">
        <Card title="Depreciation" emphasis="schedule" sub={dep?.monthly_depreciation_usd ? `${fmtMoney(Number(dep.monthly_depreciation_usd))}/mo` : ''}>
          {dep ? (
            <dl className="inv-dl">
              <dt>Monthly</dt>
              <dd>{fmtMoney(Number(dep.monthly_depreciation_usd))}</dd>
              <dt>Years in service</dt>
              <dd>{dep.years_in_service ?? '—'}</dd>
              <dt>Depreciable base</dt>
              <dd>{fmtMoney(Number(dep.depreciable_base_usd))}</dd>
              <dt>Residual</dt>
              <dd>{fmtMoney(Number(asset.residual_value_usd))}</dd>
            </dl>
          ) : <p className="empty-state">No depreciation row (asset inactive or non-depreciable).</p>}
        </Card>

        <Card title="Maintenance log" emphasis={`${mlog.length}`}>
          {mlog.length === 0 ? (
            <p className="empty-state">No maintenance logged.</p>
          ) : (
            <table className="inv-table">
              <thead><tr><th>Date</th><th>Type</th><th>Vendor</th><th style={{ textAlign: 'right' }}>Cost</th></tr></thead>
              <tbody>
                {mlog.slice(0, 8).map((m: any) => (
                  <tr key={m.log_id}>
                    <td>{m.event_date}</td>
                    <td>{m.event_type}</td>
                    <td>{m.vendor?.name ?? m.performed_by ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>{fmtMoney(Number(m.cost_usd ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card title="Documents" emphasis={`${docs.length}`}>
        {docs.length === 0 ? (
          <p className="empty-state">No invoices, warranties, or photos uploaded.</p>
        ) : (
          <ul className="inv-list">
            {docs.map((d: any) => (
              <li key={d.document_id}>
                <span className="inv-list-name">{d.filename}</span>
                <span className="inv-list-meta">{d.document_type}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
