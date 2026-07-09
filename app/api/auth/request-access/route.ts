// app/api/auth/request-access/route.ts
// PBS 2026-07-09: unauthenticated endpoint used by /login → "Request access".
// Writes to cockpit_tickets so PBS sees the request in his inbox and can
// approve (create auth.users row + tenancy grants) or reject.
// Route is exempt from middleware auth (PUBLIC_PATHS matches /login prefix
// but not /api/auth/request-access) — we handle it here via getSupabaseAdmin.
// Rate limiting: relies on Supabase project-level rate limits + email uniqueness.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email  = String(body.email ?? '').trim().toLowerCase();
    const name   = String(body.name ?? '').trim();
    const reason = String(body.reason ?? '').trim().slice(0, 1000);
    if (!email || !name) return NextResponse.json({ error: 'email + name required' }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'invalid email' }, { status: 400 });
    const sb = getSupabaseAdmin();
    const parsed_summary = `Access request from ${name} <${email}>${reason ? ` — ${reason}` : ''}`;
    const { error } = await sb.from('cockpit_tickets').insert({
      source: 'access_request',
      arm: 'auth',
      intent: 'grant_access',
      status: 'new',
      email_subject: `Access request — ${name} <${email}>`,
      parsed_summary,
      notes: reason || null,
      metadata: { email, name, reason, ua: req.headers.get('user-agent') ?? null },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
