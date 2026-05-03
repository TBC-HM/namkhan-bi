// POST /api/operations/inventory/sync-cloudbeds
//
// Pull "products we sell" from public.items (Cloudbeds-synced) into inv.items.
// Other Claude session owns the cb_*/sync-cloudbeds Edge Function — we just
// READ public.items (already populated, ~451 rows) and upsert into inv.items.
//
// Body: {
//   categories?: string[],     // public.item_categories.name to include — defaults to all
//   onlyTangible?: boolean,    // default true — skip services like 'Nk Spa'/'NK Activities'
// }
//
// Returns: { ok, summary: { fetched, skipped, inserted, updated, failed }, results }
//
// Auth model: service-role (single-owner v1). Same as /api/marketing/upload.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cloudbeds categories considered "tangible / stockable" by default.
// Services (spa, activities, packages, transport, fees, tip) are excluded
// because they don't need stock balances. User can override via `categories`.
const DEFAULT_TANGIBLE = new Set([
  'Nk F&B',
  'NK Retail',
  'Farm products',
  'Minibar',
  'NK other Room Related',
  'The I Mekong',
]);

// Heuristic: Cloudbeds category + item name → inv.category_code.
function mapToInvCategory(cbCategory: string | null, itemName: string): string {
  const c = (cbCategory ?? '').toLowerCase();
  const n = itemName.toLowerCase();
  // Beverage signals
  if (/beer|wine|gin|whisky|whiskey|vodka|rum|cocktail|coffee|tea|juice|soda|water|champagne|prosecco/.test(n)) return 'FB_BEVERAGE';
  // Food signals — F&B category that isn't a drink
  if (c.includes('f&b') || c.includes('mekong') || c.includes('farm') || c.includes('minibar')) return 'FB_FOOD';
  // Smallwares
  if (/glass|knife|plate|fork|spoon|cup/.test(n)) return 'FB_SMALLW';
  // Retail goes to OSE bucket — they're sellable goods, not consumables
  if (c.includes('retail')) return 'OSE';
  if (c.includes('room related')) return 'AMENITIES';
  // Fallback
  return 'OSE';
}

interface ResultRow {
  cb_id: string;
  sku: string;
  ok: boolean;
  action?: 'inserted' | 'updated' | 'skipped';
  message?: string;
}

export async function POST(req: Request) {
  let admin;
  try { admin = getSupabaseAdmin(); } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  let body: { categories?: string[]; onlyTangible?: boolean } = {};
  try { body = await req.json(); } catch { /* allow empty body */ }
  const onlyTangible = body.onlyTangible !== false;
  const categoriesFilter = Array.isArray(body.categories) && body.categories.length > 0
    ? new Set(body.categories.map(s => s.toLowerCase()))
    : null;

  // Load reference data
  const [{ data: cbItems, error: cbErr }, { data: cbCats, error: cbCatErr }, { data: invCats }] = await Promise.all([
    admin.from('items').select('item_id, name, item_category_id, unit_price, is_active'),
    admin.from('item_categories').select('item_category_id, name'),
    admin.schema('inv').from('categories').select('category_id, code'),
  ]);

  if (cbErr) return NextResponse.json({ error: `Failed to load public.items: ${cbErr.message}` }, { status: 500 });
  if (cbCatErr) return NextResponse.json({ error: `Failed to load public.item_categories: ${cbCatErr.message}` }, { status: 500 });

  const cbCatById = new Map<string, string>();
  (cbCats ?? []).forEach((c: any) => cbCatById.set(c.item_category_id, c.name));
  const invCatByCode = new Map<string, number>();
  (invCats ?? []).forEach((c: any) => invCatByCode.set(String(c.code).toLowerCase(), c.category_id));

  // Default unit = each
  const { data: units } = await admin.schema('inv').from('units').select('unit_id, code').eq('code', 'ea');
  const eaId = (units ?? [])[0]?.unit_id;
  if (!eaId) return NextResponse.json({ error: 'inv.units missing "ea" — seed required' }, { status: 500 });

  let fetched = 0, skipped = 0;
  const candidates: any[] = [];
  const results: ResultRow[] = [];

  for (const it of (cbItems ?? [])) {
    fetched++;
    const cbCat = it.item_category_id ? (cbCatById.get(it.item_category_id) ?? null) : null;

    // Filter: by user-selected categories OR default tangible set
    const include = categoriesFilter
      ? (cbCat ? categoriesFilter.has(cbCat.toLowerCase()) : false)
      : (onlyTangible ? (cbCat ? DEFAULT_TANGIBLE.has(cbCat) : false) : true);
    if (!include) { skipped++; continue; }

    const name = String(it.name ?? '').trim();
    if (!name) { skipped++; results.push({ cb_id: it.item_id, sku: `CB-${it.item_id}`, ok: false, message: 'No name in Cloudbeds row' }); continue; }
    if (Number(it.unit_price ?? 0) <= 0) {
      // We still allow zero-price items — they may be sample/promo SKUs — but flag as note
    }

    const invCode = mapToInvCategory(cbCat, name);
    const invCatId = invCatByCode.get(invCode.toLowerCase());
    if (!invCatId) {
      results.push({ cb_id: it.item_id, sku: `CB-${it.item_id}`, ok: false, message: `Mapped category ${invCode} not in inv.categories` });
      continue;
    }
    candidates.push({
      sku: `CB-${it.item_id}`,
      item_name: name.slice(0, 200),
      description: cbCat ? `Synced from Cloudbeds POS · category: ${cbCat}` : 'Synced from Cloudbeds POS',
      category_id: invCatId,
      uom_id: eaId,
      last_unit_cost_usd: Number(it.unit_price ?? 0) || null, // CB unit_price is sale price not cost — best available proxy
      catalog_status: 'approved',
      is_active: it.is_active !== false,
      notes: `cloudbeds_item_id=${it.item_id}`,
    });
  }

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, summary: { fetched, skipped, inserted: 0, updated: 0, failed: 0 }, results }, { status: 200 });
  }

  // Find existing SKUs for inserted/updated labelling
  const skus = candidates.map(c => c.sku);
  const { data: existing } = await admin.schema('inv').from('items').select('sku').in('sku', skus);
  const existingSet = new Set<string>((existing ?? []).map((r: any) => r.sku));

  const { data: upserted, error: upsertErr } = await admin
    .schema('inv')
    .from('items')
    .upsert(candidates, { onConflict: 'sku' })
    .select('sku');

  if (upsertErr) {
    candidates.forEach(c => results.push({ cb_id: c.notes.split('=')[1] ?? '', sku: c.sku, ok: false, message: upsertErr.message }));
    return NextResponse.json({ ok: false, summary: { fetched, skipped, inserted: 0, updated: 0, failed: candidates.length }, results }, { status: 200 });
  }

  const upsertedSet = new Set<string>((upserted ?? []).map((r: any) => r.sku));
  let inserted = 0, updated = 0, failed = 0;
  candidates.forEach(c => {
    const cbId = c.notes.split('=')[1] ?? '';
    if (!upsertedSet.has(c.sku)) {
      failed++;
      results.push({ cb_id: cbId, sku: c.sku, ok: false, message: 'Upsert returned no row' });
      return;
    }
    if (existingSet.has(c.sku)) {
      updated++;
      results.push({ cb_id: cbId, sku: c.sku, ok: true, action: 'updated' });
    } else {
      inserted++;
      results.push({ cb_id: cbId, sku: c.sku, ok: true, action: 'inserted' });
    }
  });

  return NextResponse.json({ ok: true, summary: { fetched, skipped, inserted, updated, failed }, results }, { status: 200 });
}
