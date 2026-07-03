// app/api/newsletter/track/click/[code]/route.ts
// Newsletter click tracking. GET /api/newsletter/track/click/:code?url=<encoded>
// Records the click server-side then 302s to the destination.
//
// Anon-callable; the opaque track code is the credential.

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const raw = req.nextUrl.searchParams.get('url') || '';

  // Only allow http(s) — refuse to be an open redirector for anything else.
  let dest = 'https://namkhan-bi.vercel.app/';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') dest = parsed.toString();
  } catch { /* leave dest as home */ }

  try {
    const sb = getSupabaseAdmin();
    await sb.schema('guest').rpc('fn_track_click', { p_track_code: code, p_url: dest });
  } catch { /* swallow — never block the click */ }

  return NextResponse.redirect(dest, { status: 302 });
}

export const dynamic = 'force-dynamic';
