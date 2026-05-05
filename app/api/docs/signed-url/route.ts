// app/api/docs/signed-url/route.ts
// GET /api/docs/signed-url?bucket=...&path=...&exp=600
// Returns a short-lived signed URL for opening/downloading a doc from a private bucket.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  const { searchParams } = new URL(req.url);
  const bucket = searchParams.get('bucket');
  const path   = searchParams.get('path');
  const exp    = parseInt(searchParams.get('exp') || '600');

  if (!bucket || !path) return NextResponse.json({ ok: false, error: 'missing bucket or path' }, { status: 400 });

  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, exp);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, url: data.signedUrl });
}
