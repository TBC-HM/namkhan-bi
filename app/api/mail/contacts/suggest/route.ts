// app/api/mail/contacts/suggest/route.ts
// GET ?q=<prefix> → { ok: true, suggestions: [{ email, name, last_touched }] }
// Backed by public.fn_mail_contact_suggest(text) (SECURITY DEFINER, LIMIT 8).
// PBS 2026-07-17 · powers ComposeModal To: autocomplete.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Row { email: string; display_name: string | null; last_touched: string | null }

export async function GET(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  if (q.length < 2) return NextResponse.json({ ok: true, suggestions: [] });

  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_mail_contact_suggest', { p_prefix: q });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Row[];
    const suggestions = rows.map((r) => ({
      email: r.email,
      name: r.display_name || '',
      last_touched: r.last_touched,
    }));
    return NextResponse.json({ ok: true, suggestions });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'suggest_failed' }, { status: 500 });
  }
}
