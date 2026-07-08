// app/api/shortcuts/add/route.ts
// PBS 2026-07-08: pin a shortcut to the HoD panel.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const property_id = Number(body.property_id);
    const dept_slug   = String(body.dept_slug ?? 'revenue').toLowerCase();
    const user_email  = String(body.user_email ?? 'pbsbase@gmail.com').toLowerCase();
    const label       = String(body.label ?? '').trim();
    const href        = String(body.href ?? '').trim();
    if (!Number.isFinite(property_id) || property_id <= 0) return NextResponse.json({ error: 'property_id required' }, { status: 400 });
    if (!label || !href) return NextResponse.json({ error: 'label + href required' }, { status: 400 });
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_shortcut_add', {
      p_property_id: property_id, p_dept_slug: dept_slug, p_user_email: user_email,
      p_label: label, p_href: href,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: Number(data) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
