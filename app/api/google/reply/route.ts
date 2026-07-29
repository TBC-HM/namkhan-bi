// app/api/google/reply/route.ts
// GBP completion brief (autospec-gbp_module-20260725) §5.5 · 2026-07-29.
// Post a reply to a Google review, end-to-end:
//   POST { property?, reviewId (local marketing.reviews id), comment }
//   → google-sync action=post-reply (already shipped in the edge fn since v2/v3)
//   → on success mark the local review row responded.
// Pre-allowlist the upstream google-sync error is surfaced VERBATIM — no fake
// success, no 500 crash (A5). Auth: sits behind the session middleware, so the
// composer is human-operated — that IS the approval step (brief §7a).

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

interface ReplyBody {
  property?: number;
  reviewId?: number;
  comment?: string;
}

export async function POST(req: NextRequest) {
  let body: ReplyBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }

  const property = Number(body.property ?? 260955);
  const reviewId = Number(body.reviewId);
  const comment = String(body.comment ?? '').trim();
  if (!Number.isFinite(reviewId) || reviewId <= 0) {
    return NextResponse.json({ ok: false, error: 'reviewId required' }, { status: 400 });
  }
  if (comment.length < 2) {
    return NextResponse.json({ ok: false, error: 'comment required' }, { status: 400 });
  }
  if (comment.length > 4000) {
    return NextResponse.json({ ok: false, error: 'comment too long (Google limit ~4096 chars)' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data: row, error: rowErr } = await sb
    .schema('marketing').from('reviews')
    .select('id, source, source_review_id, property_id, response_status')
    .eq('id', reviewId).eq('property_id', property)
    .maybeSingle();
  if (rowErr) return NextResponse.json({ ok: false, error: 'lookup_failed: ' + rowErr.message }, { status: 500 });
  if (!row) return NextResponse.json({ ok: false, error: `review ${reviewId} not found for property ${property}` }, { status: 404 });
  if (row.source !== 'google') {
    return NextResponse.json({ ok: false, error: `review ${reviewId} is a ${row.source} review — Google reply API only handles Google reviews` }, { status: 400 });
  }
  if (!row.source_review_id) {
    return NextResponse.json({ ok: false, error: 'review has no Google review id yet (scraped aggregate — individual replies unlock once the GBP API pull lands post-allowlist)' }, { status: 409 });
  }

  const { data: fnData, error: fnErr } = await sb.functions.invoke('google-sync', {
    body: { action: 'post-reply', propertyID: property, reviewId: row.source_review_id, comment },
  });

  if (fnErr) {
    // Surface the upstream failure verbatim (A5) — e.g. "no google_account_id/location_id"
    // while the allowlist is pending. Edge fn returns 500 with { ok:false, error }.
    let detail = String((fnErr as any)?.message ?? fnErr);
    try {
      const ctx = (fnErr as any)?.context;
      if (ctx && typeof ctx.json === 'function') {
        const j = await ctx.json();
        if (j?.error) detail = String(j.error);
      }
    } catch { /* keep the generic message */ }
    return NextResponse.json({ ok: false, error: detail }, { status: 502 });
  }
  if (fnData && fnData.ok === false) {
    return NextResponse.json({ ok: false, error: String(fnData.error ?? 'google-sync post-reply failed') }, { status: 502 });
  }

  const { error: upErr } = await sb
    .schema('marketing').from('reviews')
    .update({
      response_status: 'responded',
      response_text: comment,
      responded_at: new Date().toISOString(),
      responded_by: 'the_namkhan',
    })
    .eq('id', reviewId);
  if (upErr) {
    // Reply reached Google but local bookkeeping failed — report honestly.
    return NextResponse.json({ ok: true, warning: 'reply posted to Google, local status update failed: ' + upErr.message }, { status: 200 });
  }

  return NextResponse.json({ ok: true, updateTime: (fnData as any)?.updateTime ?? null });
}
