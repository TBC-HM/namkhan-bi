// app/api/legal/docs/summarize/route.ts
// POST /api/legal/docs/summarize
// Body: { doc_id: string }
// Pulls bytes from dms-docs → extracts text (with PDF OCR fallback) → asks
// Claude Sonnet for a tight 4-6-line counsel-grade summary → writes it to
// dms.documents.summary so the ★ note marker shows up across the register.
// Returns { ok, summary, doc_id }.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { extractText } from '@/lib/docs/extract';
import { callAnthropic, isLlmOk } from '@/lib/legal-memo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

const SYSTEM = `You are a senior in-house counsel producing one-paragraph summaries of legal documents for a CLO dashboard.
Audience: a hospitality-group operator + outside counsel who skim summaries to triage their next action.
Style: precise, dense, neutral, no marketing tone. Lead with WHO, WHAT, WHEN. End with the IMMEDIATE
implication for the operator (deadline / counterparty next move / claim quantum).
Format: 4 to 6 lines. Plain text, no headers, no bullet points. No greetings, no closings. Never invent dates or amounts.
If the document is in Lao or Thai, summarize in English regardless of the source language. Mention the source language in the first line.`;

export async function POST(req: NextRequest) {
  let body: { doc_id?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }
  const docId = (body.doc_id ?? '').trim();
  if (!docId) return NextResponse.json({ ok: false, error: 'doc_id required' }, { status: 400 });

  const supabase = getSupabaseAdmin();

  // Look up file location + meta. fn_doc_file_info is a SECURITY DEFINER
  // helper that already exists for the preview/download flow.
  const { data: info, error: infoErr } = await supabase.rpc('fn_doc_file_info', { p_doc_id: docId });
  if (infoErr) return NextResponse.json({ ok: false, error: `lookup: ${infoErr.message}` }, { status: 500 });
  const row = (Array.isArray(info) ? info[0] : info) as
    | { storage_bucket: string | null; storage_path: string | null; file_name: string | null; mime: string | null }
    | null;
  if (!row) return NextResponse.json({ ok: false, error: 'doc not found' }, { status: 404 });
  if (!row.storage_bucket || !row.storage_path) {
    return NextResponse.json({ ok: false, error: 'no stored file for this doc' }, { status: 400 });
  }

  // Pull bytes from storage.
  const { data: blob, error: dlErr } = await supabase.storage.from(row.storage_bucket).download(row.storage_path);
  if (dlErr || !blob) return NextResponse.json({ ok: false, error: `download: ${dlErr?.message ?? 'no blob'}` }, { status: 500 });
  const buffer = Buffer.from(await blob.arrayBuffer());

  // Extract text. Empty string is fine — Claude can still summarize from
  // filename + title if the body is empty, though quality drops.
  const text = await extractText({ buffer, mimeType: row.mime ?? '', fileName: row.file_name ?? 'doc' });

  // Pull title for context (via the public bridge view).
  const { data: meta } = await supabase
    .from('v_doc_register')
    .select('title')
    .eq('doc_id', docId)
    .maybeSingle();
  const title = (meta as { title?: string | null } | null)?.title ?? row.file_name ?? '(untitled)';

  // Hard-cap extracted text so we don't burn tokens on multi-hundred-page PDFs.
  const TEXT_CAP = 60_000;
  const clipped = text.slice(0, TEXT_CAP);

  const userPrompt = `Document title: ${title}\nDocument filename: ${row.file_name ?? '—'}\nMIME: ${row.mime ?? '—'}\n\n--- Document text follows ---\n${clipped}`;
  const r = await callAnthropic({ systemPrompt: SYSTEM, userPrompt, maxTokens: 600 });
  if (!isLlmOk(r)) return NextResponse.json({ ok: false, error: r.error }, { status: 502 });

  const summary = r.text.trim();

  // Persist via fn_doc_remap (it honours empty-string-as-clear semantics so
  // sending a non-empty string just sets the column).
  const { error: remapErr } = await supabase.rpc('fn_doc_remap', { p_doc_id: docId, p_summary: summary });
  if (remapErr) {
    // If persistence fails we still return the summary — caller can show it.
    return NextResponse.json({ ok: true, summary, doc_id: docId, persist_error: remapErr.message });
  }

  return NextResponse.json({ ok: true, summary, doc_id: docId });
}
