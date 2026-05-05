// app/api/docs/ingest/route.ts
// POST /api/docs/ingest
// ----------------------------------------------------------------------------
// Receives a file that's already been uploaded to a temporary staging path,
// classifies it via Claude Haiku, then:
//   1. Moves/copies it to the final bucket based on detected sensitivity
//   2. Inserts a row into docs.documents with full extracted metadata
//
// Body (multipart/form-data):
//   file        — the actual file blob
//   file_name   — original filename
// ----------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { extractText } from '@/lib/docs/extract';
import { classifyDocument } from '@/lib/docs/classifier';
import { classifyPdfWithVision } from '@/lib/docs/visionOcr';
import { chunkBody } from '@/lib/docs/chunker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90; // bumped from 60 — large PDFs need headroom

// 23 doc_types allowed by the docs.documents check constraint.
// If classifier returns anything else, remap to nearest allowed type.
const ALLOWED_DOC_TYPES = new Set([
  // 18 original (pre-existing)
  'legal','compliance','insurance','sop','brand','template','meeting_note','markdown',
  'kb_article','vendor_doc','hr_doc','guest_doc','financial','recipe_doc',
  'training_material','audit','external_feed','other',
  // 5 added by v1 classifier
  'partner','presentation','research','marketing','note',
]);

// Same belt-and-braces pattern for language: remap to allowed enum.
const ALLOWED_LANGUAGES = new Set([
  'lo','en','fr','th','vi','es','de','it','zh','ja','ko','multi','mixed',
]);
function safeLanguage(raw: any): string {
  if (typeof raw !== 'string') return 'en';
  const t = raw.toLowerCase().trim();
  if (ALLOWED_LANGUAGES.has(t)) return t;
  // Common drift: 'lao' → 'lo', 'english' → 'en', etc.
  if (t.startsWith('la')) return 'lo';
  if (t.startsWith('en')) return 'en';
  if (t.startsWith('fr')) return 'fr';
  if (t.startsWith('sp') || t.startsWith('es')) return 'es';
  if (t.startsWith('th')) return 'th';
  if (t.startsWith('vi')) return 'vi';
  if (t.startsWith('de') || t.startsWith('ge')) return 'de';
  if (t.includes('mix') || t.includes('multi')) return 'multi';
  return 'en'; // safe fallback
}

function safeDocType(raw: string): string {
  if (ALLOWED_DOC_TYPES.has(raw)) return raw;
  const t = (raw || '').toLowerCase();
  // Smart remap based on common AI variants
  if (t.includes('train') || t.includes('manual'))             return 'training_material';
  if (t.includes('partner') || t.includes('hilton') || t.includes('slh') || t.includes('vendor')) return 'partner';
  if (t.includes('procedure') || t.includes('sop'))            return 'sop';
  if (t.includes('audit') || t.includes('inspection'))         return 'audit';
  if (t.includes('contract') || t.includes('legal') || t.includes('agreement')) return 'legal';
  if (t.includes('insur'))                                     return 'insurance';
  if (t.includes('financ') || t.includes('budget') || t.includes('invoice')) return 'financial';
  if (t.includes('hr') || t.includes('staff') || t.includes('payroll')) return 'hr_doc';
  if (t.includes('research') || t.includes('study') || t.includes('report')) return 'research';
  if (t.includes('present') || t.includes('deck') || t.includes('slide')) return 'presentation';
  if (t.includes('market') || t.includes('campaign') || t.includes('brand')) return 'marketing';
  if (t.includes('template') || t.includes('form'))            return 'template';
  if (t.includes('compliance') || t.includes('regulation'))    return 'compliance';
  if (t.includes('note') || t.includes('memo') || t.includes('meeting')) return 'meeting_note';
  if (t.includes('kb') || t.includes('article') || t.includes('guide')) return 'kb_article';
  return 'other';
}

// Map sensitivity → bucket
function bucketForSensitivity(s: string): string {
  switch (s) {
    case 'restricted':   return 'documents-restricted';
    case 'confidential': return 'documents-confidential';
    case 'public':       return 'documents-public';
    default:             return 'documents-internal';
  }
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

export async function POST(req: NextRequest) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  // --- Parse body — supports two modes:
  //   A) multipart/form-data with file blob (small files, ≤4 MB)
  //   B) application/json {staging_bucket, staging_path, file_name} (large files
  //      that bypassed Vercel via signed-URL upload to Supabase Storage)
  const contentType = req.headers.get('content-type') || '';

  let buffer: Buffer;
  let fileName: string;
  let mimeType: string;
  let sizeBytes: number;
  // For mode B we'll need to clean up the staging file after the move
  let stagingBucket: string | null = null;
  let stagingPath: string | null = null;

  if (contentType.includes('application/json')) {
    // Mode B — file already in storage, fetch by ref
    let body: { staging_bucket?: string; staging_path?: string; file_name?: string; mime?: string };
    try { body = await req.json(); }
    catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }

    if (!body.staging_bucket || !body.staging_path || !body.file_name) {
      return NextResponse.json({
        ok: false,
        error: 'missing staging_bucket / staging_path / file_name',
      }, { status: 400 });
    }

    stagingBucket = body.staging_bucket;
    stagingPath = body.staging_path;
    fileName = body.file_name;

    // Pull file bytes from Supabase Storage (no Vercel body limit on this side)
    const { data: blob, error: dlErr } = await admin.storage
      .from(stagingBucket)
      .download(stagingPath);
    if (dlErr || !blob) {
      return NextResponse.json({
        ok: false, stage: 'staging_download',
        error: dlErr?.message ?? 'staging file not found',
      }, { status: 500 });
    }
    buffer = Buffer.from(await blob.arrayBuffer());
    mimeType = body.mime || blob.type || 'application/octet-stream';
    sizeBytes = buffer.length;
  } else {
    // Mode A — multipart upload (small files)
    let form: FormData;
    try { form = await req.formData(); }
    catch { return NextResponse.json({ ok: false, error: 'invalid_form' }, { status: 400 }); }

    const file = form.get('file') as File | null;
    fileName = (form.get('file_name') as string | null) || file?.name || 'untitled';
    if (!file) return NextResponse.json({ ok: false, error: 'no_file' }, { status: 400 });

    mimeType = file.type || 'application/octet-stream';
    buffer = Buffer.from(await file.arrayBuffer());
    sizeBytes = buffer.length;
  }

  // --- 0. SHA-256 dedup (silent skip): if same file already ingested, return existing row.
  const crypto = await import('crypto');
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const { data: existing } = await admin
    .schema('docs').from('documents')
    .select('doc_id, title, doc_type, importance, sensitivity, storage_bucket, storage_path, valid_from, valid_until, external_party, summary, tags, keywords')
    .eq('file_checksum', sha256)
    .limit(1)
    .maybeSingle();
  if (existing) {
    // Clean up any staging upload — we won't use it
    if (stagingBucket && stagingPath) {
      try { await admin.storage.from(stagingBucket).remove([stagingPath]); } catch {}
    }
    return NextResponse.json({
      ok: true,
      doc: existing,
      extracted_chars: 0,
      chunks: 0,
      vision_ocr: false,
      deduplicated: true,  // ← internal flag; UI ignores it, looks like normal success
    });
  }

  // --- 1. Extract text (text-layer fast path)
  let extractedText = await extractText({ buffer, mimeType, fileName });
  let usedVisionOcr = false;
  let cls: Awaited<ReturnType<typeof classifyDocument>> | undefined;

  // --- 1b. Vision OCR fallback for scanned PDFs
  // Triggers when: PDF + (≤30 MB to fit in Anthropic limit) + text-layer extraction < 200 chars
  const isPdf = mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
  const fitsVision = sizeBytes <= 30 * 1024 * 1024;
  if (isPdf && fitsVision && extractedText.length < 200) {
    try {
      const visionResult = await classifyPdfWithVision({ pdfBuffer: buffer, fileName });
      extractedText = visionResult.extracted_text || extractedText;
      cls = visionResult;
      usedVisionOcr = true;
    } catch (e: any) {
      console.error('[docs/ingest] vision ocr failed:', e?.message);
      // Fall through to text-only classifier
    }
  }

  // --- 2. Classify with Claude Haiku (text-only path, if vision didn't already)
  if (!cls) {
    try {
      cls = await classifyDocument({ fileName, mimeType, extractedText });
    } catch (e: any) {
      return NextResponse.json({
        ok: false,
        stage: 'classifier',
        error: e?.message ?? 'classifier_failed',
      }, { status: 500 });
    }
  }

  // --- 2b. Validate + remap classifier doc_type AND language to enforce DB constraints
  const originalDocType = cls.doc_type as string;
  const safeType = safeDocType(originalDocType);
  if (safeType !== originalDocType) {
    cls.doc_type = safeType as typeof cls.doc_type;
    cls.tags = [...(cls.tags || []), `remap:${originalDocType}->${safeType}`].slice(0, 8);
  }
  const originalLang = (cls.language as any) ?? 'en';
  const safeLang = safeLanguage(originalLang);
  if (safeLang !== originalLang) {
    cls.tags = [...(cls.tags || []), `lang_remap:${originalLang}->${safeLang}`].slice(0, 8);
  }
  cls.language = safeLang as typeof cls.language;

  // --- 3. Pick bucket + final path
  const finalBucket = bucketForSensitivity(cls.sensitivity);
  const year = (cls.valid_from?.slice(0, 4) || cls.period_year?.toString() || new Date().getFullYear().toString());
  const subtypeSlug = slug(cls.doc_subtype || cls.doc_type);
  const titleSlug = slug(cls.title);
  const ext = (fileName.match(/\.[a-z0-9]+$/i)?.[0] || '').toLowerCase();
  const finalPath = `${cls.doc_type}/${year}/${subtypeSlug}/${titleSlug}-${Date.now().toString(36)}${ext}`;

  // --- 4. Upload to bucket
  const { error: upErr } = await admin.storage
    .from(finalBucket)
    .upload(finalPath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (upErr) {
    return NextResponse.json({
      ok: false,
      stage: 'storage_upload',
      error: upErr.message,
      attempted_bucket: finalBucket,
      attempted_path: finalPath,
    }, { status: 500 });
  }

  // --- 5. INSERT INTO docs.documents
  // Store body_markdown whenever we have meaningful text (≥200 chars).
  // This is what Q/A and search rely on. Cap at 200k chars to keep rows small.
  const storeBody = extractedText.length >= 200;

  const insertRow = {
    property_id: 260955,
    doc_type: cls.doc_type,
    doc_subtype: cls.doc_subtype,
    importance: cls.importance,
    title: cls.title,
    title_lo: cls.title_lo,
    title_fr: cls.title_fr,
    summary: cls.summary,
    body_markdown: storeBody ? extractedText.slice(0, 200_000) : null,
    storage_bucket: finalBucket,
    storage_path: finalPath,
    mime: mimeType,
    file_size_bytes: sizeBytes,
    file_name: fileName,
    file_checksum: sha256,
    language: cls.language,
    status: 'active',
    sensitivity: cls.sensitivity,
    keywords: cls.keywords,
    tags: cls.tags,
    external_party: cls.external_party,
    parties: cls.parties,
    valid_from: cls.valid_from,
    valid_until: cls.valid_until,
    signed: cls.signed,
    reference_number: cls.reference_number,
    amount: cls.amount,
    amount_currency: cls.amount_currency,
    period_year: cls.period_year,
    raw: {
      classifier_model: 'claude-haiku-4-5',
      classifier_version: usedVisionOcr ? 'v1-vision' : 'v1',
      vision_ocr: usedVisionOcr,
    },
  };

  const { data: inserted, error: insErr } = await admin
    .schema('docs')
    .from('documents')
    .insert(insertRow)
    .select('doc_id, title, doc_type, importance, sensitivity, storage_bucket, storage_path, valid_from, valid_until, external_party, summary, tags, keywords')
    .single();

  if (insErr) {
    // Roll back the storage upload
    await admin.storage.from(finalBucket).remove([finalPath]);
    return NextResponse.json({
      ok: false,
      stage: 'db_insert',
      error: insErr.message,
    }, { status: 500 });
  }

  // --- 6. Build chunks for paragraph-level retrieval (only if we have body)
  let chunkCount = 0;
  if (storeBody && extractedText.length >= 200) {
    const chunks = chunkBody(extractedText.slice(0, 200_000));
    if (chunks.length > 0) {
      const rows = chunks.map(c => ({
        doc_id: inserted.doc_id,
        chunk_idx: c.chunk_idx,
        page_num: c.page_num,
        content: c.content,
        char_start: c.char_start,
        char_end: c.char_end,
      }));
      const { error: chunkErr } = await admin.schema('docs').from('chunks').insert(rows);
      if (chunkErr) {
        console.error('[docs/ingest] chunk insert failed:', chunkErr.message);
        // Non-fatal — doc is still searchable via doc-level tsv
      } else {
        chunkCount = rows.length;
      }
    }
  }

  // Supersession detection: if this new doc looks like a newer version of an
  // existing one (same external_party + same doc_subtype + later valid_from),
  // mark the old one as superseded and link parent_doc_id.
  let supersededId: string | null = null;
  if (cls.external_party && cls.doc_subtype && cls.valid_from) {
    try {
      const { data: candidates } = await admin
        .schema('docs')
        .from('documents')
        .select('doc_id, valid_from, title')
        .eq('external_party', cls.external_party)
        .eq('doc_subtype', cls.doc_subtype)
        .eq('is_current_version', true)
        .neq('doc_id', inserted.doc_id)
        .lt('valid_from', cls.valid_from)
        .order('valid_from', { ascending: false })
        .limit(1);
      if (candidates && candidates.length > 0) {
        supersededId = candidates[0].doc_id;
        // Mark old as superseded
        await admin.schema('docs').from('documents').update({
          is_current_version: false,
          tags: [...(cls.tags || []), `superseded_by:${inserted.doc_id}`].slice(0, 8),
        }).eq('doc_id', supersededId);
        // Mark new with parent_doc_id pointer + supersedes tag
        await admin.schema('docs').from('documents').update({
          parent_doc_id: supersededId,
          version: 2, // bump (could be smarter — read parent's version + 1)
          tags: [...(cls.tags || []), `supersedes:${supersededId}`].slice(0, 8),
        }).eq('doc_id', inserted.doc_id);
      }
    } catch (e: any) {
      console.error('[docs/ingest] supersession check failed:', e?.message);
    }
  }

  // Mode B: success — clean up the staging file (best-effort, ignore errors)
  if (stagingBucket && stagingPath) {
    try {
      await admin.storage.from(stagingBucket).remove([stagingPath]);
    } catch {}
  }

  return NextResponse.json({
    ok: true,
    doc: inserted,
    extracted_chars: extractedText.length,
    chunks: chunkCount,
    vision_ocr: usedVisionOcr,
    superseded_doc_id: supersededId,
    classification: cls,
  });
}
