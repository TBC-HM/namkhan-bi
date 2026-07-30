'use client';

// NewCountSection — start a stock count from the tenant counts page.
// Pick a location + count type (+ optional category filter), then the
// legacy CountForm posts to /api/inv/count. Approval + posting to
// stock_balance happens afterwards via fn_inv_count_post (see
// CountPostButton on the counts list).

import { useMemo, useState } from 'react';
import CountForm, { type CountRow } from '@/app/operations/inventory/_components/CountForm';

export interface CountableItem {
  item_id: string;
  sku: string;
  item_name: string;
  category_name: string;
  unit_cost_usd: number | null;
}

export interface BalanceRow {
  item_id: string;
  location_id: number;
  quantity_on_hand: number;
}

interface Props {
  basePath: string;
  locations: { location_id: number; location_name: string }[];
  items: CountableItem[];
  balances: BalanceRow[];
}

export default function NewCountSection({ basePath, locations, items, balances }: Props) {
  const [locationId, setLocationId] = useState<number | ''>('');
  const [countType, setCountType] = useState<'opening' | 'periodic'>('opening');
  const [category, setCategory] = useState('');
  const [started, setStarted] = useState(false);

  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category_name).filter(Boolean))).sort(),
    [items],
  );

  const balanceMap = useMemo(() => {
    const m = new Map<string, number>();
    if (locationId !== '') {
      balances
        .filter((b) => b.location_id === locationId)
        .forEach((b) => m.set(b.item_id, Number(b.quantity_on_hand)));
    }
    return m;
  }, [balances, locationId]);

  const rows: CountRow[] = useMemo(
    () => items
      .filter((i) => !category || i.category_name === category)
      .map((i) => ({
        item_id: i.item_id,
        sku: i.sku,
        item_name: i.item_name,
        category_name: i.category_name,
        expected: balanceMap.get(i.item_id) ?? 0,
        unit_cost_usd: i.unit_cost_usd,
      })),
    [items, category, balanceMap],
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
        <label className="inv-field" style={{ flex: '0 1 220px' }}>
          <span>Location</span>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value ? Number(e.target.value) : '')}
            className="inv-input"
          >
            <option value="">— pick location —</option>
            {locations.map((l) => <option key={l.location_id} value={l.location_id}>{l.location_name}</option>)}
          </select>
        </label>
        <label className="inv-field" style={{ flex: '0 1 200px' }}>
          <span>Count type</span>
          <select
            value={countType}
            onChange={(e) => setCountType(e.target.value as 'opening' | 'periodic')}
            className="inv-input"
          >
            <option value="opening">Opening (seeds balances)</option>
            <option value="periodic">Periodic (posts variance)</option>
          </select>
        </label>
        <label className="inv-field" style={{ flex: '0 1 220px' }}>
          <span>Category filter (optional)</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="inv-input">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <button
          type="button"
          className="btn-primary"
          disabled={locationId === ''}
          onClick={() => setStarted(true)}
          style={{ marginBottom: 8 }}
        >
          {started ? 'Counting…' : 'Start count'}
        </button>
      </div>

      {started && locationId !== '' && (
        <CountForm
          locationId={locationId}
          rows={rows}
          basePath={basePath}
          countType={countType}
        />
      )}
      {started && locationId === '' && (
        <div className="inv-error">Pick a location first.</div>
      )}
    </div>
  );
}
