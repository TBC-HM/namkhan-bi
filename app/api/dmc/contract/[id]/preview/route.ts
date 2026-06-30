// app/api/dmc/contract/[id]/preview/route.ts
// 302-redirects to a short-lived signed URL for the DMC contract PDF.
// PBS 2026-06-30: surfaces the contract preview from /revenue/channels/[source]
// without exposing service-role keys client-side.

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SIGNED_TTL = 300; // 5 minutes
const BUCKET = 'documents-confidential';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('v_dmc_contracts')
    .select('pdf_storage_path, partner_short_name')
    .eq('contract_id', params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'lookup failed', detail: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'contract not found' }, { status: 404 });
  if (!data.pdf_storage_path) return NextResponse.json({ error: 'no signed PDF on file' }, { status: 404 });

  const { data: signed, error: signErr } = await supabase
    .storage
    .from(BUCKET)
    .createSignedUrl(data.pdf_storage_path, SIGNED_TTL);

  if (signErr || !signed) return NextResponse.json({ error: 'sign failed', detail: signErr?.message }, { status: 500 });

  return NextResponse.redirect(signed.signedUrl, 302);
}
