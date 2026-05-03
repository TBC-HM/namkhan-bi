// POST /api/operations/inventory/sync-poster-pos
//
// Pull every distinct PRODUCT actually sold (per public.transactions, which
// is the Poster POS feed flowing through Cloudbeds) into inv.items.
//
// SKU pattern: POS-<10-char md5(description+category)>. Re-running upserts.
//
// Body (all optional):
//   { minLines?: number,           // skip products sold fewer than N times (default 2)
//     includeCategories?: string[],// only these public.transactions.item_category_name values
//     excludeCategories?: string[],// negate — added to the always-excluded tax/fee/payment list
//   }
//
// Returns: { ok, summary: { fetched, mapped, inserted, updated, failed } }

import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Always-excluded transaction categories (taxes, payments, room rates)
const HARD_EXCLUDE_CATS = new Set(['tax', 'fee', 'payment', 'rate', 'room_revenue', 'refund']);
// Always-excluded descriptions (these are tax/fee/payment lines that leak into product category)
const EXCLUDE_DESCRIPTIONS = new Set([
  'Lao VAT  (10%)', 'VAT  Tax', 'Service Charge', 'Sales Tax', 'Credit Card', 'Bank Transfer',
  'Cash', 'Staff tip', 'Credit Card Commission ',
  'Service Charge (R)(10%)', 'Lao VAT (R)(10%)',
  'Service Charge (I)(10%)', 'Lao VAT (I)(10%)',
  '10% VAT & 10% SERVICE CHARGE',
]);

export async function POST(req: Request) {
  let admin;
  try { admin = getSupabaseAdmin(); } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  let body: { minLines?: number; includeCategories?: string[]; excludeCategories?: string[] } = {};
  try { body = await req.json(); } catch { /* allow empty body */ }

  const minLines = Math.max(1, Number(body.minLines ?? 2));
  const includeSet = Array.isArray(body.includeCategories) && body.includeCategories.length > 0
    ? new Set(body.includeCategories.map(s => s.toLowerCase()))
    : null;
  const excludeSet = new Set([...HARD_EXCLUDE_CATS]);
  if (Array.isArray(body.excludeCategories)) {
    body.excludeCategories.forEach(c => excludeSet.add(String(c).toLowerCase()));
  }

  // PostgREST default max-rows is typically 1000. We page through and aggregate
  // in memory. With ~63k transaction rows this is ~63 round trips — acceptable
  // because this endpoint is invoked manually by the operator, not on every page load.
  const pageSize = 1000;
  const products = new Map<string, {
    description: string;
    item_category_name: string | null;
    lines_total: number;
    qty_90d: number;
    rev_90d: number;
    sum_amount: number;
    sum_qty: number;
    last_sold_at: string | null;
  }>();

  const ninetyDaysAgo = Date.now() - 90 * 24 * 3600 * 1000;
  let from = 0;
  while (true) {
    const { data, error } = await admin
      .from('transactions')
      .select('description, item_category_name, transaction_date, quantity, amount', { count: 'exact' })
      .not('description', 'is', null)
      .gt('amount', 0)
      .range(from, from + pageSize - 1);
    if (error) return NextResponse.json({ error: `transactions read: ${error.message}` }, { status: 500 });
    if (!data || data.length === 0) break;

    for (const r of data) {
      const desc = String(r.description ?? '').trim();
      if (!desc) continue;
      if (EXCLUDE_DESCRIPTIONS.has(desc)) continue;
      const cat = r.item_category_name ? String(r.item_category_name) : null;
      const catKey = (cat ?? '').toLowerCase();
      if (excludeSet.has(catKey)) continue;
      if (includeSet && !includeSet.has(catKey)) continue;

      const key = `${desc}::${cat ?? ''}`;
      const txDate = r.transaction_date ? new Date(r.transaction_date).getTime() : 0;
      const qty = Number(r.quantity ?? 0);
      const amt = Number(r.amount ?? 0);

      const e = products.get(key) ?? {
        description: desc,
        item_category_name: cat,
        lines_total: 0,
        qty_90d: 0,
        rev_90d: 0,
        sum_amount: 0,
        sum_qty: 0,
        last_sold_at: null as string | null,
      };
      e.lines_total++;
      if (txDate >= ninetyDaysAgo) {
        e.qty_90d += qty;
        e.rev_90d += amt;
      }
      if (qty > 0 && amt > 0) {
        e.sum_amount += amt;
        e.sum_qty += qty;
      }
      if (!e.last_sold_at || (r.transaction_date && r.transaction_date > e.last_sold_at)) {
        e.last_sold_at = r.transaction_date as string;
      }
      products.set(key, e);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }

  // Filter by minLines
  const eligible = Array.from(products.values()).filter(p => p.lines_total >= minLines);

  // Load inv.categories + 'ea' unit
  const [catsRes, unitsRes] = await Promise.all([
    admin.schema('inv').from('categories').select('category_id, code'),
    admin.schema('inv').from('units').select('unit_id, code').eq('code', 'ea'),
  ]);
  const cats = new Map<string, number>();
  (catsRes.data ?? []).forEach((c: any) => cats.set(String(c.code).toLowerCase(), c.category_id));
  const eaId = (unitsRes.data ?? [])[0]?.unit_id;
  if (!eaId) return NextResponse.json({ error: 'inv.units missing "ea"' }, { status: 500 });

  function mapCategory(catName: string | null): string {
    const s = (catName ?? '').toLowerCase();
    if (/beer|wine|spirit|cocktail|gin|rum|vodka|whisk|cognac|liquor|liqueur|sparkling|alcohol/.test(s)) return 'fb_beverage';
    if (/juice|coffee|tea|soft|drink|liquid|hot drink|cold drink|warm beverage|mocktail|non-alcoholic/.test(s)) return 'fb_beverage';
    if (/main|salad|starter|dessert|sandwich|burger|sweet|snack|menu|kitchen|fusion|noodle|appetizer|breakfast|side|child|meal|food|nem|soup/.test(s)) return 'fb_food';
    if (/spa/.test(s)) return 'spa_prod';
    if (/minibar/.test(s)) return 'fb_food';
    if (/handicraft|hotel shop|book|toy|paint/.test(s)) return 'ose';
    if (/activity|tour|mekong|transport/.test(s)) return 'ose';
    return 'ose';
  }

  // Use Node crypto md5 + take first 10 hex chars — matches the SQL seeding pattern
  // (`substring(md5(description || category) for 10)`) so the API and the original
  // SQL bulk-load produce IDENTICAL SKUs and re-runs upsert cleanly.
  function md5Hex(s: string): string {
    return crypto.createHash('md5').update(s).digest('hex').slice(0, 10);
  }

  let mapped = 0;
  const candidates: any[] = [];
  for (const e of eligible) {
    const code = mapCategory(e.item_category_name);
    const catId = cats.get(code);
    if (!catId) continue;
    mapped++;
    // MUST match the SQL bulk-load slug pattern exactly:
    //   substring(md5(description || category_name) for 10)
    // No separator between fields.
    const slug = md5Hex((e.description ?? '') + (e.item_category_name ?? ''));
    const avgPrice = e.sum_qty > 0 ? e.sum_amount / e.sum_qty : null;
    candidates.push({
      sku: `POS-${slug}`,
      item_name: e.description.slice(0, 200),
      description: `Poster POS · ${e.item_category_name ? 'category: ' + e.item_category_name + ' · ' : ''}${e.lines_total} txn lines · last sold ${e.last_sold_at?.slice(0,10) ?? '?'}`,
      category_id: catId,
      uom_id: eaId,
      last_unit_cost_usd: avgPrice,
      fx_rate_used: 21800,
      catalog_status: 'approved',
      is_active: true,
      notes: `pos_category=${e.item_category_name ?? '(blank)'}|qty_90d=${e.qty_90d}|rev_90d=${e.rev_90d.toFixed(2)}`,
    });
  }

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, summary: { fetched: products.size, mapped: 0, inserted: 0, updated: 0, failed: 0 } });
  }

  // Find existing for inserted vs updated count
  const skus = candidates.map(c => c.sku);
  const { data: existing } = await admin.schema('inv').from('items').select('sku').in('sku', skus);
  const existingSet = new Set<string>((existing ?? []).map((r: any) => r.sku));

  // Upsert in chunks to keep request bodies small
  const CHUNK = 500;
  let inserted = 0, updated = 0, failed = 0;
  for (let i = 0; i < candidates.length; i += CHUNK) {
    const slice = candidates.slice(i, i + CHUNK);
    const { data: upserted, error } = await admin.schema('inv').from('items')
      .upsert(slice, { onConflict: 'sku' })
      .select('sku');
    if (error) { failed += slice.length; continue; }
    const upSet = new Set<string>((upserted ?? []).map((r: any) => r.sku));
    for (const c of slice) {
      if (!upSet.has(c.sku)) { failed++; continue; }
      if (existingSet.has(c.sku)) updated++; else inserted++;
    }
  }

  return NextResponse.json({
    ok: failed === 0,
    summary: { fetched: products.size, mapped, inserted, updated, failed },
  });
}
