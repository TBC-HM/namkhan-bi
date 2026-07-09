// app/api/account/update/route.ts
// PBS 2026-07-09 v2: also sync preferred_name/full_name into auth.users.user_metadata
// so the HeaderPills top-right button reflects the change immediately (that button
// reads user_metadata.preferred_name / full_name via _supabase.auth.getUser()).
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const jar = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll().map((c) => ({ name: c.name, value: c.value })),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => jar.set(name, value, options));
        },
      },
    },
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  try {
    const body = await req.json();
    const p_full_name      = typeof body.full_name      === 'string' ? body.full_name.trim().slice(0, 160) : null;
    const p_preferred_name = typeof body.preferred_name === 'string' ? body.preferred_name.trim().slice(0, 60) : null;
    const p_phone          = typeof body.phone          === 'string' ? body.phone.trim().slice(0, 40) : null;
    const p_job_title      = typeof body.job_title      === 'string' ? body.job_title.trim().slice(0, 100) : null;
    const p_language_pref  = typeof body.language_pref  === 'string' ? body.language_pref.trim().slice(0, 8)  : null;

    // 1. Persist to app.profiles via SECURITY DEFINER RPC.
    const { error } = await sb.rpc('fn_profile_upsert_self', {
      p_full_name, p_preferred_name, p_phone, p_job_title, p_language_pref,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 2. Sync display fields into auth.users.user_metadata so the top-right button
    //    updates immediately (HeaderPills reads user_metadata client-side).
    const metaPatch: Record<string, unknown> = {};
    if (p_full_name      !== null) metaPatch.full_name      = p_full_name;
    if (p_preferred_name !== null) metaPatch.preferred_name = p_preferred_name;
    if (Object.keys(metaPatch).length > 0) {
      const { error: metaErr } = await sb.auth.updateUser({ data: metaPatch });
      if (metaErr) {
        // Non-fatal — the profile row is already persisted.
        return NextResponse.json({ ok: true, warning: `metadata sync failed: ${metaErr.message}` });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
