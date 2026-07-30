'use client';

// ShopCatalog — client search + category filter + product grid for the HOD
// shop. Each card dispatches 'inv-cart-add'; the ShopCart drawer (mounted as
// a sibling) picks items up and submits to /api/proc/request.

import { useMemo, useState } from 'react';
import type { CartItem } from '@/app/operations/inventory/_components/ShopCart';

export interface ShopItem {
  item_id: string;
  sku: string;
  item_name: string;
  category_name: string;
  unit_code: string;
  unit_cost_usd: number | null;
}

interface Props {
  items: ShopItem[];
}

const PAGE_SIZE = 60;

export default function ShopCatalog({ items }: Props) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category_name).filter(Boolean))).sort(),
    [items],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((i) => {
      if (cat && i.category_name !== cat) return false;
      if (!needle) return true;
      return (
        i.item_name.toLowerCase().includes(needle) ||
        i.sku.toLowerCase().includes(needle) ||
        i.category_name.toLowerCase().includes(needle)
      );
    });
  }, [items, q, cat]);

  const visible = filtered.slice(0, limit);

  function add(i: ShopItem) {
    const detail: CartItem = {
      item_id: i.item_id,
      sku: i.sku,
      item_name: i.item_name,
      unit_cost_usd: Number(i.unit_cost_usd ?? 0),
      qty: 1,
      preferred_supplier_id: null,
    };
    window.dispatchEvent(new CustomEvent('inv-cart-add', { detail }));
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input
          type="search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setLimit(PAGE_SIZE); }}
          placeholder="Search 600+ items by name, SKU, category…"
          className="inv-input"
          style={{ flex: '1 1 240px', minWidth: 200 }}
        />
        <select
          value={cat}
          onChange={(e) => { setCat(e.target.value); setLimit(PAGE_SIZE); }}
          className="inv-input"
          style={{ flex: '0 1 220px' }}
        >
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div style={{ fontSize: 12, color: '#5A5A5A', marginBottom: 8 }}>
        {filtered.length.toLocaleString('en-US')} items match
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
        {visible.map((i) => (
          <div
            key={i.item_id}
            style={{
              border: '1px solid var(--card-border, #E3DCC9)',
              borderRadius: 10,
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              background: 'var(--card-bg, #FFFFFF)',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{i.item_name}</div>
            <div style={{ fontSize: 11, color: '#5A5A5A' }}>
              {i.sku} · {i.category_name || '—'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
              <span style={{ fontSize: 12 }}>
                {i.unit_cost_usd != null && i.unit_cost_usd > 0
                  ? `$${Number(i.unit_cost_usd).toFixed(2)} / ${i.unit_code || 'unit'}`
                  : 'no cost on file'}
              </span>
              <button type="button" className="btn-primary" onClick={() => add(i)}>+ Cart</button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length > limit && (
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <button type="button" className="btn-ghost" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
            Show {Math.min(PAGE_SIZE, filtered.length - limit)} more
          </button>
        </div>
      )}
    </div>
  );
}
