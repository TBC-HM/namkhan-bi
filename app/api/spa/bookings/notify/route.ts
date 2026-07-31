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
// This route never fabricates success: mode tells the operator exactly what
// happened ('email' | 'wa_only') and fn_spa_record_notify stamps the booking
// only when a channel was actually available.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getBookingDetail, type BookingDetail } from '@/lib/spa/completion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROPERTY_TZ: Record<number, string> = {
  260955: 'Asia/Vientiane',
  1000001: 'Europe/Madrid',
};
const PROPERTY_NAME: Record<number, string> = {
  260955: 'The Namkhan',
  1000001: 'Donna Portals',
};

function buildMessage(b: BookingDetail, kind: 'confirmation' | 'reminder'): { subject: string; text: string } {
  const tz = PROPERTY_TZ[b.property_id] ?? 'Asia/Vientiane';
  const prop = PROPERTY_NAME[b.property_id] ?? 'the hotel';
  const when = new Date(b.scheduled_at).toLocaleString('en-GB', {
    timeZone: tz, weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const lines = [
    kind === 'confirmation'
      ? `Dear ${b.guest_name ?? 'guest'}, your spa treatment at ${prop} is confirmed.`
      : `Dear ${b.guest_name ?? 'guest'}, a reminder of your spa treatment at ${prop} tomorrow.`,
    '',
    `Treatment: ${b.treatment_name}`,
    `When: ${when} (local time)`,
    `Duration: ${b.duration_min} minutes`,
  ];
  if (b.room_name) lines.push(`Room: ${b.room_name}`);
  if (b.therapist_name) lines.push(`Therapist: ${b.therapist_name}`);
  lines.push(
    '',
    'Please arrive 10 minutes early. To change or cancel, simply reply to this message.',
    '',
    `The ${prop} Spa team`,
  );
  return {
    subject: `${kind === 'confirmation' ? 'Spa booking confirmed' : 'Spa reminder'} · ${b.treatment_name} · ${prop}`,
    text: lines.join('\n'),
  };
}

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

    const { subject, text } = buildMessage(booking, kind);
    const phoneDigits = (booking.guest_phone ?? '').replace(/[^\d]/g, '');
    const waLink = phoneDigits
      ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;

    let emailSent = false;
    let emailNote = 'no guest email on booking or reservation';
    const resendKey = process.env.RESEND_API_KEY;
    if (booking.guest_email) {
      if (!resendKey) {
        emailNote = 'RESEND_API_KEY not set on this deploy — use WhatsApp link';
      } else {
        try {
          const r = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${resendKey}` },
            body: JSON.stringify({
              from: process.env.SPA_EMAIL_FROM ?? process.env.REPORT_EMAIL_FROM ?? 'reports@thenamkhan.com',
              to: [booking.guest_email],
              subject,
              text,
            }),
          });
          emailSent = r.ok;
          emailNote = r.ok ? `sent to ${booking.guest_email}` : `resend HTTP ${r.status}`;
        } catch (e) {
          emailNote = `resend threw: ${e instanceof Error ? e.message : String(e)}`;
        }
      }
    }

    if (emailSent) {
      await sb.rpc('fn_spa_record_notify', { p_booking_id: bookingId, p_kind: kind });
    }
    await sb.from('cockpit_audit_log').insert({
      agent: 'spa-notify',
      action: `spa_${kind}_${emailSent ? 'emailed' : 'wa_prepared'}`,
      target: `spa.booking:${bookingId}`,
      success: true,
      metadata: { kind, email: emailSent, email_note: emailNote, has_phone: !!phoneDigits },
      reasoning: `Spa ${kind} for "${booking.treatment_name}" (${booking.guest_name ?? 'guest'}): email ${emailNote}; WhatsApp link prepared.`,
    });

    return NextResponse.json({
      ok: true,
      mode: emailSent ? 'email' : 'wa_only',
      email_note: emailNote,
      wa_link: waLink,
      message: text,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown error' }, { status: 500 });
  }
}
