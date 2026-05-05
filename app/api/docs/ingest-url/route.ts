// app/api/docs/ingest-url/route.ts
// POST /api/docs/ingest-url  body: { url: string, title?: string }
//
// Fetches a URL and ingests its body as a doc. Special-cases:
//   - Google Sheets URLs → auto-converts to CSV export endpoint (must be public-share)
//   - Google Docs URLs   → auto-converts to text export endpoint
//   - Anything else      → fetches raw, treats response by Content-Type

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { extractText } from '@/lib/docs/extract';
import { classifyDocument } from '@/lib/docs/classifier';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 23-value allowlist (mirrors /api/docs/ingest)
const ALLOWED_DOC_TYPES = new Set([
  'legal','compliance','insurance','sop','brand','template','meeting_note','markdown',
  'kb_article','vendor_doc','hr_doc','guest_doc','financial','recipe_doc',
  'training_material','audit','external_feed','other',
  'partner','presentation','research','marketing','note',
]);
function safeDocType(raw: string): string {
  if (ALLOWED_DOC_TYPES.has(raw)) return raw;
  const t = (raw || '').toLowerCase();
  if (t.includes('train') || t.includes('manual'))             return 'training_material';
  if (t.includes('partner') || t.includes('vendor'))           return 'partner';
  if (t.includes('procedure') || t.includes('sop'))            return 'sop';
  if (t.includes('audit') || t.includes('inspection'))         return 'audit';
  if (t.includes('financ') || t.includes('budget'))            return 'financial';
  return 'other';
}

const ALLOWED_LANGS = new Set(['lo','en','fr','th','vi','es','de','it','zh','ja','ko','multi','mixed']);
function safeLang(raw: any): string {
  if (typeof raw !== 'string') return 'en';
  const t = raw.toLowerCase().trim();
  if (ALLOWED_LANGS.has(t)) return t;
  if (t.startsWith('en')) return 'en';
  if (t.startsWith('la')) return 'lo';
  if (t.startsWith('fr')) return 'fr';
  return 'en';
}

function bucketForSensitivity(s: string): string {
  switch (s) {
    case 'restricted':   return 'documents-restricted';
    case 'confidential': return 'documents-confidential';
    case 'public':       return 'documents-public';
    default:             return 'documents-internal';
  }
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
}

/**
 * Convert a public-share Google Sheets/Docs URL to its raw export endpoint.
 * Returns the export URL + a friendly default title + the expected mime.
 *
 * Sheets pattern: https://docs.google.com/spreadsheets/d/{ID}/edit#gid={GID}
 *   → https://docs.google.com/spreadsheets/d/{ID}/export?format=csv&gid={GID}
 *
 * Docs pattern:   https://docs.google.com/document/d/{ID}/edit
 *   → https://docs.google.com/document/d/{ID}/export?format=txt
 */
function googleExportUrl(input: string): { url: string; mime: string; suggestedExt: string; kind: 'sheet'|'doc'|'other' } {
  try {
    const u = new URL(input);
    if (u.hostname !== 'docs.google.com' && u.hostname !== 'drive.google.com') {
      return { url: input, mime: '', suggestedExt: '', kind: 'other' };
    }

    // /spreadsheets/d/{ID}/...
    const sheetMatch = u.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (sheetMatch) {
      const id = sheetMatch[1];
      // gid lives in either querystring or fragment
      const gid = u.searchParams.get('gid') ||
                  (u.hash.match(/gid=(\d+)/)?.[1]) || '0';
      return {
        url: `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`,
        mime: 'text/csv',
        suggestedExt: '.csv',
        kind: 'sheet',
      };
    }

    // /document/d/{ID}/...
    const docMatch = u.pathname.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
    if (docMatch) {
      const id = docMatch[1];
      return {
        url: `https://docs.google.com/document/d/${id}/export?format=txt`,
        mime: 'text/plain',
        suggestedExt: '.txt',
        kind: 'doc',
      };
    }
  } catch {}
  return { url: input, mime: '', suggestedExt: '', kind: 'other' };
}

export async function POST(req: NextRequest) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  let body: { url?: string; title?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }
  const inputUrl = (body.url || '').trim();
  if (!/^https?:\/\//i.test(inputUrl)) {
    return NextResponse.json({ ok: false, error: 'url required, must be http(s)' }, { status: 400 });
  }

  // Resolve to fetchable URL (Google Sheets/Docs auto-export)
  const { url: fetchUrl, mime: hintMime, suggestedExt, kind } = googleExportUrl(inputUrl);

  // Fetch the resource
  let resp: Response;
  try {
    resp = await fetch(fetchUrl, {
      redirect: 'follow',
      headers: { 'user-agent': 'NamkhanBI/1.0 (+ingest-url)' },
      signal: AbortSignal.timeout(20000),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, stage: 'fetch', error: e?.message ?? 'fetch failed' }, { status: 502 });
  }
  if (!resp.ok) {
    if (kind === 'sheet' || kind === 'doc') {
      return NextResponse.json({
        ok: false, stage: 'fetch',
        error: `Google ${kind} returned ${resp.status} — sheet must be shared "Anyone with link can view"`,
      }, { status: 502 });
    }
    return NextResponse.json({ ok: false, stage: 'fetch', error: `${resp.status}` }, { status: 502 });
  }

  const arrayBuf = await resp.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);
  const mime = hintMime || resp.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream';
  const fileName = (body.title || (kind === 'sheet' ? 'Google Sheet' : kind === 'doc' ? 'Google Doc' : new URL(inputUrl).pathname.split('/').pop() || 'web-doc')) + suggestedExt;

  // Extract text
  const extracted = await extractText({ buffer, mimeType: mime, fileName });

  // Classify
  let cls;
  try { cls = await classifyDocument({ fileName, mimeType: mime, extractedText: extracted }); }
  catch (e: any) {
    return NextResponse.json({ ok: false, stage: 'classifier', error: e?.message }, { status: 500 });
  }
  cls.doc_type = safeDocType(cls.doc_type as string) as typeof cls.doc_type;
  cls.language = safeLang(cls.language) as typeof cls.language;

  const finalBucket = bucketForSensitivity(cls.sensitivity);
  const year = (cls.valid_from?.slice(0,4) || cls.period_year?.toString() || new Date().getFullYear().toString());
  const subtypeSlug = slug(cls.doc_subtype || cls.doc_type);
  const titleSlug = slug(cls.title);
  const finalPath = `${cls.doc_type}/${year}/${subtypeSlug}/${titleSlug}-${Date.now().toString(36)}${suggestedExt || ''}`;

  // Upload extracted bytes
  const { error: upErr } = await admin.storage.from(finalBucket)
    .upload(finalPath, buffer, { contentType: mime, upsert: false });
  if (upErr) return NextResponse.json({ ok: false, stage: 'storage_upload', error: upErr.message }, { status: 500 });

  // Insert
  const insertRow = {
    property_id: 260955,
    doc_type: cls.doc_type, doc_subtype: cls.doc_subtype, importance: cls.importance,
    title: cls.title, title_lo: cls.title_lo, title_fr: cls.title_fr,
    summary: cls.summary,
    body_markdown: extracted.length >= 200 ? extracted.slice(0, 200_000) : null,
    storage_bucket: finalBucket, storage_path: finalPath,
    mime, file_size_bytes: buffer.byteLength, file_name: fileName,
    language: cls.language, status: 'active', sensitivity: cls.sensitivity,
    keywords: cls.keywords, tags: [...(cls.tags || []), 'ingest:url', `via:${kind}`].slice(0, 8),
    external_party: cls.external_party, parties: cls.parties,
    valid_from: cls.valid_from, valid_until: cls.valid_until, signed: cls.signed,
    reference_number: cls.reference_number, amount: cls.amount,
    amount_currency: cls.amount_currency, period_year: cls.period_year,
    external_url: inputUrl,
    raw: { ingested_from_url: inputUrl, classifier_version: 'url-v1', google_kind: kind },
  };

  const { data: inserted, error: insErr } = await admin.schema('docs').from('documents')
    .insert(insertRow)
    .select('doc_id, title, doc_type, importance, sensitivity, storage_bucket, storage_path, summary, tags, keywords, external_url')
    .single();
  if (insErr) {
    await admin.storage.from(finalBucket).remove([finalPath]);
    return NextResponse.json({ ok: false, stage: 'db_insert', error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    doc: inserted,
    extracted_chars: extracted.length,
    google_kind: kind,
    classification: cls,
  });
}
