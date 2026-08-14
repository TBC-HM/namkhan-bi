// app/api/spa/bookings/folio-retry/route.ts
// Spa module v1 — folio post retry (brief spa-module-v1-slice-folio-posting).
// POST → idempotent retry of a failed folio post for an in-house completed booking.
//        Rejects with 409 if already posted, 400 if not completed or has no reservation.
// AUTH: UI path requires middleware auth; proof runs can use x-cron-secret header to bypass.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getBookingDetail, runCompletionHooks } from '@/lib/spa/completion';

export async function POST(req: Request) {
  try {
    // Cron-secret bypass for proof/test runs (middleware still applies to user paths)
    const cronSecret = req.headers.get('x-cron-secret');
    if (cronSecret) {
      const expected = process.env.CRON_SHARED_SECRET ?? '';
      if (!expected || cronSecret !== expected) {
        return NextResponse.json({ error: 'invalid secret' }, { status: 401 });
      }
    }

    const body = await req.json();
    if (!body.booking_id) {
      return NextResponse.json({ error: 'booking_id required' }, { status: 400 });
    }

    const sb = getSupabaseAdmin();
    const booking = await getBookingDetail(sb, String(body.booking_id));
    if (!booking) {
      return NextResponse.json({ error: 'booking not found' }, { status: 404 });
    }

    // Idempotency: refuse if already posted.
    if (booking.posted_to_folio) {
      return NextResponse.json(
        {
          error: 'already posted to folio',
          charge_id: booking.cloudbeds_charge_id,
          note: 'This treatment has already been charged to the guest folio. Check Cloudbeds for the posted item.',
        },
        { status: 409 },
      );
    }

    // Preconditions: must be completed with a reservation link.
    if (booking.status !== 'completed') {
      return NextResponse.json(
        { error: 'booking not completed — only completed bookings can post to folio' },
        { status: 400 },
      );
    }
    if (!booking.reservation_id) {
      return NextResponse.json(
        { error: 'walk-in booking — no reservation to post to (settle at front desk)' },
        { status: 400 },
      );
    }

    // Re-run the folio hook. The hook writes evidence and audit log.
    const result = await runCompletionHooks(sb, booking);

    if (result.folio.posted) {
      return NextResponse.json({
        ok: true,
        posted: true,
        charge_id: result.folio.charge_id,
        note: result.folio.note,
      });
    } else {
      return NextResponse.json(
        {
          ok: false,
          posted: false,
          note: result.folio.note,
          error: 'Folio post failed — see note for details. Check reservation status in Cloudbeds, then retry.',
        },
        { status: 500 },
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
