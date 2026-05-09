// POST /api/parity/run
// Calls public.parity_check_internal() — SQL-only, free, ~1s.
// Returns the run_id and number of breaches inserted.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export async function POST() {
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'env not configured' }, { status: 500 });
  }
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await sb.rpc('parity_check_internal');
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // RPC returns a single row { out_run_id, out_breaches_inserted }
  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({
    run_id: row?.out_run_id ?? null,
    inserted: row?.out_breaches_inserted ?? 0,
  });
}
