// app/operations/inventory/items/[item_id]/page.tsx
// Page 2 — Item Detail. Operator-first product view.

import Link from 'next/link';
import Card from '@/components/sections/Card';
import { getItemDetail, getInvLocations } from '@/lib/inv-data';
import { fmtMoney, fmtNumber } from '@/lib/format';
import MovementModal from '../../_components/MovementModal';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props { params: { item_id: string } }

export default async function ItemDetailPage({ params }: Props) {
  const [data, locations] = await Promise.all([
    getItemDetail(params.item_id).catch((e) => {
      console.error('[item detail]', e);
      return null;
    }),
    getInvLocations().catch(() => [] as any[]),
  ]);

  if (!data || !data.item) {
    return (
      <Card title="Item" emphasis="not found">
        <p>SKU {params.item_id} not found, or you don't have permission to read it.</p>
        <p><Link href="/operations/inventory">← Back to inventory</Link></p>
      </Card>
    );
  }

  const { item, stock, parStatus, movements, usage, cover, expiry, photos } = data;
  const totalPar = parStatus.reduce((s, p) => s + Number(p.par_quantity ?? 0), 0);
  const onHand   = stock?.total_on_hand ?? 0;
  const status =
    onHand <= 0 ? 'stock_out' :
    onHand < totalPar * 0.5 ? 'reorder_now' :
    onHand < totalPar ? 'below_par' :
    'ok';
  const isPerishable = item.is_perishable;
  const expiringWithin60 = expiry.filter((e) => e.days_until_expiry <= 60);

  // 12w usage avg
  const weeklySum = usage.reduce((s, w) => s + Number(w.units_consumed ?? 0), 0);
  const weeklyAvg = usage.length ? weeklySum / usage.length : 0;

  return (
    <>
      <div className="breadcrumb">
        <Link href="/operations/inventory">Inventory</Link>
        {' · '}
        <span>{item.categories?.name ?? '—'}</span>
        {' · '}
        <strong>{item.item_name}</strong>
      </div>

      {/* Header tile */}
      <Card title={item.item_name?.toUpperCase() ?? ''} emphasis={item.sku} sub={`Cat: ${item.categories?.name ?? '—'} · UoM: ${item.units?.code ?? '—'}${stock?.last_count_at ? ` · Last count: ${stock.last_count_at.slice(0, 10)}` : ''}`}>
        {/* Stock strip */}
        <div className="inv-stock-strip">
          <div>
            <div className="inv-strip-label">On hand</div>
            <div className="inv-strip-value">
              {fmtNumber(onHand)} {item.units?.code ?? 'units'} · {fmtMoney(Number(stock?.value_usd_estimate ?? 0))} value
            </div>
            <div className="inv-strip-meta">across {stock?.locations_with_stock ?? 0} location{stock?.locations_with_stock === 1 ? '' : 's'}</div>
          </div>
          <div>
            <div className="inv-strip-label">Par target</div>
            <div className="inv-strip-value">{fmtNumber(totalPar)} {item.units?.code ?? ''}</div>
            <div className="inv-strip-meta">Reorder at {fmtNumber(item.reorder_point ?? 0)}</div>
          </div>
          <div>
            <div className="inv-strip-label">Status</div>
            <div className={`inv-strip-value status-${status}`}>{statusLabel(status)}</div>
          </div>
          <div className="inv-strip-actions">
            <MovementModal
              itemId={item.item_id}
              itemName={item.item_name ?? ''}
              currentLocationId={item.default_location_id ?? null}
              locations={locations as any[]}
            />
            <Link href={`/operations/inventory/shop?prefill=${item.sku}`} className="btn-primary">Schedule reorder</Link>
          </div>
        </div>
      </Card>

      <div className="two-col-grid">
        {/* Movement history */}
        <Card title="Movement history" emphasis="last 20" sub="Append-only ledger">
          {movements.length === 0 ? (
            <p className="empty-state">No movements yet.</p>
          ) : (
            <table className="inv-table">
              <thead>
                <tr><th>Date</th><th>Type</th><th>Qty</th><th>Location</th><th>Vendor</th></tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.movement_id}>
                    <td>{m.movement_date}</td>
                    <td>{m.movement_type}</td>
                    <td className={Number(m.quantity) < 0 ? 'qty-out' : 'qty-in'}>
                      {Number(m.quantity) > 0 ? '+' : ''}{m.quantity}
                    </td>
                    <td>{m.locations?.location_name ?? '—'}</td>
                    <td>{m.supplier?.name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Financial */}
        <Card title="Financial" emphasis="cost & GL" sub="Last-cost methodology">
          <dl className="inv-dl">
            <dt>Avg unit cost (last)</dt>
            <dd>{fmtMoney(Number(item.last_unit_cost_usd ?? 0))}</dd>
            <dt>Total inv value</dt>
            <dd>{fmtMoney(Number(stock?.value_usd_estimate ?? 0))}</dd>
            <dt>Source GL acct</dt>
            <dd>{item.gl_account_code ?? '—'}</dd>
            <dt>Linked vendor</dt>
            <dd>{item.primary_vendor_id ? item.primary_vendor_id.slice(0, 8) + '…' : '—'}</dd>
            <dt>Currency</dt>
            <dd>USD/LAK at FX {item.fx_rate_used ?? '—'}</dd>
          </dl>
        </Card>
      </div>

      <div className="two-col-grid">
        {/* Usage trend */}
        <Card title="Usage trend" emphasis="last 12 weeks" sub={`Avg ${fmtNumber(weeklyAvg, 1)} units/week`}>
          {usage.length === 0 ? (
            <p className="empty-state">No movement history.</p>
          ) : (
            <Sparkline rows={usage.map((w) => Number(w.units_consumed ?? 0))} />
          )}
        </Card>

        {/* Alerts */}
        <Card title="Alerts" emphasis={alertsCount(status, onHand, totalPar, expiringWithin60.length)} sub="">
          <ul className="inv-list">
            <li>{status === 'ok' ? '✓' : '⚠'} {statusLabel(status)}</li>
            {weeklyAvg < 1 && onHand > 0 && <li>⚠ Slow-moving (90d)</li>}
            {isPerishable && expiringWithin60.length > 0 && (
              <li>⚠ Expiring within 60d ({expiringWithin60.reduce((s, e) => s + Number(e.current_on_hand ?? 0), 0)} of {onHand})</li>
            )}
          </ul>
        </Card>
      </div>

      <div className="two-col-grid">
        {/* Days of cover (3 figures from v_inv_days_of_cover) */}
        <Card title="Days of cover" emphasis="at current burn">
          <dl className="inv-dl">
            <dt>At current burn</dt>
            <dd>{cover?.days_of_cover != null ? `${cover.days_of_cover} days` : '— (no recent movements)'}</dd>
            <dt>Until par hit</dt>
            <dd>{cover?.days_until_par != null ? `${cover.days_until_par} days` : '—'}</dd>
            <dt>Until reorder</dt>
            <dd>{cover?.days_until_reorder != null ? `${cover.days_until_reorder} days` : '—'}</dd>
          </dl>
        </Card>

        {/* Photos */}
        <Card title="Photos" emphasis={`${photos.length}`}>
          {photos.length === 0 ? (
            <p className="empty-state">No photos yet. (Upload via the catalog admin screen.)</p>
          ) : (
            <div className="inv-photo-grid">
              {photos.slice(0, 6).map((p) => (
                <div key={p.photo_id} className="inv-photo">
                  {/* TODO: wire Supabase storage URL once bucket exists */}
                  <span>{p.filename}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {expiringWithin60.length > 0 && (
        <Card title="Expiry management" emphasis="batches within 60d">
          <table className="inv-table">
            <thead><tr><th>Batch</th><th>Qty</th><th>Expires</th><th>Days left</th><th>At-risk $</th></tr></thead>
            <tbody>
              {expiringWithin60.map((e) => (
                <tr key={e.batch_movement_id}>
                  <td>{e.batch_code ?? '—'}</td>
                  <td>{e.current_on_hand}</td>
                  <td>{e.expiry_date}</td>
                  <td className={e.days_until_expiry < 7 ? 'qty-out' : ''}>{e.days_until_expiry}d</td>
                  <td>{fmtMoney(Number(e.at_risk_value_usd ?? 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card title="Par by location" emphasis={`${parStatus.length} location${parStatus.length === 1 ? '' : 's'}`}>
        <table className="inv-table">
          <thead>
            <tr><th>Location</th><th>On hand</th><th>Par</th><th>Status</th><th>Short</th></tr>
          </thead>
          <tbody>
            {parStatus.map((p) => (
              <tr key={p.location_id}>
                <td>{p.location_name}</td>
                <td>{p.on_hand}</td>
                <td>{p.par_quantity}</td>
                <td className={`status-${p.par_status}`}>{statusLabel(p.par_status)}</td>
                <td>{p.short_quantity > 0 ? p.short_quantity : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function statusLabel(s: string): string {
  switch (s) {
    case 'ok': return '✓ OK';
    case 'below_par': return '⚠ Below par';
    case 'reorder_now': return '⚠ Reorder now';
    case 'stock_out': return '✕ Stock out';
    case 'overstocked': return 'ⓘ Overstocked';
    default: return s;
  }
}

function alertsCount(status: string, onHand: number, totalPar: number, expiring: number): string {
  let n = 0;
  if (status !== 'ok') n++;
  if (expiring > 0) n++;
  return `${n}`;
}

function Sparkline({ rows }: { rows: number[] }) {
  const max = Math.max(...rows, 1);
  return (
    <div className="inv-sparkline">
      {rows.map((v, i) => (
        <div
          key={i}
          className="inv-spark-bar"
          style={{ height: `${(v / max) * 100}%` }}
          title={`${v} units`}
        />
      ))}
    </div>
  );
}
