// app/operations/inventory/shop/page.tsx
// Page 3 — Shop / HOD Request UI. Fully wired with cart + propose-new-item.

import Link from 'next/link';
import Card from '@/components/sections/Card';
import {
  getShopCatalog, getInvCategories, getInvLocations, getSuppliers,
} from '@/lib/inv-data';
import { fmtMoney } from '@/lib/format';
import ShopCart from '../_components/ShopCart';
import AddToCartButton from '../_components/AddToCartButton';
import ProposeNewItemButton from '../_components/ProposeNewItemButton';

export const revalidate = 30;
export const dynamic = 'force-dynamic';

interface Props { searchParams: { cat?: string; q?: string } }

export default async function ShopPage({ searchParams }: Props) {
  const filter = {
    categoryId: searchParams.cat ? parseInt(searchParams.cat, 10) : undefined,
    q: searchParams.q,
  };
  const [items, cats, locations, suppliers, units] = await Promise.all([
    getShopCatalog(filter).catch(() => []),
    getInvCategories().catch(() => []),
    getInvLocations().catch(() => []),
    getSuppliers().catch(() => []),
    // Pull units inline since data layer doesn't have a getUnits()
    (async () => {
      const { supabase } = await import('@/lib/supabase');
      const { data } = await supabase.schema('inv').from('units').select('unit_id, code, name').eq('is_active', true).order('code');
      return data ?? [];
    })(),
  ]);

  return (
    <>
      <Card
        title="Catalog"
        emphasis="request what you need"
        sub="HOD use · items under USD 500 auto-approved"
      >
        <form className="inv-shop-toolbar" method="GET">
          <input
            type="search"
            name="q"
            defaultValue={searchParams.q ?? ''}
            placeholder="Search SKU / name…"
            className="inv-input"
          />
          <select name="cat" defaultValue={searchParams.cat ?? ''} className="inv-input">
            <option value="">All categories</option>
            {(cats as any[]).map((c) => (
              <option key={c.category_id} value={c.category_id}>{c.name}</option>
            ))}
          </select>
          <button type="submit" className="btn-ghost">Filter</button>
        </form>

        {items.length === 0 ? (
          <p className="empty-state">No items match. Try another search or <Link href="?">clear filters</Link>.</p>
        ) : (
          <div className="inv-product-grid">
            {(items as any[]).map((it) => (
              <article key={it.item_id} className="inv-product-card">
                <div className="inv-product-photo">[photo]</div>
                <div className="inv-product-name">{it.item_name}</div>
                <div className="inv-product-cost">{fmtMoney(Number(it.last_unit_cost_usd ?? 0))} / {it.units?.code ?? 'unit'}</div>
                <div className="inv-product-cat">{it.categories?.name ?? '—'}</div>
                <div className="inv-product-actions">
                  <Link href={`/operations/inventory/items/${it.item_id}`} className="btn-ghost">Detail</Link>
                  <AddToCartButton
                    itemId={it.item_id}
                    sku={it.sku}
                    itemName={it.item_name}
                    unitCostUsd={Number(it.last_unit_cost_usd ?? 0)}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>

      <ProposeNewItemButton
        categories={cats as any[]}
        units={units as any[]}
        suppliers={suppliers as any[]}
      />

      <ShopCart locations={locations as any[]} />
    </>
  );
}
