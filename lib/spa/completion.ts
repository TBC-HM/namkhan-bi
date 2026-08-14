// lib/spa/completion.ts
// Spa module v1 — completion hooks (brief spa-module-v1, gap 4).
// Runs AFTER fn_spa_set_booking_status has moved a booking to `completed`:
//   1. Inventory deduction — public.fn_inv_deduct_treatment_products consumes
//      the treatment recipe from spa storage (inv.movements).
//   2. Cloudbeds folio post — in-house guests (reservation_id present) get the
//      treatment charged to their folio via POST /api/v1.2/postCustomItem,
//      authenticated with the vault CLOUDBEDS_API_KEY (same key sync-cloudbeds
//      and cb-probe use). Cloudbeds calls stay OUT of any DB transaction.
//
// Graceful degradation is the contract (house pattern: cloudbeds_set_bar_dry_run,
// reports/send): a failed or unavailable folio post NEVER blocks completion —
// the booking row keeps posted_to_folio=false and the Delivery view surfaces
// it as "manual post needed" (amber Folio-posted KPI + em-dash folio cell).
// Every attempt is recorded on the booking (raw.folio_post) and in
// cockpit_audit_log, so the first live completion yields full API evidence.
//
// Walk-ins (no reservation_id) record an explicit skip to raw.folio_post with
// audit action spa_folio_skipped_walkin (brief spa-module-v1-slice-folio-posting).

import type { SupabaseClient } from '@supabase/supabase-js';

const CB_BASE = 'https://hotels.cloudbeds.com/api/v1.2';
// Namkhan is the only Cloudbeds property; Donna (Mews, CSV-based) has no
// folio write path — completions there record delivery only.
const CLOUDBEDS_PROPERTY_IDS = new Set([260955]);

export interface BookingDetail {
  booking_id: string;
  property_id: number;
  guest_name: string | null;
  reservation_id: string | null;
  scheduled_at: string;
  duration_min: number;
  status: string;
  treatment_name: string;
  therapist_name: string | null;
  room_name: string | null;
  price: number | null;
  currency: string | null;
  posted_to_folio: boolean | null;
  cloudbeds_charge_id: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  confirmation_sent_at: string | null;
  reminder_sent_at: string | null;
}

export async function getBookingDetail(
  sb: SupabaseClient,
  bookingId: string,
): Promise<BookingDetail | null> {
  const { data, error } = await sb.rpc('fn_spa_booking_detail', { p_booking_id: bookingId });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as BookingDetail) ?? null;
}

export interface CompletionHookResult {
  inventory: { attempted: boolean; ok: boolean; lines: number; error: string | null };
  folio: { attempted: boolean; posted: boolean; charge_id: string | null; note: string };
}

/** Fire-and-record completion hooks. Never throws; never blocks the transition. */
export async function runCompletionHooks(
  sb: SupabaseClient,
  booking: BookingDetail,
): Promise<CompletionHookResult> {
  const result: CompletionHookResult = {
    inventory: { attempted: false, ok: false, lines: 0, error: null },
    folio: { attempted: false, posted: false, charge_id: null, note: 'not attempted' },
  };

  // ── 1. Inventory deduction (recipe-driven; no recipe rows = no-op) ──────
  try {
    result.inventory.attempted = true;
    const { data, error } = await sb.rpc('fn_inv_deduct_treatment_products', {
      p_treatment_name: booking.treatment_name,
      p_treatments_delivered: 1,
      p_property_id: booking.property_id,
    });
    if (error) {
      result.inventory.error = error.message;
    } else {
      result.inventory.ok = true;
      result.inventory.lines = Array.isArray(data) ? data.length : 0;
    }
  } catch (e) {
    result.inventory.error = e instanceof Error ? e.message : String(e);
  }

  // ── 2. Cloudbeds folio post (in-house Namkhan guests only) ──────────────
  if (!booking.reservation_id) {
    result.folio.note = 'walk-in / day guest — front-desk settle, no folio';
    // Walk-in explicit skip recording (brief spa-module-v1-slice-folio-posting)
    try {
      await sb.rpc('fn_spa_record_folio_post', {
        p_booking_id: booking.booking_id,
        p_posted: false,
        p_charge_id: null,
        p_evidence: { posted: false, skipped: 'walk_in', note: result.folio.note },
      });
    } catch {
      // best-effort
    }
  } else if (!CLOUDBEDS_PROPERTY_IDS.has(booking.property_id)) {
    result.folio.note = 'non-Cloudbeds property — delivery recorded, no folio post';
  } else if (booking.posted_to_folio) {
    result.folio.note = 'already posted';
    result.folio.posted = true;
    result.folio.charge_id = booking.cloudbeds_charge_id;
  } else {
    result.folio.attempted = true;
    const attempt = await postCustomItemToFolio(sb, booking);
    result.folio.posted = attempt.posted;
    result.folio.charge_id = attempt.charge_id;
    result.folio.note = attempt.note;
  }

  // ── 3. Record evidence on the booking row + audit log ───────────────────
  try {
    if (result.folio.attempted || result.folio.posted) {
      await sb.rpc('fn_spa_record_folio_post', {
        p_booking_id: booking.booking_id,
        p_posted: result.folio.posted,
        p_charge_id: result.folio.charge_id,
        p_evidence: {
          note: result.folio.note,
          reservation_id: booking.reservation_id,
          amount: booking.price,
          currency: booking.currency,
        },
      });
    }
    await sb.from('cockpit_audit_log').insert({
      agent: 'spa-completion-hook',
      action: result.folio.posted
        ? 'spa_folio_posted'
        : result.folio.attempted
          ? 'spa_folio_post_failed'
          : !booking.reservation_id
            ? 'spa_folio_skipped_walkin'
            : 'spa_completed',
      target: `spa.booking:${booking.booking_id}`,
      success: !result.folio.attempted || result.folio.posted,
      metadata: { ...result, treatment: booking.treatment_name, reservation_id: booking.reservation_id },
      reasoning:
        `Spa completion hooks for "${booking.treatment_name}" (${booking.guest_name ?? 'guest'}): ` +
        `inventory ${result.inventory.ok ? `ok (${result.inventory.lines} recipe lines)` : (result.inventory.error ?? 'skipped')}; ` +
        `folio ${result.folio.note}.`,
    });
  } catch {
    // Evidence recording is best-effort — never fail the completion.
  }

  return result;
}

async function postCustomItemToFolio(
  sb: SupabaseClient,
  booking: BookingDetail,
): Promise<{ posted: boolean; charge_id: string | null; note: string }> {
  if (booking.price == null || Number(booking.price) <= 0) {
    return { posted: false, charge_id: null, note: 'no price on booking — set price, then re-complete manually in Cloudbeds' };
  }
  try {
    const { data: key, error: kErr } = await sb.rpc('get_secret', { p_name: 'CLOUDBEDS_API_KEY' });
    if (kErr || !key) {
      return { posted: false, charge_id: null, note: `vault key unavailable (${kErr?.message ?? 'null'}) — post manually in Cloudbeds` };
    }

    // Cloudbeds v1.2 postCustomItem expects an 'items' parameter with JSON array of line items.
    // Each item must have: itemName, itemPrice, itemQuantity, optional: itemCategoryName, itemNotes.
    const items = [
      {
        itemName: `Spa · ${booking.treatment_name}`.slice(0, 100),
        itemPrice: Number(booking.price),
        itemQuantity: 1,
        itemCategoryName: 'Spa',
        itemNotes: `Spa booking ${booking.booking_id.slice(0, 8)} · ${booking.therapist_name ?? 'therapist n/a'}`.slice(0, 200),
      },
    ];

    const form = new URLSearchParams();
    form.append('propertyID', String(booking.property_id));
    form.append('reservationID', booking.reservation_id!);
    form.append('items', JSON.stringify(items));

    const r = await fetch(`${CB_BASE}/postCustomItem`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      // Route handlers must never cache external writes.
      cache: 'no-store',
    });
    const j: unknown = await r.json().catch(() => null);
    const jr = (j ?? {}) as { success?: boolean; data?: { transactionID?: string | number } & Record<string, unknown>; message?: string };
    if (r.ok && jr.success !== false) {
      const chargeId = jr.data?.transactionID != null ? String(jr.data.transactionID) : 'posted';
      return { posted: true, charge_id: chargeId, note: `posted (HTTP ${r.status})` };
    }
    return {
      posted: false,
      charge_id: null,
      note: `Cloudbeds rejected (HTTP ${r.status}${jr.message ? `: ${String(jr.message).slice(0, 140)}` : ''}) — post manually, evidence in raw.folio_post`,
    };
  } catch (e) {
    return { posted: false, charge_id: null, note: `network/exception: ${e instanceof Error ? e.message : String(e)}` };
  }
}
