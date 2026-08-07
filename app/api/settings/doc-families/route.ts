// app/api/settings/doc-families/route.ts
// dms-doc-families-governance-v1 slice 2 — server-side gate for document
// family (doc_type) CRUD. Finding #98: families are top-down structure set in
// property settings; a subordinate editing a doc must not be able to invent one.
//
// fn_doc_type_vocab_upsert had EXECUTE revoked from anon/authenticated
// (verifier addendum 2026-08-06) — this route is the ONLY write path, using
// service_role behind a holding owner/admin check (same gate class as
// /api/settings/users/*; gate placement logged in brief §SLICE 2 as IT decision).
//
// POST body:
//   { action: 'upsert',     property_id, value, label?, sort_order?, active? }
//   { action: 'deactivate', property_id, value, refile_to? }   // refile_to omitted = leave docs flagged
// property_id: 0 = holding scope (maps to NULL in dms.doc_type_vocab).
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

async function requireSettingsRole(req: Request):
  Promise<{ ok: true; email: string } | { ok: false; res: Response }> {
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => (req.headers.get('cookie') ?? '').split(';').map((s) => s.trim()).filter(Boolean).map((s) => {
          const [n, ...r] = s.split('='); return { name: n, value: r.join('=') };
        }),
        setAll: () => {},
      },
    },
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, res: NextResponse.json({ error: 'auth required' }, { status: 401 }) };
  const admin = getSupabaseAdmin();
  const { data } = await admin.from('v_holding_users_flat').select('role, status').eq('auth_user_id', user.id).maybeSingle();
  if (!data || data.status !== 'active' || !['owner', 'admin'].includes(data.role))
    return { ok: false, res: NextResponse.json({ error: 'settings role required — document families are managed top-down' }, { status: 403 }) };
  return { ok: true, email: user.email ?? user.id };
}

export async function POST(req: Request) {
  const gate = await requireSettingsRole(req);
  if (gate.ok === false) return gate.res;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'json body required' }, { status: 400 });

  const action = String(body.action ?? 'upsert');
  const pidNum = Number(body.property_id);
  if (!Number.isFinite(pidNum) || pidNum < 0) return NextResponse.json({ error: 'property_id required (0 = holding)' }, { status: 400 });
  const pid: number | null = pidNum === 0 ? null : pidNum;
  const value = String(body.value ?? '').trim();
  if (!value) return NextResponse.json({ error: 'value required' }, { status: 400 });
  const admin = getSupabaseAdmin();

  if (action === 'deactivate') {
    const refileTo = body.refile_to != null && String(body.refile_to).trim() !== ''
      ? String(body.refile_to).trim() : null;
    const { data, error } = await admin.rpc('fn_doc_type_vocab_deactivate', {
      p_property_id: pid, p_value: value, p_refile_to: refileTo, p_actor: gate.email,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, result: data });
  }

  if (action === 'upsert') {
    const { data, error } = await admin.rpc('fn_doc_type_vocab_upsert', {
      p_property_id: pid,
      p_value: value,
      p_label: body.label != null ? String(body.label) : null,
      p_sort_order: body.sort_order != null && Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : null,
      p_active: typeof body.active === 'boolean' ? body.active : null,
      p_actor: gate.email,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, result: data });
  }

  return NextResponse.json({ error: `unknown action "${action}"` }, { status: 400 });
}
