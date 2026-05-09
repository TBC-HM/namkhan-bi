// /api/sales/leads/scraping-jobs
// GET  → list recent scraping jobs (newest first)
// POST → enqueue a new job (status='queued'). Pure scaffolding — the
//        agent-runner picks it up out-of-band; no auto-write here.
//
// PBS 2026-05-09: linked from /sales/leads-pipeline scraping panel.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const sb = getSupabaseAdmin();
  const url = new URL(req.url);
  const limit = Math.min(200, parseInt(url.searchParams.get('limit') ?? '50', 10));
  const { data, error } = await sb.schema('sales').from('scraping_jobs')
    .select('*').eq('property_id', PROPERTY_ID)
    .order('created_at', { ascending: false }).limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data ?? [] });
}

export async function POST(req: Request) {
  let body: { query?: string; target_category?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!body.query || body.query.trim().length === 0) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.schema('sales').from('scraping_jobs').insert({
    property_id:     PROPERTY_ID,
    query:           body.query.trim(),
    target_category: body.target_category ?? null,
    notes:           body.notes ?? null,
    status:          'queued',
  }).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, job: data });
}
