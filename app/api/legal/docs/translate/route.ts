// app/api/legal/docs/translate/route.ts
// POST /api/legal/docs/translate
// Body: { doc_id: string, to?: 'en'|'lo'|'fr'|'es' }   (default 'en')
// Pulls bytes → extracts text → asks Claude Sonnet to translate the body
// faithfully into the target language. Returns { ok, translation, source_lang,
// to, doc_id }. Does NOT persist by default — caller can save the result.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { extractText } from '@/lib/docs/extract';
import { callAnthropic } from '@/lib/legal-memo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const LANG_LABEL: Record<string, string> = {
  en: 'English',
  lo: 'Lao',
  fr: 'French',
  es: 'Spanish',
  th: 'Thai',
};

function systemPrompt(targetLabel: string): string {
  return `You translate legal and operational documents into ${targetLabel}.
Audience: lawyers and operators. Style: faithful, plain, neutral. Preserve paragraph
structure, headers, lists, dates, money, party names, statute references and document
numbers exactly as in the source. Do NOT summarize, paraphrase, or add commentary. If a
passage is ambiguous, render the most direct meaning. If the source already appears to be
in ${targetLabel}, return it unchanged with a single first line: "(already in ${targetLabel})".
Begin output with no preamble.`;
}

export async function POST(req: NextRequest) {
  let body: { doc_id?: string; to?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }

  const docId = (body.doc_id ?? '').trim();
  const to = (body.to ?? 'en').trim().toLowerCase();
  if (!docId) return NextResponse.json({ ok: false, error: 'doc_id required' }, { status: 400 });
  const targetLabel = LANG_LABEL[to] ?? to.toUpperCase();

  const supabase = getSupabaseAdmin();

  const { data: info, error: infoErr } = await supabase.rpc('fn_doc_file_info', { p_doc_id: docId });
  if (infoErr) return NextResponse.json({ ok: false, error: `lookup: ${infoErr.message}` }, { status: 500 });
  const row = (Array.isArray(info) ? info[0] : info) as
    | { storage_bucket: string | null; storage_path: string | null; file_name: string | null; mime: string | null }
    | null;
  if (!row) return NextResponse.json({ ok: false, error: 'doc not found' }, { status: 404 });
  if (!row.storage_bucket || !row.storage_path) {
    return NextResponse.json({ ok: false, error: 'no stored file for this doc' }, { status: 400 });
  }

  const { data: blob, error: dlErr } = await supabase.storage.from(row.storage_bucket).download(row.storage_path);
  if (dlErr || !blob) return NextResponse.json({ ok: false, error: `download: ${dlErr?.message ?? 'no blob'}` }, { status: 500 });
  const buffer = Buffer.from(await blob.arrayBuffer());

  const text = await extractText({ buffer, mimeType: row.mime ?? '', fileName: row.file_name ?? 'doc' });
  if (!text.trim()) {
    return NextResponse.json({ ok: false, error: 'no extractable text (try OCR-first for scanned PDFs)' }, { status: 422 });
  }

  // Translation budget: cap input + give Claude room for the full translation.
  const TEXT_CAP = 50_000;
  const clipped = text.slice(0, TEXT_CAP);
  const wasClipped = text.length > TEXT_CAP;

  const userPrompt = `Source filename: ${row.file_name ?? '—'}\nMIME: ${row.mime ?? '—'}\n\nTranslate the following into ${targetLabel}. Preserve structure and named entities exactly:\n\n---\n${clipped}${wasClipped ? '\n\n[truncated at 50k chars]' : ''}`;

  const r = await callAnthropic({ systemPrompt: systemPrompt(targetLabel), userPrompt, maxTokens: 8192 });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 502 });

  return NextResponse.json({
    ok: true,
    doc_id: docId,
    to,
    translation: r.text.trim(),
    file_name: row.file_name,
    truncated: wasClipped,
    usage: r.usage,
  });
}
