// Temporary diagnostic endpoint for the overview-wiring audit.
// Returns the raw f_overview_kpis RPC response (data + error) so we can
// see why the production Performance row is rendering zeros.
// DELETE this file once the wiring is verified.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc('f_overview_kpis', {
    p_window:  '30D',
    p_compare: 'NONE',
    p_segment: null,
  });
  return NextResponse.json({
    ok: !error,
    error: error ? { message: error.message, details: error.details, hint: error.hint, code: error.code } : null,
    rowCount: Array.isArray(data) ? data.length : (data ? 1 : 0),
    data,
    env: {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
  });
}
