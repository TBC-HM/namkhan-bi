// Diagnostic: confirms whether server-side getOverviewKpis returns data on prod.
// DELETE once issue is resolved.
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const out: any = {
    env: {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasService: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  };
  try {
    const admin = getSupabaseAdmin();
    const r = await admin.rpc('f_overview_kpis', { p_window: '30D', p_compare: 'NONE', p_segment: null });
    out.admin = { error: r.error?.message ?? null, rowCount: Array.isArray(r.data) ? r.data.length : 0, first: Array.isArray(r.data) ? r.data[0] : null };
  } catch (e: any) {
    out.adminError = String(e?.message ?? e);
  }
  try {
    const r = await supabase.rpc('f_overview_kpis', { p_window: '30D', p_compare: 'NONE', p_segment: null });
    out.anon = { error: r.error?.message ?? null, rowCount: Array.isArray(r.data) ? r.data.length : 0, first: Array.isArray(r.data) ? r.data[0] : null };
  } catch (e: any) {
    out.anonError = String(e?.message ?? e);
  }
  return NextResponse.json(out);
}
