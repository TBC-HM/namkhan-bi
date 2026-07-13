// app/api/sales/mails/add-alias/route.ts
// POST { mailbox_address, label, badge_color?, sort_order? }
// Calls fn_shared_mailbox_upsert. Domain-guarded to *@thenamkhan.com by the
// RPC. Any authenticated user with a personal Gmail connection can register
// an alias for now (v2 will add holding-admin RBAC).
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  mailbox_address?: string;
  label?: string;
  badge_color?: string;
  sort_order?: number;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  let body: Body;
  try { body = (await req.json()) as Body; }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const mailbox_address = (body.mailbox_address ?? '').trim().toLowerCase();
  const label = (body.label ?? '').trim();
  const badge_color = (body.badge_color ?? '#084838').trim();
  const sort_order = Number.isFinite(body.sort_order) ? Number(body.sort_order) : 100;
  if (!mailbox_address || !label) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.rpc('fn_shared_mailbox_upsert', {
      p_mailbox: mailbox_address,
      p_label: label,
      p_badge_color: badge_color,
      p_sort_order: sort_order,
    });
    if (error) {
      if (String(error.message).includes('domain_not_allowed')) {
        return NextResponse.json({ error: 'domain_not_allowed', detail: 'Only @thenamkhan.com addresses are allowed.' }, { status: 400 });
      }
      return NextResponse.json({ error: 'upsert_failed', detail: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json({ error: 'upsert_failed', detail: msg }, { status: 500 });
  }
}
