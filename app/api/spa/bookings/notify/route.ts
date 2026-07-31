// app/api/spa/bookings/notify/route.ts
// Spa module v1 — confirmations + reminders (brief spa-module-v1, gap 5).
// POST { booking_id, kind: 'confirmation' | 'reminder' }
//
// Channels, per the brief ("existing email/WhatsApp patterns"):
//   Email    → Resend API when RESEND_API_KEY is set and the booking has a
//              guest email (walk-in capture, or pms.reservations fallback for
//              in-house guests). Same pattern as app/api/cockpit/reports/send.
//   WhatsApp → the response ALWAYS carries wa_link + message so the operator
//              sends from their own device (wa.me deep link — the live pattern
//              on the website and in settings/users invites). No WhatsApp
//              Business API dependency in v1.
//
// Message + send logic shared with the day-before reminder cron via
// lib/spa/notify.ts (gap-6 round refactor). This route never fabricates
// success: mode tells the operator exactly what happened ('email' | 'wa_only')
// and fn_spa_record_notify stamps the booking only when a channel actually
// fired.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getBookingDetail } from '@/lib/spa/completion';
import { sendBookingNotify } from '@/lib/spa/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const bookingId = String(body.booking_id ?? '');
    const kind = body.kind === 'reminder' ? 'reminder' as const : 'confirmation' as const;
    if (!bookingId) return NextResponse.json({ error: 'booking_id required' }, { status: 400 });

    const sb = getSupabaseAdmin();
    const booking = await getBookingDetail(sb, bookingId);
    if (!booking) return NextResponse.json({ error: 'booking not found' }, { status: 404 });
    if (['cancelled', 'no_show'].includes(booking.status)) {
      return NextResponse.json({ error: `booking is ${booking.status} — nothing to send` }, { status: 400 });
    }

    const result = await sendBookingNotify(sb, booking, kind, 'spa-notify');
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown error' }, { status: 500 });
  }
}
