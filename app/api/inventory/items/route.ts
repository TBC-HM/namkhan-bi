// app/api/inventory/items/route.ts
// PBS 2026-07-24: POST endpoint to create a new item in inv.items.
// Uses service-role admin client — inv schema is not PostgREST-exposed.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

function slugify(s: string): string {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20);
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      item_name, item_name_lao, category_id, uom_id, default_location_id,
      reorder_point, reorder_quantity, is_perishable, is_eco_certified,
      is_local_sourced, property_id,
    } = body as Record<string, unknown>;

    if (!item_name || typeof item_name !== 'string' || !item_name.trim()) {
      return NextResponse.json({ error: 'item_name is required' }, { status: 400 });
    }
    if (!category_id) return NextResponse.json({ error: 'category_id is required' }, { status: 400 });
    if (!uom_id) return NextResponse.json({ error: 'uom_id is required' }, { status: 400 });
    if (!property_id) return NextResponse.json({ error: 'property_id is required' }, { status: 400 });

    const sb = getSupabaseAdmin();

    // Fetch category code to build SKU
    const { data: cat } = await sb.schema('inv').from('categories').select('code').eq('category_id', Number(category_id)).maybeSingle();
    const catCode = (cat as { code?: string } | null)?.code ?? 'ITEM';
    const sku = `${catCode}_${slugify(item_name.trim())}_${shortId()}`;

    const payload = {
      sku,
      item_name: item_name.trim(),
      item_name_lao: (item_name_lao as string | undefined)?.trim() || null,
      category_id: Number(category_id),
      uom_id: Number(uom_id),
      default_location_id: default_location_id ? Number(default_location_id) : null,
      property_id: Number(property_id),
      reorder_point: reorder_point !== '' && reorder_point !== undefined ? Number(reorder_point) : null,
      reorder_quantity: reorder_quantity !== '' && reorder_quantity !== undefined ? Number(reorder_quantity) : null,
      is_perishable: Boolean(is_perishable),
      is_eco_certified: Boolean(is_eco_certified),
      is_local_sourced: Boolean(is_local_sourced),
      catalog_status: 'approved',
      is_active: true,
    };

    const { data, error } = await sb.schema('inv').from('items').insert(payload).select('item_id, sku, item_name').single();

    if (error) {
      console.error('[api/inventory/items] insert error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('[api/inventory/items] unexpected', err);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
