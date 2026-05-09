// GET /api/compset/run/status?run_id=<uuid>
// Polled by RunNowButtons every 4s while a run is in flight.
// Single round-trip via public.compset_run_progress(uuid) RPC — SECURITY DEFINER so it
// bypasses pgrst.db_schemas + RLS for the rate count. Anon-callable.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co");
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "build-placeholder-anon");

export async function GET(req: Request) {
  if (!url || !anonKey) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not configured' },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(req.url);
  const run_id = searchParams.get('run_id');
  if (!run_id) {
    return NextResponse.json({ error: 'run_id query param required' }, { status: 400 });
  }

  const sb = createClient(url, anonKey, { auth: { persistSession: false } });

  const { data, error } = await sb.rpc('compset_run_progress', { p_run_id: run_id });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'run not found' }, { status: 404 });
  }

  // RPC returns a single jsonb. PostgREST hands it back as the parsed object.
  const row = data as Record<string, unknown>;
  return NextResponse.json(
    {
      run_id: row.run_id,
      status: row.status,
      final_status: row.is_done ? row.status : null,
      started_at: row.started_at,
      finished_at: row.finished_at,
      duration_ms: row.duration_ms,
      cost_usd: row.cost_usd != null ? Number(row.cost_usd) : null,
      success: row.success ?? null,
      failed: row.failed ?? null,
      crash_error: row.crash_error ?? null,
      jobs_total: row.jobs_total ?? null,
      rates_so_far: row.rates_so_far ?? 0,
      is_done: row.is_done ?? false,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
      },
    },
  );
}
