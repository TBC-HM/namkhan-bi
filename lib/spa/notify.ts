// lib/spa/notify.ts
// Spa module v1 — shared confirmation/reminder message + send logic.
// Extracted from app/api/spa/bookings/notify/route.ts (gap-6 round) so the
// manual notify route AND the day-before reminder cron
// (app/api/cron/spa-reminders) send the identical message through one path.
//
// Contract: never fabricates success — the result carries mode
// ('email' | 'wa_only' | 'none') and fn_spa_record_notify stamps the booking
// only when a channel actually fired. Channel logic (slice-reminders round):
//   email   → guest_email present AND Resend send succeeded (stamps the booking)
//   wa_only → ONLY when a phone is present AND email is absent — the operator
//             genuinely has WhatsApp as the sole channel
//   none    → email present but the send failed (retried next cron day, booking
//             stays unstamped and visible), or neither channel exists

import type { SupabaseClient } from '@supabase/supabase-js';
import type { BookingDetail } from '@/lib/spa/completion';

export const PROPERTY_TZ: Record<number, string> = {
  260955: 'Asia/Vientiane',
  1000001: 'Europe/Madrid',
};
export const PROPERTY_NAME: Record<number, string> = {
  260955: 'The Namkhan',
  1000001: 'Donna Portals',
};

export type NotifyKind = 'confirmation' | 'reminder';

export function buildMessage(b: BookingDetail, kind: NotifyKind): { subject: string; text: string } {
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

export interface NotifyResult {
  mode: 'email' | 'wa_only' | 'none';
  email_note: string;
  wa_link: string;
  message: string;
}

/**
 * Send one confirmation/reminder for a booking: Resend email when possible,
 * always a wa.me deep link. Stamps fn_spa_record_notify + audit log on the
 * booking only when the email actually went out (agent = caller identity,
 * e.g. 'spa-notify' or 'spa-reminder-cron').
 */
export async function sendBookingNotify(
  sb: SupabaseClient,
  booking: BookingDetail,
  kind: NotifyKind,
  agent: string,
): Promise<NotifyResult> {
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
    await sb.rpc('fn_spa_record_notify', { p_booking_id: booking.booking_id, p_kind: kind });
  }

  // wa_only is a real channel decision, not a fallback bucket: phone present
  // AND email absent. Email-present-but-send-failed is 'none' (retry next day);
  // neither channel is 'none' too (operator surfaces it manually).
  const mode: NotifyResult['mode'] =
    emailSent ? 'email' : (phoneDigits && !booking.guest_email) ? 'wa_only' : 'none';

  await sb.from('cockpit_audit_log').insert({
    agent,
    action: `spa_${kind}_${mode === 'email' ? 'emailed' : mode === 'wa_only' ? 'wa_prepared' : 'no_channel'}`,
    target: `spa.booking:${booking.booking_id}`,
    success: mode !== 'none',
    metadata: { kind, mode, email: emailSent, email_note: emailNote, has_phone: !!phoneDigits },
    reasoning: `Spa ${kind} for "${booking.treatment_name}" (${booking.guest_name ?? 'guest'}): email ${emailNote}; mode=${mode}.`,
  });

  return { mode, email_note: emailNote, wa_link: waLink, message: text };
}
