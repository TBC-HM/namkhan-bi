// app/api/cron/spa-reminders/route.ts
// SPA DAY-BEFORE REMINDERS + PASS EXPIRY SWEEP (brief spa-module-v1, gap-6 round).
// Fired daily by pg_cron 'spa-reminders-daily' (02:00 UTC = 09:00 Vientiane /
// 04:00 Madrid) with POST {"dry_run": false}; manual pokes default to dry_run
// so a stray call never emails a guest.
//
// Per property:
//   1. public.fn_spa_expire_passes() — flip active passes past valid_until to
//      'expired' (runs once, not per property).
//   2. Find tomorrow's (property-local day) bookings, status booked|confirmed,
//      reminder_sent_at NULL → send the reminder through lib/spa/notify.ts
//      (identical message to the manual ↻ Remind button; fn_spa_record_notify
//      stamps only on a real email send, so bookings without a guest email are
//      retried next day and stay visible for the operator's manual WhatsApp).
//
// Auth: x-cron-secret (CRON_SHARED_SECRET) — /api/cron/* middleware-exempt,
// header gate inside, same pattern as tile-sweep / brain-battery.

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getBookingDetail } from '@/lib/spa/completion';
import { sendBookingNotify } from '@/lib/spa/notify';
import { dayWindowUtc, todayIsoAtProperty } from '@/app/operations/spa/_shared/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const PROPERTIES = [260955, 1000001];

function checkCronSecret(req: NextRequest): boolean {
  const provided = req.headers.get('x-cron-secret') ?? '';
  if (!provided) return false;
  const envSecret = process.env.CRON_SHARED_SECRET ?? process.env.CRON_SECRET ?? '';
  if (!envSecret) return false;
  return provided === envSecret;
}

function tomorrowIso(dayIso: string): string {
  const d = new Date(`${dayIso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  if (!checkCronSecret(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { dry_run?: boolean };
  const dryRun = body.dry_run !== false; // manual pokes default to dry-run

  try {
    const sb = getSupabaseAdmin();

    // 1. Pass expiry sweep (global, cheap, idempotent).
    let passesExpired = 0;
    if (!dryRun) {
      const { data: expired } = await sb.rpc('fn_spa_expire_passes');
      passesExpired = Number(expired ?? 0);
    }

    // 2. Day-before reminders per property.
    const perProperty: Array<Record<string, unknown>> = [];
    for (const propertyId of PROPERTIES) {
      const tomorrow = tomorrowIso(todayIsoAtProperty(propertyId));
      const { fromUtc, toUtc } = dayWindowUtc(tomorrow, propertyId);
      const { data: rows, error } = await (sb as any)
        .from('v_spa_treatment_bookings')
        .select('booking_id, guest_email, status')
        .eq('property_id', propertyId)
        .in('status', ['booked', 'confirmed'])
        .is('reminder_sent_at', null)
        .gte('scheduled_at', fromUtc).lt('scheduled_at', toUtc);
      if (error) {
        perProperty.push({ propertyId, error: error.message });
        continue;
      }
      const due = (rows ?? []) as Array<{ booking_id: string; guest_email: string | null }>;
      let emailed = 0, waOnly = 0;
      if (!dryRun) {
        for (const r of due) {
          const booking = await getBookingDetail(sb, r.booking_id);
          if (!booking) continue;
          const result = await sendBookingNotify(sb, booking, 'reminder', 'spa-reminder-cron');
          if (result.mode === 'email') emailed += 1; else waOnly += 1;
        }
      }
      perProperty.push({ propertyId, day: tomorrow, due: due.length, emailed, wa_only: waOnly });
    }

    return NextResponse.json({ ok: true, dry_run: dryRun, passes_expired: passesExpired, properties: perProperty });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'unknown error' }, { status: 500 });
  }
}
