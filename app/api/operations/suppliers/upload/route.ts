// POST /api/operations/suppliers/upload
//
// Bulk upsert suppliers from a CSV-parsed payload sent by
// app/operations/inventory/_components/UploadSuppliersButton.tsx.
//
// Body: { suppliers: Array<Record<string, string>> }
//   each row at minimum: code, name, country
//   optional: legal_name, supplier_type, city, province, address, distance_km,
//             is_local_sourcing, email, phone, website, payment_terms_days,
//             lead_time_days, currency, minimum_order_usd, minimum_order_lak,
//             reliability_score, quality_score, sustainability_score,
//             tax_id, bank_account, payment_terms, status, notes
//
// Returns: { ok, results: Array<{ code, ok, action?, message? }> }

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface IncomingRow {
  code?: string;
  name?: string;
  country?: string;
  legal_name?: string;
  supplier_type?: string;
  city?: string;
  province?: string;
  address?: string;
  distance_km?: string;
  is_local_sourcing?: string;
  email?: string;
  phone?: string;
  website?: string;
  payment_terms_days?: string;
  lead_time_days?: string;
  currency?: string;
  minimum_order_usd?: string;
  minimum_order_lak?: string;
  reliability_score?: string;
  quality_score?: string;
  sustainability_score?: string;
  tax_id?: string;
  bank_account?: string;
  payment_terms?: string;
  status?: string;
  notes?: string;
}

interface ResultRow {
  code: string;
  ok: boolean;
  action?: 'inserted' | 'updated' | 'skipped';
  message?: string;
}

const VALID_TYPES = new Set(['manufacturer', 'wholesaler', 'distributor', 'local_market', 'service', 'contractor', 'other']);
const VALID_STATUSES = new Set(['active', 'suspended', 'terminated', 'prospect']);

function toNum(v: string | undefined): number | null {
  if (v == null) return null;
  const t = String(v).trim();
  if (!t) return null;
  const n = Number(t.replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : null;
}
function toInt(v: string | undefined): number | null {
  const n = toNum(v);
  return n == null ? null : Math.round(n);
}
function toBool(v: string | undefined): boolean {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y';
}

export async function POST(req: Request) {
  let admin;
  try { admin = getSupabaseAdmin(); } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  let body: { suppliers?: IncomingRow[] };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const incoming = Array.isArray(body?.suppliers) ? body.suppliers : [];
  if (incoming.length === 0) {
    return NextResponse.json({ error: 'No suppliers in payload' }, { status: 400 });
  }
  if (incoming.length > 5000) {
    return NextResponse.json({ error: 'Batch too large — max 5000 rows per request' }, { status: 400 });
  }

  const results: ResultRow[] = [];
  const valid: any[] = [];
  const seen = new Set<string>();

  for (const r of incoming) {
    const code = (r.code ?? '').trim();
    const name = (r.name ?? '').trim();
    const country = (r.country ?? '').trim();
    if (!code) { results.push({ code: '(blank)', ok: false, message: 'code is required' }); continue; }
    if (!name) { results.push({ code, ok: false, message: 'name is required' }); continue; }
    if (!country) { results.push({ code, ok: false, message: 'country is required' }); continue; }
    if (seen.has(code)) { results.push({ code, ok: false, message: 'Duplicate code in this upload' }); continue; }
    seen.add(code);

    const supplierType = r.supplier_type?.trim().toLowerCase() || null;
    if (supplierType && !VALID_TYPES.has(supplierType)) {
      results.push({ code, ok: false, message: `Invalid supplier_type "${r.supplier_type}". Allowed: ${Array.from(VALID_TYPES).join(', ')}` });
      continue;
    }
    const status = r.status?.trim().toLowerCase() || 'active';
    if (!VALID_STATUSES.has(status)) {
      results.push({ code, ok: false, message: `Invalid status "${r.status}". Allowed: ${Array.from(VALID_STATUSES).join(', ')}` });
      continue;
    }

    valid.push({
      code,
      name,
      country,
      legal_name:           r.legal_name?.trim() || null,
      supplier_type:        supplierType,
      city:                 r.city?.trim() || null,
      province:             r.province?.trim() || null,
      address:              r.address?.trim() || null,
      distance_km:          toNum(r.distance_km),
      is_local_sourcing:    toBool(r.is_local_sourcing),
      email:                r.email?.trim() || null,
      phone:                r.phone?.trim() || null,
      website:              r.website?.trim() || null,
      payment_terms_days:   toInt(r.payment_terms_days),
      lead_time_days:       toInt(r.lead_time_days),
      currency:             r.currency?.trim().toUpperCase() || 'USD',
      minimum_order_usd:    toNum(r.minimum_order_usd),
      minimum_order_lak:    toNum(r.minimum_order_lak),
      reliability_score:    toNum(r.reliability_score),
      quality_score:        toNum(r.quality_score),
      sustainability_score: toNum(r.sustainability_score),
      tax_id:               r.tax_id?.trim() || null,
      bank_account:         r.bank_account?.trim() || null,
      payment_terms:        r.payment_terms?.trim() || null,
      status,
      notes:                r.notes?.trim() || null,
    });
  }

  if (valid.length === 0) {
    return NextResponse.json({ ok: false, results }, { status: 200 });
  }

  const codes = valid.map(v => v.code);
  const { data: existing, error: existingErr } = await admin
    .schema('suppliers').from('suppliers')
    .select('code')
    .in('code', codes);
  if (existingErr) {
    return NextResponse.json({ error: `Failed to check existing codes: ${existingErr.message}` }, { status: 500 });
  }
  const existingSet = new Set<string>((existing ?? []).map((r: any) => r.code));

  const { data: upserted, error: upsertErr } = await admin
    .schema('suppliers').from('suppliers')
    .upsert(valid, { onConflict: 'code' })
    .select('code');

  if (upsertErr) {
    valid.forEach(v => results.push({ code: v.code, ok: false, message: upsertErr.message }));
    return NextResponse.json({ ok: false, results }, { status: 200 });
  }

  const upsertedSet = new Set<string>((upserted ?? []).map((r: any) => r.code));
  valid.forEach(v => {
    if (!upsertedSet.has(v.code)) {
      results.push({ code: v.code, ok: false, message: 'Upsert returned no row' });
    } else {
      results.push({
        code: v.code,
        ok: true,
        action: existingSet.has(v.code) ? 'updated' : 'inserted',
      });
    }
  });

  const allOk = results.every(r => r.ok);
  return NextResponse.json({ ok: allOk, results }, { status: 200 });
}
