// app/api/mail/save-important/route.ts
// POST { thread_id, message_id?, subject?, from_email?, from_name?, summary? }
//   → { ok: true, id }
// GET  → { ok: true, mails: [...] }  (current user's saved mails)
// DELETE ?id=<n> → { ok: true }
// PBS 2026-07-17 · Feature 6 [Save to important].
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getCurrentAuthUser } from '@/lib/userGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function sbForUser() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => jar.getAll().map((c) => ({ name: c.name, value: c.value })), setAll: () => {} } },
  );
}

interface SaveBody {
  thread_id?: string;
  message_id?: string;
  subject?: string;
  from_email?: string;
  from_name?: string;
  summary?: string;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as SaveBody;
  if (!b.thread_id) return NextResponse.json({ ok: false, error: 'missing_thread_id' }, { status: 400 });

  const sb = await sbForUser();
  const { data, error } = await sb.rpc('fn_important_mail_save', {
    p_thread_id:  b.thread_id,
    p_message_id: b.message_id ?? null,
    p_subject:    b.subject ?? null,
    p_from_email: b.from_email ?? null,
    p_from_name:  b.from_name ?? null,
    p_summary:    b.summary ?? null,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data as number });
}

export async function GET() {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const sb = await sbForUser();
  const { data, error } = await sb.from('v_important_mails')
    .select('id,thread_id,message_id,gmail_url,subject,from_email,from_name,summary,saved_at,tags,notes')
    .order('saved_at', { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, mails: data ?? [] });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!id || !Number.isFinite(id)) return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });
  const sb = await sbForUser();
  const { data, error } = await sb.rpc('fn_important_mail_delete', { p_id: id });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: !!data });
}
