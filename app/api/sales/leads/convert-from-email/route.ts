// app/api/sales/leads/convert-from-email/route.ts
// POST body:
//   { from_email, from_name?, subject, snippet?, thread_id, message_id,
//     mailbox_alias, mailbox_id? }
// Idempotent: if a lead already exists with email_thread_id = thread_id,
// returns { lead_id, existing:true }. Otherwise creates a new lead with
// origin='inbound_email' and returns { lead_id, existing:false }.
// Also opportunistically links any stored sales.email_messages rows that
// share the thread_id via UPDATE inside fn_lead_convert_from_email.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  from_email?: string;
  from_name?: string;
  subject?: string;
  snippet?: string;
  thread_id?: string;
  message_id?: string;
  mailbox_alias?: string;
  mailbox_id?: string;
}

export async function POST(req: Request) {
  let body: Body;
  try { body = (await req.json()) as Body; }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  if (!body.from_email || !body.thread_id) {
    return NextResponse.json({ error: 'from_email and thread_id required' }, { status: 400 });
  }
  const p = {
    from_email:    body.from_email,
    from_name:     body.from_name ?? '',
    subject:       body.subject ?? '',
    snippet:       body.snippet ?? '',
    thread_id:     body.thread_id,
    message_id:    body.message_id ?? '',
    mailbox_alias: body.mailbox_alias ?? (body.mailbox_id ?? 'sales'),
  };
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_lead_convert_from_email', { p });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, ...(data as Record<string, unknown>) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
