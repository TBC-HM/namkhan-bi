#!/usr/bin/env node
// scripts/backfill-media-resize.mjs
// One-shot backfill: pulls every marketing.media_assets row stuck in
// status='needs_review' with file_size_bytes > 4MB, downloads the raw,
// resizes it with sharp, re-uploads to the SAME path (upsert), updates
// the row's file_size_bytes + width/height + status='ingested', and
// lets the existing render-media + tag-media crons take it from there.
//
// Run from repo root:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-media-resize.mjs
// or with a one-liner if you already have .env.local sourced:
//   node --env-file=.env.local scripts/backfill-media-resize.mjs
//
// Idempotent: if a row is already ≤4MB it skips, so re-running is safe.

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}

const RESIZE_TARGET_BYTES = 3_500_000;
const RESIZE_LONG_EDGE    = 2400;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function resize(input) {
  const ladder = [
    { longEdge: RESIZE_LONG_EDGE, quality: 85 },
    { longEdge: RESIZE_LONG_EDGE, quality: 78 },
    { longEdge: RESIZE_LONG_EDGE, quality: 70 },
    { longEdge: 1800,             quality: 78 },
    { longEdge: 1800,             quality: 70 },
  ];
  for (const a of ladder) {
    const { data, info } = await sharp(input, { failOn: 'none' })
      .rotate()
      .resize({ width: a.longEdge, height: a.longEdge, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: a.quality, mozjpeg: true, chromaSubsampling: '4:4:4' })
      .toBuffer({ resolveWithObject: true });
    if (data.byteLength <= RESIZE_TARGET_BYTES) return { buffer: data, width: info.width, height: info.height };
  }
  // last-resort
  const last = await sharp(input, { failOn: 'none' })
    .rotate()
    .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 65, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return { buffer: last.data, width: last.info.width, height: last.info.height };
}

async function main() {
  console.log('Pulling stuck rows…');
  const { data: rows, error } = await admin
    .schema('marketing')
    .from('media_assets')
    .select('asset_id, raw_path, mime_type, file_size_bytes, original_filename, status')
    .eq('status', 'needs_review')
    .not('raw_path', 'is', null);
  if (error) { console.error(error); process.exit(1); }
  console.log(`Found ${rows.length} rows in needs_review.`);

  const PHOTO_MIMES = new Set(['image/jpeg','image/png','image/heic','image/heif','image/webp']);
  let ok = 0, skipped = 0, failed = 0;

  for (const row of rows) {
    const tag = `[${row.asset_id.slice(0, 8)} ${row.original_filename}]`;
    if (!PHOTO_MIMES.has(row.mime_type)) { console.log(`${tag} skip (not a photo: ${row.mime_type})`); skipped++; continue; }
    if (row.file_size_bytes && row.file_size_bytes <= 4_000_000) { console.log(`${tag} skip (already small)`); skipped++; continue; }

    try {
      const { data: blob, error: dlErr } = await admin.storage.from('media-raw').download(row.raw_path);
      if (dlErr || !blob) throw new Error(`download: ${dlErr?.message ?? 'no blob'}`);
      const original = Buffer.from(await blob.arrayBuffer());
      const r = await resize(original);
      console.log(`${tag} ${(original.byteLength/1e6).toFixed(1)}MB → ${(r.buffer.byteLength/1e6).toFixed(1)}MB (${r.width}x${r.height})`);

      // Upload same path with upsert (replaces the original)
      const { error: upErr } = await admin.storage.from('media-raw').upload(row.raw_path, r.buffer, {
        contentType: 'image/jpeg', upsert: true,
      });
      if (upErr) throw new Error(`upload: ${upErr.message}`);

      const { error: updErr } = await admin
        .schema('marketing')
        .from('media_assets')
        .update({
          mime_type: 'image/jpeg',
          file_size_bytes: r.buffer.byteLength,
          width_px: r.width,
          height_px: r.height,
          status: 'ingested',
        })
        .eq('asset_id', row.asset_id);
      if (updErr) throw new Error(`update: ${updErr.message}`);
      ok++;
    } catch (e) {
      console.error(`${tag} FAIL — ${e.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${ok} resized + reset, ${skipped} skipped, ${failed} failed.`);
  console.log('Crons render-media + tag-media will pick them up over the next ~120 min (1/min each).');
}

main().catch((e) => { console.error(e); process.exit(1); });
