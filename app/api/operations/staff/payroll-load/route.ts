// POST /api/operations/staff/payroll-load
// Bulk-load payroll rows. Accepts { rows: PayrollRowJSON[] } and calls
// public.payroll_load(jsonb) which proxies to ops.f_payroll_loader.
// Service-role only — no auth check; relies on the route being unlinked from UI.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const supa = getSupabaseAdmin();
    const body = await req.json();
    const rows = Array.isArray(body) ? body : body?.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ ok: false, error: 'rows[] required' }, { status: 400 });
    }
    const { data, error } = await supa.rpc('payroll_load', { p_rows: rows });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, affected: data, count: rows.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}
