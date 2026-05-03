// POST /api/sales/dmc/contract/signed-pdf-url
// Returns a presigned upload URL for documents-confidential bucket so large PDFs
// can be uploaded directly to Supabase storage, bypassing Vercel's 4.5MB function payload limit.
// Body JSON: { contract_id: uuid, filename: string }
// Returns: { signed_url, token, path }
// Caller then PUTs the file directly to signed_url, then POSTs to .../confirm-pdf-path with { contract_id, path } to set pdf_storage_path.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeName(name: string): string {
  return name.normalize('NFKD').replace(/[^\w.\-]+/g, '_').replace(/_{2,}/g, '_').slice(0, 200);
}

export async function POST(req: Request) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const contractId = String(body?.contract_id || '').trim();
  const filename = String(body?.filename || '').trim();
  if (!UUID_RE.test(contractId)) return NextResponse.json({ error: 'contract_id must be uuid' }, { status: 400 });
  if (!filename) return NextResponse.json({ error: 'filename required' }, { status: 400 });

  const { data: row, error: rowErr } = await admin
    .schema('governance')
    .from('dmc_contracts')
    .select('contract_id')
    .eq('contract_id', contractId)
    .maybeSingle();
  if (rowErr || !row) return NextResponse.json({ error: 'contract not found' }, { status: 404 });

  const path = `dmc/${contractId}/${safeName(filename)}`;
  const { data, error } = await admin.storage
    .from('documents-confidential')
    .createSignedUploadUrl(path, { upsert: true });
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'sign failed' }, { status: 500 });

  return NextResponse.json({
    signed_url: data.signedUrl,
    token: data.token,
    path,
  });
}
