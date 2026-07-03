// app/api/newsletter/booking/[code]/route.ts
// Booking-CTA landing. Records the hit and 302s to the campaign's booking
// URL (defaults to https://thenamkhan.com/book) with ?code=<booking_code>
// appended so downstream conversion tracking can attribute a reservation.

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  let dest = 'https://thenamkhan.com/book';
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb.schema('guest').rpc('fn_track_booking_hit', { p_track_code: code });
    // data is an array of one row: { booking_code, booking_url }
    const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
    const url = row?.booking_url as string | null;
    const bcode = row?.booking_code as string | null;
    if (url) {
      const u = new URL(url);
      if (bcode) u.searchParams.set('code', bcode);
      dest = u.toString();
    } else if (bcode) {
      const u = new URL(dest);
      u.searchParams.set('code', bcode);
      dest = u.toString();
    }
  } catch { /* swallow — always redirect somewhere sensible */ }

  return NextResponse.redirect(dest, { status: 302 });
}

export const dynamic = 'force-dynamic';
