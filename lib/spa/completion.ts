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
  const { data, error } = await sb.rpc('fn_spa_booking_detail', { p_booking_id: bookingId }).single();
  if (error) throw error;
  return (data as BookingDetail) ?? null;
}

// ────────────────────────────────────────────────────────────────────
// Completion hooks: folio + inventory. Non-throwing; partial success ok.
// ────────────────────────────────────────────────────────────────────

export interface CompletionResult {
  folio: { posted: boolean; charge_id: string | null; note: string };
  inventory: { ok: boolean; lines: number; error: string | null };
}

/** Run folio post + inventory, record evidence. Called only after status=completed. */
export async function runCompletionHooks(
  sb: SupabaseClient,
  booking: BookingDetail,
): Promise<CompletionResult> {
  const result: CompletionResult = {
    folio: { posted: false, charge_id: null, note: '' },
    inventory: { ok: true, lines: 0, error: null },
  };

  // 1. Inventory deduction (non-blocking).
  try {
    const { data, error } = await sb.rpc('fn_inv_spa_deduct_daily', { p_booking_id: booking.booking_id });
    if (error) {
      result.inventory.ok = false;
      result.inventory.error = error.message;
    } else {
      result.inventory.lines = data ?? 0;
    }
  } catch (e) {
    result.inventory.ok = false;
    result.inventory.error = e instanceof Error ? e.message : String(e);
  }

  // 2. Folio post: skip if walk-in or Mews, skip if already posted, attempt once.
  if (!booking.reservation_id) {
    result.folio.note = 'walk-in (no reservation) — settle at front desk';
  } else if (!CLOUDBEDS_PROPERTY_IDS.has(booking.property_id)) {
    result.folio.note = 'Mews property (no API write)';
  } else if (booking.posted_to_folio) {
    result.folio.note = `already posted (charge ${booking.cloudbeds_charge_id})`;
  } else {
    const attempt = await postCustomItemToFolio(sb, booking);
    result.folio.posted = attempt.posted;
    result.folio.charge_id = attempt.charge_id;
    result.folio.note = attempt.note;
  }

  // 3. Record evidence on the booking row.
  try {
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
  } catch (e) {
    // Swallow evidence write errors (not user-facing).
  }

  // 4. Audit log.
  try {
    await sb.from('cockpit_audit_log').insert({
      agent: 'spa-completion-hook',
      action: result.folio.posted
        ? 'spa_folio_posted'
        : result.folio.note.includes('walk-in')
          ? 'spa_folio_skipped_walkin'
          : result.folio.note.includes('Mews')
            ? 'spa_folio_skipped_mews'
            : result.folio.note.includes('already')
              ? 'spa_completed'
              : 'spa_folio_post_failed',
      target: `spa.booking:${booking.booking_id}`,
      metadata: { folio: result.folio, inventory: result.inventory, treatment: booking.treatment_name, reservation_id: booking.reservation_id },
    });
  } catch (e) {
    // Swallow audit write errors.
  }

  return result;
}

// ────────────────────────────────────────────────────────────────────
// Cloudbeds POST /api/v1.2/postCustomItem
// ────────────────────────────────────────────────────────────────────

/** Call Cloudbeds POST /api/v1.2/postCustomItem. Never throws; returns attempt log. */
async function postCustomItemToFolio(
  sb: SupabaseClient,
  booking: BookingDetail,
): Promise<{ posted: boolean; charge_id: string | null; note: string }> {
  try {
    // Retrieve the CLOUDBEDS_API_KEY from vault.secrets via public.get_secret
    const { data: apiKey, error: keyErr } = await sb.rpc('fn_get_secret', { p_name: 'CLOUDBEDS_API_KEY' });
    if (keyErr) return { posted: false, charge_id: null, note: `Vault key fetch failed: ${keyErr.message}` };
    if (!apiKey || typeof apiKey !== 'string') {
      return { posted: false, charge_id: null, note: 'CLOUDBEDS_API_KEY not present in vault' };
    }

    // Build the payload.
    const itemData = {
      reservationID: booking.reservation_id,
      quantity: 1,
      itemCategoryID: null, // Spa posting does not need a category (no tax)
      itemName: booking.treatment_name,
      itemPrice: booking.price || 0,
      itemDate: booking.scheduled_at.split('T')[0], // YYYY-MM-DD
    };

    const url = `${CB_BASE}/postCustomItem`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(itemData),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return { posted: false, charge_id: null, note: `Cloudbeds ${resp.status}: ${text.slice(0, 200)}` };
    }

    const result = (await resp.json()) as { success: boolean; chargeID?: string };
    if (!result.success) {
      return { posted: false, charge_id: null, note: `Cloudbeds responded success=false` };
    }

    return {
      posted: true,
      charge_id: result.chargeID ?? null,
      note: 'Successfully posted to Cloudbeds folio',
    };
  } catch (e) {
    return {
      posted: false,
      charge_id: null,
      note: `Exception: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
