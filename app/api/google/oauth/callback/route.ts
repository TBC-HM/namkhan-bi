// app/api/google/oauth/callback/route.ts
// PBS 2026-07-03: receives Google OAuth code, exchanges via google-sync edge fn.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const code       = req.nextUrl.searchParams.get('code');
  const state      = req.nextUrl.searchParams.get('state') ?? '260955';
  const errorParam = req.nextUrl.searchParams.get('error');

  const base = new URL('/guest/reputation', req.url);

  if (errorParam) {
    base.searchParams.set('google', 'error');
    base.searchParams.set('reason', errorParam);
    return NextResponse.redirect(base, 302);
  }
  if (!code) {
    base.searchParams.set('google', 'error');
    base.searchParams.set('reason', 'no_code');
    return NextResponse.redirect(base, 302);
  }

  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.functions.invoke('google-sync', {
      body: {
        action: 'exchange-code',
        propertyID: Number(state),
        code,
        connectedBy: 'pbsbase@gmail.com',
      },
    });
    if (error) throw error;
    base.searchParams.set('google', 'connected');
    if ((data as any)?.location_name) base.searchParams.set('location', String((data as any).location_name));
    return NextResponse.redirect(base, 302);
  } catch (e: any) {
    base.searchParams.set('google', 'error');
    base.searchParams.set('reason', String(e?.message ?? e).slice(0, 200));
    return NextResponse.redirect(base, 302);
  }
}
