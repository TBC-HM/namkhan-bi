// POST /api/operations/inventory/items
//
// Bulk upsert items into inv.items from a CSV-parsed payload sent by
// app/operations/inventory/_components/UploadProductsButton.tsx.
//
// Body: { items: Array<Record<string, string>> }
//   each row at minimum has: sku, item_name, category_code
//   optional: unit_code, description, last_unit_cost_usd,
//             gl_account_code, is_perishable, shelf_life_days,
//             reorder_point, reorder_quantity, notes
//
// Returns: { ok: boolean, results: Array<{ sku, ok, action?, message? }> }
//
// Server-side resolution: category_code → category_id, unit_code → unit_id.
// Unknown codes are reported as per-row error; the rest still get inserted.
//
// Auth: uses the service-role client (lib/supabaseAdmin). The dashboard is
// password-gated at the frontend; same model as /api/marketing/upload.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface IncomingRow {
  sku?: string;
  item_name?: string;
  category_code?: string;
  unit_code?: string;
  description?: string;
  last_unit_cost_usd?: string;
  gl_account_code?: string;
  is_perishable?: string;
  shelf_life_days?: string;
  reorder_point?: string;
  reorder_quantity?: string;
  notes?: string;
}

interface ResultRow {
  sku: string;
  ok: boolean;
  action?: 'inserted' | 'updated' | 'skipped';
  message?: string;
}

function toNum(v: string | undefined): number | null {
  if (v == null) return null;
  const trimmed = String(v).trim();
  if (trimmed === '') return null;
  const cleaned = trimmed.replace(/[$,]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function toBool(v: string | undefined): boolean {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y';
}

function toInt(v: string | undefined): number | null {
  const n = toNum(v);
  if (n == null) return null;
  return Math.round(n);
}

export async function POST(req: Request) {
  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  let body: { items?: IncomingRow[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const incoming = Array.isArray(body?.items) ? body.items : [];
  if (incoming.length === 0) {
    return NextResponse.json({ error: 'No items in payload' }, { status: 400 });
  }
  if (incoming.length > 5000) {
    return NextResponse.json({ error: 'Batch too large — max 5000 rows per request' }, { status: 400 });
  }

  // Pre-load reference dictionaries once
  const [{ data: cats, error: catErr }, { data: units, error: unitErr }] = await Promise.all([
    admin.schema('inv').from('categories').select('category_id, code, is_active'),
    admin.schema('inv').from('units').select('unit_id, code, is_active'),
  ]);

  if (catErr) return NextResponse.json({ error: `Failed to load categories: ${catErr.message}` }, { status: 500 });
  if (unitErr) return NextResponse.json({ error: `Failed to load units: ${unitErr.message}` }, { status: 500 });

  const catByCode = new Map<string, number>();
  (cats ?? []).forEach((c: any) => { if (c.is_active !== false) catByCode.set(String(c.code).toLowerCase(), c.category_id); });
  const unitByCode = new Map<string, number>();
  (units ?? []).forEach((u: any) => { if (u.is_active !== false) unitByCode.set(String(u.code).toLowerCase(), u.unit_id); });

  const results: ResultRow[] = [];
  const validRows: any[] = [];
  const skuToIncoming: Map<string, IncomingRow> = new Map();

  for (const row of incoming) {
    const sku = (row.sku ?? '').trim();
    const item_name = (row.item_name ?? '').trim();
    const category_code = (row.category_code ?? '').trim().toLowerCase();
    const unit_code = (row.unit_code ?? 'ea').trim().toLowerCase() || 'ea';

    if (!sku) {
      results.push({ sku: '(blank)', ok: false, message: 'sku is required' });
      continue;
    }
    if (!item_name) {
      results.push({ sku, ok: false, message: 'item_name is required' });
      continue;
    }
    if (!category_code) {
      results.push({ sku, ok: false, message: 'category_code is required' });
      continue;
    }
    const category_id = catByCode.get(category_code);
    if (!category_id) {
      results.push({ sku, ok: false, message: `Unknown category_code "${row.category_code}"` });
      continue;
    }
    const uom_id = unitByCode.get(unit_code);
    if (!uom_id) {
      results.push({ sku, ok: false, message: `Unknown unit_code "${row.unit_code ?? 'ea'}"` });
      continue;
    }

    if (skuToIncoming.has(sku)) {
      results.push({ sku, ok: false, message: 'Duplicate SKU within this upload' });
      continue;
    }
    skuToIncoming.set(sku, row);

    validRows.push({
      sku,
      item_name,
      description: row.description?.trim() || null,
      category_id,
      uom_id,
      last_unit_cost_usd: toNum(row.last_unit_cost_usd),
      gl_account_code: row.gl_account_code?.trim() || null,
      is_perishable: toBool(row.is_perishable),
      shelf_life_days: toInt(row.shelf_life_days),
      reorder_point: toNum(row.reorder_point),
      reorder_quantity: toNum(row.reorder_quantity),
      notes: row.notes?.trim() || null,
      catalog_status: 'approved',
      is_active: true,
    });
  }

  if (validRows.length === 0) {
    return NextResponse.json({ ok: false, results }, { status: 200 });
  }

  // Find which SKUs already exist so we can label results "inserted" vs "updated"
  const skus = validRows.map(r => r.sku);
  const { data: existing, error: existingErr } = await admin
    .schema('inv')
    .from('items')
    .select('sku')
    .in('sku', skus);
  if (existingErr) {
    return NextResponse.json({ error: `Failed to check existing SKUs: ${existingErr.message}` }, { status: 500 });
  }
  const existingSet = new Set<string>((existing ?? []).map((r: any) => r.sku));

  // Upsert by sku — inv.items has UNIQUE(sku) per spec
  const { data: upserted, error: upsertErr } = await admin
    .schema('inv')
    .from('items')
    .upsert(validRows, { onConflict: 'sku' })
    .select('sku');

  if (upsertErr) {
    // Whole-batch failure → return per-row error keyed to each valid sku
    validRows.forEach(r => {
      results.push({ sku: r.sku, ok: false, message: upsertErr.message });
    });
    return NextResponse.json({ ok: false, results }, { status: 200 });
  }

  const upsertedSet = new Set<string>((upserted ?? []).map((r: any) => r.sku));
  validRows.forEach(r => {
    if (upsertedSet.has(r.sku)) {
      results.push({
        sku: r.sku,
        ok: true,
        action: existingSet.has(r.sku) ? 'updated' : 'inserted',
      });
    } else {
      results.push({ sku: r.sku, ok: false, message: 'Upsert returned no row — check RLS or constraints' });
    }
  });

  const allOk = results.every(r => r.ok);
  return NextResponse.json({ ok: allOk, results }, { status: 200 });
}
