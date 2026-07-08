// app/api/attention/dismiss/route.ts
// PBS 2026-07-08 #204/attention — server route that AttentionList calls
// when the user clicks × on a DB-backed flag. Writes to
// cockpit.attention_dismissals via public.fn_attention_dismiss (SECURITY
// DEFINER) using the service-role client. No auth wrapper needed because
// the whole cockpit is password-gated at the edge.

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  flag_id: number;
  user_email: string;
  reason?: string;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const flagId = Number(body?.flag_id);
  const email  = typeof body?.user_email === 'string' ? body.user_email.trim() : '';

  if (!Number.isFinite(flagId) || flagId <= 0) {
    return NextResponse.json({ ok: false, error: 'flag_id_required' }, { status: 400 });
  }
  if (!email) {
    return NextResponse.json({ ok: false, error: 'user_email_required' }, { status: 400 });
  }

  const { error } = await supabase.rpc('fn_attention_dismiss', {
    p_flag_id:    flagId,
    p_user_email: email,
    p_reason:     body?.reason ?? null,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, flag_id: flagId });
}
