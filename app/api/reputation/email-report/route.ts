// app/api/reputation/email-report/route.ts
// PBS 2026-07-06: Routes email through Supabase edge fn `send-report-email` which has RESEND_API_KEY.
// PBS 2026-07-06 pm: +delta send — when new_only=true, filters low_reviews to only rows received AFTER
// the last successful send to the same recipient. Logs every send to marketing.reputation_report_sends.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Req {
  to: string;
  subject: string;
  text: string;
  html_bullets: string[];
  new_only?: boolean;
  low_reviews?: Array<{
    reviewer: string; rating: number; source: string; title: string;
    body: string; reviewed_at: string; response_status: string;
    received_at?: string;
  }>;
  positive_words?: Array<{ word: string; count: number }>;
  negative_words?: Array<{ word: string; count: number }>;
}

export async function POST(req: Request) {
  let body: Req;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }

  if (!body.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.to)) {
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 });
  }
  const to = body.to.trim().toLowerCase();
  const newOnly = body.new_only !== false;

  const sb = getSupabaseAdmin();

  // Last successful send timestamp for this recipient
  let sinceTs: string | null = null;
  if (newOnly) {
    const { data: last } = await sb.rpc('fn_reputation_last_send', { p_to: to });
    sinceTs = last ? String(last) : null;
  }

  // If new_only, refetch reviews server-side filtered to received_at > sinceTs to build low_reviews.
  // Otherwise trust the payload's low_reviews.
  let low = body.low_reviews ?? [];
  let deltaCount = low.length;

  if (newOnly && sinceTs) {
    const { data: rows } = await sb.from('mkt_reviews')
      .select('reviewer_name, rating_norm, source, title, body, reviewed_at, received_at, response_status')
      .gt('received_at', sinceTs)
      .order('received_at', { ascending: false })
      .limit(50);
    const SOURCE_LABEL: Record<string, string> = {
      google: 'Google', tripadvisor: 'TripAdvisor', booking: 'Booking.com', expedia: 'Expedia', ctrip: 'Trip.com',
    };
    low = ((rows as Array<{ reviewer_name: string|null; rating_norm: number|string|null; source: string; title: string|null; body: string|null; reviewed_at: string|null; response_status: string|null }>) ?? [])
      .filter(r => Number(r.rating_norm) < 4.5)
      .slice(0, 8)
      .map(r => ({
        reviewer: r.reviewer_name ?? 'anonymous',
        rating: Number(r.rating_norm) || 0,
        source: SOURCE_LABEL[r.source] ?? r.source,
        title: r.title ?? '',
        body: (r.body ?? '').slice(0, 900),
        reviewed_at: (r.reviewed_at ?? '').slice(0, 10),
        response_status: r.response_status ?? 'unknown',
      }));
    deltaCount = low.length;
  }

  const { data: tokenData } = await sb.rpc('fn_read_vault_secret', { p_name: 'newsletter_cron_token' });
  const sharedSecret = tokenData ? String(tokenData) : '';

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kpenyneooigsyuuomgct.supabase.co';
  const edgeUrl = `${supabaseUrl}/functions/v1/send-report-email`;

  // Prefix a bullet noting delta status
  const enrichedBullets = newOnly && sinceTs
    ? [`⏰ Delta since ${new Date(sinceTs).toISOString().slice(0,16).replace('T',' ')} UTC · ${deltaCount} new low-scoring review(s)`,
       ...body.html_bullets]
    : (newOnly ? [`⏰ First send to this address · full sample included`, ...body.html_bullets] : body.html_bullets);

  const res = await fetch(edgeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-shared-secret': sharedSecret },
    body: JSON.stringify({
      to,
      subject: body.subject,
      text: body.text,
      html_bullets: enrichedBullets,
      low_reviews: low,
      positive_words: body.positive_words ?? [],
      negative_words: body.negative_words ?? [],
    }),
  });

  const j = await res.json().catch(() => ({}));
  const ok = res.ok && j?.ok !== false;

  // Log the send (success or fail)
  await sb.rpc('fn_reputation_log_send', {
    p_to: to,
    p_since: sinceTs,
    p_review_count: low.length,
    p_new_since_last: newOnly ? deltaCount : 0,
    p_ok: ok,
    p_resend_id: j?.id ?? null,
  });

  if (!ok) {
    return NextResponse.json({ ok: false, error: j?.error ?? 'send_failed', detail: j }, { status: 502 });
  }
  return NextResponse.json({
    ok: true, id: j.id,
    delta: newOnly, since: sinceTs, low_reviews_sent: low.length,
  });
}