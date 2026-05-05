// POST /api/sales/prospects/import
// Bulk-imports prospects from CSV text or a parsed array.
// Accepts either:
//   { csv: "name,company,role,email,country,linkedin_url\n..." }
//   { rows: [{name,company,role,email,country,linkedin_url}, ...] }
// Inserts in batches, dedupes by email (lower).

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ALLOWED_COLS = new Set(['name','company','role','email','country','linkedin_url','website','source','context_summary']);

function parseCsv(text: string): Record<string,string>[] {
  // Lightweight CSV parser — handles quoted fields with commas, doubled-quote escapes.
  const rows: string[][] = [];
  let cur: string[] = [];
  let buf = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i+1] === '"') { buf += '"'; i++; }
        else { inQuotes = false; }
      } else {
        buf += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { cur.push(buf); buf = ''; }
      else if (ch === '\n') { cur.push(buf); rows.push(cur); cur = []; buf = ''; }
      else if (ch === '\r') { /* ignore */ }
      else buf += ch;
    }
  }
  if (buf.length > 0 || cur.length > 0) { cur.push(buf); rows.push(cur); }
  if (rows.length === 0) return [];
  const headers = rows[0].map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const out: Record<string,string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.every(c => c.trim() === '')) continue;
    const obj: Record<string,string> = {};
    headers.forEach((h, idx) => {
      const v = (r[idx] ?? '').trim();
      if (ALLOWED_COLS.has(h) && v.length > 0) obj[h] = v;
    });
    if (Object.keys(obj).length > 0) out.push(obj);
  }
  return out;
}

export async function POST(req: Request) {
  let body: { csv?: string; rows?: Record<string,unknown>[]; default_source?: string; icp_segment_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  let raw: Record<string,string>[] = [];
  if (typeof body.csv === 'string') raw = parseCsv(body.csv);
  else if (Array.isArray(body.rows)) raw = body.rows.map(r => Object.fromEntries(Object.entries(r).filter(([k]) => ALLOWED_COLS.has(k))) as Record<string,string>);
  else return NextResponse.json({ error: 'pass csv or rows' }, { status: 400 });

  if (raw.length === 0) return NextResponse.json({ error: 'no rows parsed' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const defaultSource = (body.default_source ?? 'csv') as 'manual'|'csv'|'apollo'|'linkedin'|'referral';
  const icp = body.icp_segment_id ?? null;

  // Dedupe within the batch by email
  const seenEmail = new Set<string>();
  const candidates = raw.filter(r => {
    const e = (r.email ?? '').toLowerCase();
    if (e) {
      if (seenEmail.has(e)) return false;
      seenEmail.add(e);
    }
    return true;
  }).map(r => ({
    property_id: PROPERTY_ID,
    name: r.name ?? null,
    company: r.company ?? null,
    role: r.role ?? null,
    country: r.country ?? null,
    email: r.email ?? null,
    linkedin_url: r.linkedin_url ?? null,
    website: r.website ?? null,
    source: r.source ?? defaultSource,
    icp_segment_id: icp,
    context_summary: r.context_summary ?? null,
    status: 'new' as const,
  }));

  // Skip rows whose email already exists in the table
  const emails = candidates.map(c => c.email).filter((e): e is string => !!e).map(e => e.toLowerCase());
  let existingSet = new Set<string>();
  if (emails.length > 0) {
    const { data: existing } = await sb.schema('sales').from('prospects')
      .select('email').eq('property_id', PROPERTY_ID).in('email', emails);
    existingSet = new Set(((existing ?? []) as { email: string }[]).map(r => r.email?.toLowerCase()).filter(Boolean));
  }
  const toInsert = candidates.filter(c => !c.email || !existingSet.has(c.email.toLowerCase()));
  const skipped = candidates.length - toInsert.length;

  // Batch insert in chunks of 100
  const batches: typeof toInsert[] = [];
  for (let i = 0; i < toInsert.length; i += 100) batches.push(toInsert.slice(i, i + 100));
  let inserted = 0;
  let lastError: string | null = null;
  for (const b of batches) {
    const { data, error } = await sb.schema('sales').from('prospects').insert(b).select('id');
    if (error) { lastError = error.message; break; }
    inserted += (data ?? []).length;
  }

  return NextResponse.json({
    ok: !lastError,
    inserted,
    skipped_duplicates: skipped,
    parsed: candidates.length,
    error: lastError,
  });
}
