// app/api/public/proposals/[token]/confirm/route.ts
// PBS 2026-07-16 — Public guest booking confirmation (Feature B).
// Anon-callable, rate-limited (3 POST / IP / proposal / hour via RPC).
// Inserts sales.proposal_confirmations, notifies book@thenamkhan.com,
// acknowledges the guest.
//
// CRITICAL: NO credit card capture in phase 1. Copy on the client says our
// Reservations team will contact within 24h to arrange payment.
// CC → phase 3 (Stripe SetupIntent or Cloudbeds vault).

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { fireMakeWebhook } from '@/lib/makeWebhooks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx { params: { token: string } }

function clientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return null;
}

export async function POST(req: Request, { params }: Ctx) {
  const token = params.token;
  if (!token) return NextResponse.json({ ok: false, error: 'token_required' }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  // Minimal shape validation before hitting the DB.
  const guestName = String(body.guest_name ?? '').trim();
  const guestEmail = String(body.guest_email ?? '').trim();
  if (!guestName) return NextResponse.json({ ok: false, error: 'guest_name_required' }, { status: 400 });
  if (!guestEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guestEmail)) {
    return NextResponse.json({ ok: false, error: 'guest_email_invalid' }, { status: 400 });
  }

  const ip = clientIp(req);
  const sb = getSupabaseAdmin();

  const { data: rpcData, error: rpcErr } = await sb.rpc('fn_submit_proposal_confirmation', {
    p_token: token,
    p_payload: {
      selected_rate_offer_id: body.selected_rate_offer_id ?? null,
      selected_block_ids: Array.isArray(body.selected_block_ids) ? body.selected_block_ids : [],
      guest_name: guestName,
      guest_email: guestEmail,
      guest_phone: body.guest_phone ?? null,
      guest_country: body.guest_country ?? null,
      guest_notes: body.guest_notes ?? null,
      arrival_time: body.arrival_time ?? null,
    },
    p_ip: ip,
  });

  if (rpcErr) {
    console.error('[confirm.rpc]', rpcErr);
    return NextResponse.json({ ok: false, error: 'submit_failed' }, { status: 500 });
  }
  const result = (rpcData ?? {}) as { ok?: boolean; error?: string; confirmation_id?: string; proposal_id?: string };
  if (!result.ok) {
    const status = result.error === 'proposal_not_found' ? 404
      : result.error === 'proposal_expired' ? 410
      : result.error === 'rate_limited' ? 429
      : 400;
    return NextResponse.json({ ok: false, error: result.error ?? 'unknown_error' }, { status });
  }

  // Non-blocking side effects — team notification + guest ack via Make webhook.
  // Reuses existing make webhook infra so PBS can wire in Gmail/Resend later.
  try {
    await fireMakeWebhook('proposal_signed', {
      event_subtype: 'guest_confirmation_submitted',
      proposal_id: result.proposal_id,
      confirmation_id: result.confirmation_id,
      guest_name: guestName,
      guest_email: guestEmail,
      guest_phone: body.guest_phone ?? null,
      guest_country: body.guest_country ?? null,
      guest_notes: body.guest_notes ?? null,
      arrival_time: body.arrival_time ?? null,
      selected_rate_offer_id: body.selected_rate_offer_id ?? null,
      selected_block_ids: Array.isArray(body.selected_block_ids) ? body.selected_block_ids : [],
      notify_email: 'book@thenamkhan.com',
      team_review_url: `/sales/proposals/${result.proposal_id}/edit`,
      ip_address: ip,
    });
  } catch (e) {
    console.error('[confirm.notify]', e);
    // Non-fatal — the DB write succeeded.
  }

  return NextResponse.json({
    ok: true,
    confirmation_id: result.confirmation_id,
    proposal_id: result.proposal_id,
  });
}
