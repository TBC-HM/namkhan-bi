// app/api/newsletter/track/open/[code]/route.ts
// Newsletter open-tracking pixel. Returns a transparent 1x1 GIF and fires a
// fire-and-forget UPDATE on guest.campaign_recipients via RPC fn_track_open.
//
// Anon-callable; the opaque track code is the credential.

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export async function GET(_req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  try {
    const sb = getSupabaseAdmin();
    await sb.schema('guest').rpc('fn_track_open', { p_track_code: code });
  } catch { /* swallow — tracking must never block pixel delivery */ }

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(PIXEL.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}

export const dynamic = 'force-dynamic';
