// CRUD + import for sales.prospects.
//   GET  /api/sales/prospects             → { prospects, kpis }
//   POST /api/sales/prospects             → create one (body fields)
//   PATCH /api/sales/prospects?id=...     → update status / fields
//   DELETE /api/sales/prospects?id=...

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const sb = getSupabaseAdmin();
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const limit = parseInt(url.searchParams.get('limit') ?? '200', 10);

  let q = sb.schema('sales').from('prospects').select('*').eq('property_id', PROPERTY_ID).order('created_at', { ascending: false }).limit(limit);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prospects: data ?? [] });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }
  const sb = getSupabaseAdmin();
  const insert = {
    property_id: PROPERTY_ID,
    name: body.name ?? null,
    company: body.company ?? null,
    role: body.role ?? null,
    country: body.country ?? null,
    email: body.email ?? null,
    linkedin_url: body.linkedin_url ?? null,
    website: body.website ?? null,
    source: body.source ?? 'manual',
    icp_segment_id: body.icp_segment_id ?? null,
    score: body.score ?? 50,
    context_summary: body.context_summary ?? null,
    enrichment_data: body.enrichment_data ?? {},
    status: 'new' as const,
  };
  const { data, error } = await sb.schema('sales').from('prospects').insert(insert).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, prospect: data });
}

export async function PATCH(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }
  const sb = getSupabaseAdmin();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ['name','company','role','country','email','linkedin_url','website','source','icp_segment_id','score','status','context_summary','enrichment_data','last_outreach_draft_id','contacted_at','replied_at']) {
    if (k in body) update[k] = body[k];
  }
  const { data, error } = await sb.schema('sales').from('prospects')
    .update(update).eq('id', id).eq('property_id', PROPERTY_ID).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, prospect: data });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { error } = await sb.schema('sales').from('prospects').delete().eq('id', id).eq('property_id', PROPERTY_ID);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
