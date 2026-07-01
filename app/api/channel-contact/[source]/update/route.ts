// app/api/channel-contact/[source]/update/route.ts
// POST { patch, propertyId } — upserts revenue.channel_contacts via RPC.

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest, { params }: { params: { source: string } }) {
  let body: { patch?: Record<string, unknown>; propertyId?: number };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 }); }

  if (!body?.patch || typeof body.patch !== 'object') {
    return NextResponse.json({ ok: false, error: 'patch object required' }, { status: 400 });
  }
  if (!body.propertyId) {
    return NextResponse.json({ ok: false, error: 'propertyId required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.rpc('fn_channel_contact_upsert', {
    p_source_name: decodeURIComponent(params.source),
    p_property_id: body.propertyId,
    p_patch: body.patch,
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
