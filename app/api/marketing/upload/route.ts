// POST /api/marketing/upload
// Real upload handler for /marketing/upload. Replaces the Phase-2 mock.
//
// Flow:
//   1. Receive multipart with one or more files (field name: "file" or "files")
//   2. For each file:
//      a. Validate mime + size
//      b. Compute SHA-256 (server-side)
//      c. Upload bytes to media-raw bucket at path: yyyy/mm/<sha>__<safe_filename>
//      d. INSERT row in marketing.media_assets (status='ingested')
//   3. Return { ok, results: [...] }
//
// Auth model (v1): the dashboard is password-gated at the frontend. This route
// uses the service-role key — anyone who reaches /marketing/upload can call
// this endpoint. Acceptable for single-owner v1; tighten later with real Auth.

import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  // RAW formats accepted by media-raw bucket policy
  'image/x-canon-cr2',
  'image/x-nikon-nef',
  'image/x-sony-arw',
  'image/x-adobe-dng',
]);

const MAX_BYTES = 200 * 1024 * 1024; // 200 MB per file (bucket allows 500 MB; we cap lower)

function safeName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 200);
}

function inferAssetType(mime: string): 'photo' | 'video' | 'raw_dng' {
  if (mime === 'image/x-adobe-dng') return 'raw_dng';
  if (mime.startsWith('video/')) return 'video';
  return 'photo';
}

export async function POST(req: Request) {
  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (e: any) {
    return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 });
  }

  // Collect files from "file" or "files" fields
  const raw = [...form.getAll('file'), ...form.getAll('files')];
  const files: File[] = raw.filter((x): x is File => x instanceof File && x.size > 0);
  if (files.length === 0) {
    return NextResponse.json({ error: 'No files in upload' }, { status: 400 });
  }

  const photographer = (form.get('photographer') ?? '') as string;
  const license      = (form.get('license') ?? 'owned') as string;
  const campaignTag  = (form.get('campaign_tag') ?? '') as string;

  const results: Array<{ filename: string; ok: boolean; asset_id?: string; raw_path?: string; error?: string }> = [];

  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');

  for (const file of files) {
    try {
      if (file.size > MAX_BYTES) {
        results.push({ filename: file.name, ok: false, error: `Too large: ${(file.size/1e6).toFixed(1)}MB > 200MB limit` });
        continue;
      }
      if (!ALLOWED_MIME.has(file.type)) {
        results.push({ filename: file.name, ok: false, error: `Unsupported mime: ${file.type}` });
        continue;
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
      const path = `${yyyy}/${mm}/${sha256.slice(0, 8)}__${safeName(file.name)}`;

      // Upload to media-raw bucket
      const { error: upErr } = await admin.storage
        .from('media-raw')
        .upload(path, buffer, {
          contentType: file.type,
          upsert: false,
        });

      // Duplicate (sha collision in same path) — treat as success referencing existing row
      if (upErr && !/already exists/i.test(upErr.message)) {
        results.push({ filename: file.name, ok: false, error: `Storage: ${upErr.message}` });
        continue;
      }

      // Insert media_assets row (skip if duplicate sha — DB has unique idx)
      const { data: ins, error: insErr } = await admin
        .schema('marketing')
        .from('media_assets')
        .insert({
          sha256,
          original_filename: file.name,
          asset_type: inferAssetType(file.type),
          mime_type: file.type,
          raw_path: path,
          file_size_bytes: file.size,
          photographer: photographer || null,
          license_type: license || 'owned',
          status: 'ingested',
        })
        .select('asset_id')
        .maybeSingle();

      if (insErr) {
        // If unique-violation on sha256, look up existing row instead
        if (/duplicate key|unique/i.test(insErr.message)) {
          const { data: existing } = await admin
            .schema('marketing')
            .from('media_assets')
            .select('asset_id')
            .eq('sha256', sha256)
            .maybeSingle();
          results.push({ filename: file.name, ok: true, asset_id: existing?.asset_id, raw_path: path });
          continue;
        }
        results.push({ filename: file.name, ok: false, error: `DB: ${insErr.message}` });
        continue;
      }

      results.push({ filename: file.name, ok: true, asset_id: ins?.asset_id, raw_path: path });
    } catch (e: any) {
      results.push({ filename: file.name, ok: false, error: e?.message ?? 'Unknown error' });
    }
  }

  const failed = results.filter(r => !r.ok).length;
  return NextResponse.json({
    ok: failed === 0,
    uploaded: results.length - failed,
    failed,
    results,
    meta: { campaign_tag: campaignTag || null },
  });
}
