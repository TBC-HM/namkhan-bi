// supabase/functions/parse-pdf-doc/index.ts
//
// OCR-trigger Edge Function for binary PDF documents stored in dms.documents.
// Mirrors the parse-payslip pattern (Deno + Anthropic + service-role Supabase
// client). Called by public.skill_trigger_doc_ocr SQL skill (#89).
//
// POST body: { doc_id: uuid, max_chars?: int=50000 }
// On success: returns { ok:true, doc_id, chars_extracted, preview, ms }
//             and UPDATEs dms.documents SET body_markdown=..., ocr_status='ok',
//             ocr_attempted_at=now() WHERE doc_id=:doc_id
// On failure: returns { ok:false, error, doc_id, ms } with HTTP 500
//             and UPDATEs ocr_status='error', ocr_error=...

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function getAnthropicKey(supabase: any): Promise<string> {
  const envKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (envKey) return envKey;
  const { data, error } = await supabase.rpc('vault_get_secret', { p_name: 'ANTHROPIC_API_KEY' });
  if (error || !data) throw new Error('ANTHROPIC_API_KEY missing from env and vault');
  return data;
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

const SYSTEM_PROMPT =
  'Extract all readable text from this PDF as well-structured Markdown. ' +
  'Preserve headings, lists, tables (as Markdown pipe tables), and key/value pairs. ' +
  'Skip page numbers and headers/footers. ' +
  'Return ONLY the extracted markdown — no preamble, no explanation.';

Deno.serve(async (req: Request) => {
  const start = Date.now();
  let docId: string | null = null;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    docId = body.doc_id ?? null;
    const maxChars: number = Math.min(Math.max(Number(body.max_chars) || 50000, 1000), 200000);
    if (!docId) throw new Error('Missing doc_id');

    // 1) Load dms.documents row via SECURITY DEFINER RPC (dms not exposed to PostgREST)
    const { data: docRows, error: docErr } = await supabase.rpc('_ocr_load_doc', { p_doc_id: docId });
    if (docErr) throw new Error(`Load doc failed: ${docErr.message}`);
    const doc = Array.isArray(docRows) ? docRows[0] : docRows;
    if (!doc) throw new Error(`Doc ${docId} not found`);
    if (!doc.storage_bucket || !doc.storage_path) {
      throw new Error(`Doc ${docId} has no storage_bucket/storage_path`);
    }

    // 2) Mark as in-flight
    await supabase.rpc('_ocr_mark_running', { p_doc_id: docId });

    // 3) Download the PDF from Storage
    const { data: blob, error: dlErr } = await supabase.storage
      .from(doc.storage_bucket)
      .download(doc.storage_path);
    if (dlErr) throw new Error(`Storage download failed (${doc.storage_bucket}/${doc.storage_path}): ${dlErr.message}`);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const base64 = toBase64(bytes);

    // 4) Send to Claude Sonnet 4.5 with a document content block
    const apiKey = await getAnthropicKey(supabase);
    const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: base64 },
              },
              { type: 'text', text: 'Extract this PDF as Markdown per the system instructions.' },
            ],
          },
        ],
      }),
    });

    if (!claudeResp.ok) {
      const errText = await claudeResp.text();
      throw new Error(`Anthropic ${claudeResp.status}: ${errText.slice(0, 500)}`);
    }
    const claudeJson = await claudeResp.json();
    const markdown: string = (claudeJson.content ?? [])
      .filter((b: any) => b?.type === 'text')
      .map((b: any) => b.text || '')
      .join('\n')
      .trim();
    if (!markdown) throw new Error('Claude returned no text');

    const truncated = markdown.length > maxChars ? markdown.slice(0, maxChars) : markdown;

    // 5) Persist via SECURITY DEFINER RPC
    const { error: updErr } = await supabase.rpc('_ocr_save_result', {
      p_doc_id: docId,
      p_body_markdown: truncated,
    });
    if (updErr) throw new Error(`Update body_markdown failed: ${updErr.message}`);

    const preview = truncated.slice(0, 200);
    const usage = claudeJson.usage ?? {};

    return new Response(
      JSON.stringify({
        ok: true,
        doc_id: docId,
        chars_extracted: truncated.length,
        chars_full: markdown.length,
        truncated: markdown.length > maxChars,
        preview,
        model: 'claude-sonnet-4-5-20250929',
        input_tokens: usage.input_tokens ?? null,
        output_tokens: usage.output_tokens ?? null,
        ms: Date.now() - start,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (docId) {
      try {
        await supabase.rpc('_ocr_mark_error', { p_doc_id: docId, p_err: msg });
      } catch (_) { /* swallow */ }
    }
    return new Response(
      JSON.stringify({ ok: false, doc_id: docId, error: msg, ms: Date.now() - start }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
