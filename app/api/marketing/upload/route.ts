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
import sharp from 'sharp';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Render-media Edge Function MAX_BYTES=4MB. Resize photos to fit under 3.5MB
// so the cron picks them up immediately. Originals over MAX_BYTES were the
// reason 120 assets got stuck in needs_review on 2026-05-03.
const RESIZE_TARGET_BYTES = 3_500_000;
const RESIZE_LONG_EDGE = 2400;
const PHOTO_MIMES = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']);

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

/** Resize a photo so the encoded JPEG fits under RESIZE_TARGET_BYTES.
 *  Returns { buffer, width, height, mime: 'image/jpeg' } on success, or null
 *  if the file is not a photo (RAW / video / unknown). */
async function resizeForIngest(input: Buffer, mime: string): Promise<{ buffer: Buffer; width: number; height: number; mime: string } | null> {
  if (!PHOTO_MIMES.has(mime)) return null;
  // Quality ladder: try 85 → 78 → 70. Longer edge stays at 2400 unless the
  // 70-quality pass still exceeds target, then drop to 1800.
  const attempts: Array<{ longEdge: number; quality: number }> = [
    { longEdge: RESIZE_LONG_EDGE, quality: 85 },
    { longEdge: RESIZE_LONG_EDGE, quality: 78 },
    { longEdge: RESIZE_LONG_EDGE, quality: 70 },
    { longEdge: 1800,             quality: 78 },
    { longEdge: 1800,             quality: 70 },
  ];
  for (const a of attempts) {
    const pipeline = sharp(input, { failOn: 'none' })
      .rotate() // honor EXIF orientation
      .resize({ width: a.longEdge, height: a.longEdge, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: a.quality, mozjpeg: true, chromaSubsampling: '4:4:4' });
    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    if (data.byteLength <= RESIZE_TARGET_BYTES) {
      return { buffer: data, width: info.width, height: info.height, mime: 'image/jpeg' };
    }
  }
  // Last-resort: aggressive — 1400 long edge, q=65
  const last = await sharp(input, { failOn: 'none' })
    .rotate()
    .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 65, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return { buffer: last.data, width: last.info.width, height: last.info.height, mime: 'image/jpeg' };
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

      const originalBuffer = Buffer.from(await file.arrayBuffer());
      const sha256 = crypto.createHash('sha256').update(originalBuffer).digest('hex');

      // Resize photos so they fit under render-media MAX_BYTES (4MB).
      // RAW / video / unknown mimes pass through untouched.
      let storedBuffer: Buffer = originalBuffer;
      let storedMime: string = file.type;
      let storedExt: string = safeName(file.name);
      let widthPx: number | null = null;
      let heightPx: number | null = null;

      const resized = await resizeForIngest(originalBuffer, file.type).catch((e) => {
        console.error('sharp resize failed', file.name, e);
        return null;
      });
      if (resized) {
        storedBuffer = resized.buffer;
        storedMime = resized.mime;
        widthPx = resized.width;
        heightPx = resized.height;
        // Force .jpg extension on resized file to match the new mime
        storedExt = safeName(file.name.replace(/\.(jpe?g|png|heic|heif|webp)$/i, '')) + '.jpg';
      }

      const path = `${yyyy}/${mm}/${sha256.slice(0, 8)}__${storedExt}`;

      // Upload to media-raw bucket
      const { error: upErr } = await admin.storage
        .from('media-raw')
        .upload(path, storedBuffer, {
          contentType: storedMime,
          upsert: false,
        });

      // Duplicate (sha collision in same path) — treat as success referencing existing row
      if (upErr && !/already exists/i.test(upErr.message)) {
        results.push({ filename: file.name, ok: false, error: `Storage: ${upErr.message}` });
        continue;
      }

      // Insert media_assets row (skip if duplicate sha — DB has unique idx).
      // file_size_bytes reflects the STORED file (post-resize), so render-media's
      // .lte('file_size_bytes', MAX_BYTES) filter accepts it.
      const { data: ins, error: insErr } = await admin
        .schema('marketing')
        .from('media_assets')
        .insert({
          sha256,
          original_filename: file.name,
          asset_type: inferAssetType(file.type),
          mime_type: storedMime,
          raw_path: path,
          file_size_bytes: storedBuffer.byteLength,
          width_px: widthPx,
          height_px: heightPx,
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
