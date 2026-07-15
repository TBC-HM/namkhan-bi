// app/api/mail/autoresponder/route.ts
// Per-user vacation reply / auto-responder settings.
//   GET    → current row (public.v_mail_autoresponder, auth.uid()-scoped)
//   POST   → upsert via public.fn_autoresponder_upsert (SECURITY DEFINER)
//   DELETE → clear via public.fn_autoresponder_delete
//
// Auth: getCurrentAuthUser() cookies -> Supabase auth. Writes must run under
// the user's own auth so auth.uid() resolves inside the RPC. We build a
// per-request supabase client from the request cookies (createServerClient).

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sbForRequest() {
  return (async () => {
    const jar = await cookies();
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => jar.getAll().map((c) => ({ name: c.name, value: c.value })),
          setAll: () => {},
        },
      },
    );
  })();
}

export async function GET() {
  const sb = await sbForRequest();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });

  const { data, error } = await sb
    .from('v_mail_autoresponder')
    .select('is_active, starts_at, ends_at, subject_prefix, body, updated_at')
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data: data ?? null });
}

interface UpsertBody {
  is_active?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  subject_prefix?: string;
  body?: string;
}

export async function POST(req: NextRequest) {
  const sb = await sbForRequest();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });

  let body: UpsertBody;
  try {
    body = (await req.json()) as UpsertBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const { data, error } = await sb.rpc('fn_autoresponder_upsert', {
    p_is_active:      body.is_active ?? false,
    p_starts_at:      body.starts_at ?? null,
    p_ends_at:        body.ends_at ?? null,
    p_subject_prefix: body.subject_prefix ?? 'Re: ',
    p_body:           body.body ?? '',
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function DELETE() {
  const sb = await sbForRequest();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });

  const { error } = await sb.rpc('fn_autoresponder_delete');
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
