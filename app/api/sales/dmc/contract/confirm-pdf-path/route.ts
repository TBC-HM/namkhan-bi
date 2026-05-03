// POST /api/sales/dmc/contract/confirm-pdf-path
// Sets pdf_storage_path on dmc_contracts after a direct upload to Supabase storage.
// Body JSON: { contract_id: uuid, path: string }

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const contractId = String(body?.contract_id || '').trim();
  const path = String(body?.path || '').trim();
  if (!UUID_RE.test(contractId)) return NextResponse.json({ error: 'contract_id must be uuid' }, { status: 400 });
  if (!path.startsWith(`dmc/${contractId}/`)) {
    return NextResponse.json({ error: 'path must be under dmc/<contract_id>/' }, { status: 400 });
  }

  const { error } = await admin
    .schema('governance')
    .from('dmc_contracts')
    .update({ pdf_storage_path: path })
    .eq('contract_id', contractId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, contract_id: contractId, path });
}
