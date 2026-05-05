// app/api/docs/upload-sign/route.ts
// POST /api/docs/upload-sign
// ----------------------------------------------------------------------------
// Returns a signed upload URL so the client can upload large files directly
// to Supabase Storage, bypassing Vercel's 4.5 MB body limit on Hobby tier.
//
// Flow:
//   1. Client POSTs { file_name, file_size, mime } here
//   2. We return { staging_bucket, staging_path, signed_url, token }
//   3. Client PUTs the file bytes directly to signed_url (no Vercel involved)
//   4. Client calls /api/docs/ingest with { staging_bucket, staging_path, file_name }
//      (small JSON payload — no body limit issue)
//
// Body: { file_name: string, file_size?: number, mime?: string }
// Returns: { ok, staging_bucket, staging_path, signed_url, token }
// ----------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// We stage everything in documents-internal under _staging/ — gets moved
// to the final bucket after classification (based on detected sensitivity).
const STAGING_BUCKET = 'documents-internal';
const STAGING_PREFIX = '_staging';

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 100);
}

export async function POST(req: NextRequest) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  let body: { file_name?: string; file_size?: number; mime?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }

  const fileName = (body.file_name || '').trim();
  if (!fileName) return NextResponse.json({ ok: false, error: 'missing file_name' }, { status: 400 });

  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  const stagingPath = `${STAGING_PREFIX}/${ts}-${rand}-${slug(fileName)}`;

  const { data, error } = await admin.storage
    .from(STAGING_BUCKET)
    .createSignedUploadUrl(stagingPath);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    staging_bucket: STAGING_BUCKET,
    staging_path: stagingPath,
    signed_url: data.signedUrl,
    token: data.token,
  });
}
