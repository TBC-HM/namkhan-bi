// app/api/sales/onboarding/start/route.ts
// Start (or fetch) an onboarding case from a signed SaaS contract.
// PBS finding #41: "then i create by button a whole mirror for a new hotel -
// then i send link to customer" — this is the button's backend.
//
// POST { contract_id: uuid, template_code?: string }
// Auth: holding owner/admin (same gate as settings/users routes).
// Calls public.fn_onboarding_start_from_contract — idempotent: an existing
// non-archived case for the contract returns existed=true + the same portal
// link, zero new rows.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireHoldingAdmin(
  req: Request,
): Promise<{ ok: true; email: string } | { ok: false; res: Response }> {
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
    return { ok: false, res: NextResponse.json({ error: 'holding admin required' }, { status: 403 }) };
  return { ok: true, email: user.email ?? user.id };
}

export async function POST(req: Request) {
  const gate = await requireHoldingAdmin(req);
  if (gate.ok === false) return gate.res;
  try {
    const body = await req.json();
    const contractId = String(body.contract_id ?? '');
    if (!UUID_RE.test(contractId))
      return NextResponse.json({ error: 'valid contract_id required' }, { status: 400 });
    const admin = getSupabaseAdmin();
    const args: Record<string, unknown> = {
      p_contract_id: contractId,
      p_actor: gate.email,
    };
    if (typeof body.template_code === 'string' && body.template_code.length > 0)
      args.p_template_code = body.template_code;
    const { data, error } = await admin.rpc('fn_onboarding_start_from_contract', args);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // data: { case_id, existed, portal_url, portal_token }
    return NextResponse.json({ ok: true, ...(data as Record<string, unknown>) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
