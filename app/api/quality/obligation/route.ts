// app/api/quality/obligation/route.ts
// Task 6 of the department-qa-discharge-modes plan.
//
// PATCH { property_id, atom_id, discharge_mode?, staff_wording? }
//   → public.fn_standards_edit_atom(p_property_id, p_atom_id, p_mode, p_staff_wording)
//
// TENANCY: standards.atoms is a tenant-NEUTRAL shared corpus (no property_id
// column) — property_id here is NOT a scope for the write, it exists only so this
// route can call requirePropertyAccess() and refuse an unauthorised caller before
// touching the shared corpus. rawPropertyId from the request body is UNTRUSTED
// until requirePropertyAccess() returns (tenancy.md). No default, ever — a missing
// property_id is a 400, never a fallback to a tenant.
import { NextResponse } from 'next/server';
import { requirePropertyAccess } from '@/lib/tenancy';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: Request) {
  let body: Record<string, unknown> | null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  if (!body?.atom_id || typeof body.atom_id !== 'string') {
    return NextResponse.json({ ok: false, error: 'atom_id_required' }, { status: 400 });
  }
  if (body.property_id == null) {
    return NextResponse.json({ ok: false, error: 'property_id_required' }, { status: 400 });
  }

  let propertyId: number;
  try {
    // UNTRUSTED until this returns — 403s if the caller has no grant on the
    // property. No default, ever (tenancy.md).
    propertyId = await requirePropertyAccess(req, body.property_id as string | number);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ ok: false, error: 'authorization_check_failed' }, { status: 403 });
  }

  const mode = typeof body.discharge_mode === 'string' ? body.discharge_mode : null;
  const staffWording = typeof body.staff_wording === 'string' ? body.staff_wording : null;
  if (mode === null && staffWording === null) {
    return NextResponse.json({ ok: false, error: 'nothing_to_update' }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin().rpc('fn_standards_edit_atom', {
    p_property_id: propertyId,
    p_atom_id: body.atom_id,
    p_mode: mode,
    p_staff_wording: staffWording,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  return NextResponse.json(data);
}
