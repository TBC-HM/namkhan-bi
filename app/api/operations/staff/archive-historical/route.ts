// POST /api/operations/staff/archive-historical
// Insert/upsert archived staff_employment rows for historical employees
// (people who appeared in past payroll runs but are no longer active).
// Accepts { rows: [{ emp_id, full_name, dept_code, position?, hire_date?, end_date?, monthly_salary?, bank_name?, bank_account_no?, bank_account_name? }] }

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const supa = getSupabaseAdmin();
    const body = await req.json();
    const rows = Array.isArray(body) ? body : body?.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ ok: false, error: 'rows[] required' }, { status: 400 });
    }
    const { data, error } = await supa.rpc('staff_archive_load', { p_rows: rows });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, affected: data, count: rows.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}
