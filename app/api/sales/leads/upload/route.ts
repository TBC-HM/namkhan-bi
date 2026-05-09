// POST /api/sales/leads/upload
// Parses a CSV against targeting.lead_scraping_fields (20 canonical fields)
// and inserts into sales.leads with status='raw', source='csv'.
//
// Accepts:
//   { csv: "company_name,category,country,city,...\n..." }
//   { rows: [{ company_name, ... }, ...] }
//
// Validates per-row (company_name required) and dedupes by (lead_id) +
// (lower(email)) within the batch and against existing rows.
//
// PBS 2026-05-09: shipped alongside the merged /sales/leads-pipeline page.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Canonical 20 columns from targeting.lead_scraping_fields. Plus a few
// recognised aliases the operator might paste from a sheet.
const CANONICAL = [
  'lead_id','company_name','category','subcategory','country','city','language',
  'website','instagram_url','decision_maker_name','decision_maker_role',
  'email','phone_whatsapp','retreat_history','upcoming_retreat_signal',
  'audience_size_proxy','price_level','icp_score','intent_score','final_priority',
] as const;
type CanonicalField = (typeof CANONICAL)[number];

const ALIAS: Record<string, CanonicalField> = {
  // common variants the operator might paste
  'company':           'company_name',
  'name':              'company_name',
  'studio':            'company_name',
  'agency':            'company_name',
  'instagram':         'instagram_url',
  'ig':                'instagram_url',
  'phone':             'phone_whatsapp',
  'whatsapp':          'phone_whatsapp',
  'dm_name':           'decision_maker_name',
  'dm_role':           'decision_maker_role',
  'role':              'decision_maker_role',
  'priority':          'final_priority',
  'score':             'icp_score',
  'fit_score':         'icp_score',
  'timing_score':      'intent_score',
};

function normaliseHeader(h: string): CanonicalField | null {
  const k = h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, '_');
  if ((CANONICAL as readonly string[]).includes(k)) return k as CanonicalField;
  if (ALIAS[k]) return ALIAS[k];
  return null;
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let buf = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { buf += '"'; i++; }
        else { inQuotes = false; }
      } else buf += ch;
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

  const headers = rows[0].map(normaliseHeader);
  const out: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.every(c => c.trim() === '')) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (!h) return;
      const v = (r[idx] ?? '').trim();
      if (v.length > 0) obj[h] = v;
    });
    if (Object.keys(obj).length > 0) out.push(obj);
  }
  return out;
}

function toInt(v: string | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const clamped = Math.max(0, Math.min(100, Math.round(n)));
  return clamped;
}

interface LeadInsert {
  property_id: number;
  lead_id: string | null;
  company_name: string;
  category: string | null;
  subcategory: string | null;
  country: string | null;
  city: string | null;
  language: string | null;
  website: string | null;
  instagram_url: string | null;
  decision_maker_name: string | null;
  decision_maker_role: string | null;
  email: string | null;
  phone_whatsapp: string | null;
  retreat_history: string | null;
  upcoming_retreat_signal: string | null;
  audience_size_proxy: string | null;
  price_level: string | null;
  icp_score: number | null;
  intent_score: number | null;
  final_priority: string | null;
  status: 'raw';
  source: 'csv' | 'manual' | 'scrape';
}

export async function POST(req: Request) {
  let body: { csv?: string; rows?: Record<string, unknown>[]; source?: 'csv' | 'manual' | 'scrape' };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  let raw: Record<string, string>[] = [];
  if (typeof body.csv === 'string' && body.csv.trim().length > 0) {
    raw = parseCsv(body.csv);
  } else if (Array.isArray(body.rows)) {
    raw = body.rows.map(r => {
      const o: Record<string, string> = {};
      for (const [k, v] of Object.entries(r)) {
        const norm = normaliseHeader(k);
        if (norm && v != null && String(v).trim() !== '') o[norm] = String(v).trim();
      }
      return o;
    }).filter(r => Object.keys(r).length > 0);
  } else {
    return NextResponse.json({ error: 'pass csv or rows' }, { status: 400 });
  }

  if (raw.length === 0) {
    return NextResponse.json({ error: 'no rows parsed (header row required, e.g. "company_name,country,city,email")' }, { status: 400 });
  }

  // Per-row validation
  const errors: Array<{ row: number; reason: string }> = [];
  const candidates: LeadInsert[] = [];
  const seenLeadId = new Set<string>();
  const seenEmail = new Set<string>();

  raw.forEach((r, idx) => {
    if (!r.company_name) {
      errors.push({ row: idx + 2 /* +1 header, +1 1-indexed */, reason: 'company_name is required' });
      return;
    }
    if (r.lead_id) {
      if (seenLeadId.has(r.lead_id)) {
        errors.push({ row: idx + 2, reason: `duplicate lead_id within batch: ${r.lead_id}` });
        return;
      }
      seenLeadId.add(r.lead_id);
    }
    if (r.email) {
      const e = r.email.toLowerCase();
      if (seenEmail.has(e)) {
        errors.push({ row: idx + 2, reason: `duplicate email within batch: ${r.email}` });
        return;
      }
      seenEmail.add(e);
    }

    candidates.push({
      property_id: PROPERTY_ID,
      lead_id:                 r.lead_id                 ?? null,
      company_name:            r.company_name,
      category:                r.category                ?? null,
      subcategory:             r.subcategory             ?? null,
      country:                 r.country                 ?? null,
      city:                    r.city                    ?? null,
      language:                r.language                ?? null,
      website:                 r.website                 ?? null,
      instagram_url:           r.instagram_url           ?? null,
      decision_maker_name:     r.decision_maker_name     ?? null,
      decision_maker_role:     r.decision_maker_role     ?? null,
      email:                   r.email                   ?? null,
      phone_whatsapp:          r.phone_whatsapp          ?? null,
      retreat_history:         r.retreat_history         ?? null,
      upcoming_retreat_signal: r.upcoming_retreat_signal ?? null,
      audience_size_proxy:     r.audience_size_proxy     ?? null,
      price_level:             r.price_level             ?? null,
      icp_score:               toInt(r.icp_score),
      intent_score:            toInt(r.intent_score),
      final_priority:          r.final_priority          ?? null,
      status:                  'raw',
      source:                  body.source ?? 'csv',
    });
  });

  if (candidates.length === 0) {
    return NextResponse.json({ error: 'every row failed validation', errors }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // Dedupe against existing rows by lead_id and email
  const leadIds = candidates.map(c => c.lead_id).filter((x): x is string => !!x);
  const emails  = candidates.map(c => c.email).filter((x): x is string => !!x).map(e => e.toLowerCase());

  const existingLeadIds = new Set<string>();
  const existingEmails  = new Set<string>();

  if (leadIds.length > 0) {
    const { data } = await sb.schema('sales').from('leads')
      .select('lead_id').eq('property_id', PROPERTY_ID).in('lead_id', leadIds);
    for (const r of (data ?? []) as { lead_id: string }[]) existingLeadIds.add(r.lead_id);
  }
  if (emails.length > 0) {
    const { data } = await sb.schema('sales').from('leads')
      .select('email').eq('property_id', PROPERTY_ID).in('email', emails);
    for (const r of (data ?? []) as { email: string | null }[]) {
      if (r.email) existingEmails.add(r.email.toLowerCase());
    }
  }

  const toInsert = candidates.filter(c => {
    if (c.lead_id && existingLeadIds.has(c.lead_id)) return false;
    if (c.email && existingEmails.has(c.email.toLowerCase())) return false;
    return true;
  });
  const skipped = candidates.length - toInsert.length;

  // Batch insert
  let inserted = 0;
  let lastError: string | null = null;
  for (let i = 0; i < toInsert.length; i += 100) {
    const batch = toInsert.slice(i, i + 100);
    const { data, error } = await sb.schema('sales').from('leads').insert(batch).select('id');
    if (error) { lastError = error.message; break; }
    inserted += (data ?? []).length;
  }

  return NextResponse.json({
    ok: !lastError,
    parsed: raw.length,
    valid: candidates.length,
    inserted,
    skipped_duplicates: skipped,
    errors,
    error: lastError,
  }, { status: lastError ? 500 : 200 });
}

export function GET() {
  return NextResponse.json({
    endpoint: '/api/sales/leads/upload',
    method: 'POST',
    accepts: { csv: 'string (CSV with header row)', rows: 'Array<Record<field, value>>' },
    canonical_fields: CANONICAL,
    notes: 'company_name is required. lead_id + email are deduped within batch and against existing rows.',
  });
}
