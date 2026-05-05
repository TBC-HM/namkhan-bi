'use client';

// AddToCartButton — small client island on each product card.
// Dispatches an 'inv-cart-add' event with the item; ShopCart picks it up.

import type { CartItem } from './ShopCart';

interface Props {
  itemId: string;
  sku: string;
  itemName: string;
  unitCostUsd: number;
  preferredSupplierId?: string | null;
}

export default function AddToCartButton({ itemId, sku, itemName, unitCostUsd, preferredSupplierId }: Props) {
  function add() {
    const detail: CartItem = {
      item_id: itemId,
      sku,
      item_name: itemName,
      unit_cost_usd: unitCostUsd,
      qty: 1,
      preferred_supplier_id: preferredSupplierId ?? null,
    };
    window.dispatchEvent(new CustomEvent('inv-cart-add', { detail }));
  }
  return (
    <button type="button" className="btn-primary" onClick={add}>+ Cart</button>
  );
}
