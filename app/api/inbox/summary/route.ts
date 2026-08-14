// app/api/inbox/summary/route.ts
// PBS 2026-05-09 (repair list #6): control-center summary for the
// HeaderPills inbox popover. One small JSON payload that powers:
//   - unread badge bubble
//   - top 3 senders (last 24h)
//   - unanswered + spam totals
//   - per-sender drill-down counts (sent/day, recipients, last activity)
//
// Data sources (all already in Supabase):
//   sales.email_messages   (raw inbound/outbound rows)
//   sales.v_mailbox_stats  (aggregated per-mailbox stats incl. spam/unanswered)
//   sales.v_unanswered_threads  (threads with no outbound reply)
//
// Read-only. Uses the property scope (260955) consistent with the rest
// of the inbox page. Returns 200 with empty arrays on any failure so the
// popover never blocks the header.
import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SenderSummary {
  email: string;
  name: string | null;
  inbound_24h: number;
  inbound_7d: number;
  threads_24h: number;
  last_msg: string | null;
  is_automation: boolean;
}

interface InboxSummary {
  property_id: number;
  // 2026-05-12: distinguishes "no Gmail OAuth for this property" from
  // "connected but 0 emails / poller stalled". Frontend uses this to
  // show a "not connected yet" notice instead of zero counts.
  connected: boolean;
  unread: number;
  unanswered: number;
  spam: number;
  inbound_24h: number;
  outbound_24h: number;
  // PBS 2026-07-17 Feature 8: default window shifted from 24h to 7d for the
  // daily-summary card. Legacy 24h fields kept for backwards-compat callers.
  inbound_7d: number;
  outbound_7d: number;
  top_senders_7d: SenderSummary[];
  focus_prompt_hint: string;
  top_senders_24h: SenderSummary[];
  generated_at: string;
  // Intake #15 (2026-05-12): expose Gmail poller freshness so the popover
  // can distinguish "really 0 emails" from "pipeline stalled". null when
  // no row exists; otherwise ISO timestamp of the last poll attempt.
  poller_last_run_at: string | null;
  poller_minutes_since: number | null;
  // Last actually-received email regardless of last-24h window.
  // Lets the popover say "Last email 8d ago" so 0/0 doesn't look like a bug.
  last_email_at: string | null;
  last_email_minutes_since: number | null;
}

// PBS 2026-07-17 Feature 8 · precise prompt tuned for the daily-summary card.
// Client hands this to /api/mail/ai/summarize (or any downstream Anthropic
// call) so the model produces the "reply-required / news / noise" split.
const FOCUS_PROMPT_HINT = 'Summarize the last 7 days of mail. Group by: (1) requires my reply — bullet each with contact + one-line context, (2) meaningful news — bullet each, (3) noise — single count line only. Be crisp — no filler. Max 12 bullets total.';

function makeEmpty(propertyId: number, connected: boolean): InboxSummary {
  return {
    property_id: propertyId,
    connected,
    unread: 0, unanswered: 0, spam: 0,
    inbound_24h: 0, outbound_24h: 0, top_senders_24h: [],
    inbound_7d: 0, outbound_7d: 0, top_senders_7d: [],
    focus_prompt_hint: FOCUS_PROMPT_HINT,
    generated_at: new Date().toISOString(),
    poller_last_run_at: null,
    poller_minutes_since: null,
    last_email_at: null,
    last_email_minutes_since: null,
  };
}

export async function GET(req: NextRequest) {
  noStore();
  const propertyId = Number(req.nextUrl.searchParams.get('property_id')) || PROPERTY_ID;
  try {
    const sb = getSupabaseAdmin();

    // Connected = at least one marketing.user_gmail_connections row for this property.
    // Donna (1000001) currently has no rows → connected=false → frontend
    // shows "not connected yet" instead of zero counts.
    // (PK column is `email`, not `id` — gotcha caught 2026-05-12.)
    const { count: connCount } = await sb.schema('marketing').from('user_gmail_connections')
      .select('email', { count: 'exact', head: true })
      .eq('property_id', propertyId);
    const connected = (connCount ?? 0) > 0;
    if (!connected) {
      return NextResponse.json(makeEmpty(propertyId, false));
    }

    // PBS 2026-07-17 Feature 8 · shift focus to last 7 days (was 24h).
    // We keep the 24h counters for the header pill and add 7d counters for the
    // new daily-summary card; both feeds are always present in the payload.
    const since24h = new Date(Date.now() - 86_400_000).toISOString();
    const since7d  = new Date(Date.now() - 7 * 86_400_000).toISOString();

    // Run the four reads in parallel.
    const [unreadRes, statsRes, msgRes, msg7Res, pollerRes, lastEmailRes] = await Promise.all([
      // Unread = inquiries.status='new' for this property.
      sb.schema('sales').from('inquiries')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId).eq('status', 'new'),
      // Mailbox aggregate (spam + unanswered roll-ups).
      sb.schema('sales').from('v_mailbox_stats')
        .select('spam,unanswered').eq('property_id', propertyId),
      // Last-24h messages (inbound + outbound) for top-sender ranking.
      sb.schema('sales').from('email_messages')
        .select('from_email,from_name,thread_id,received_at,direction')
        .eq('property_id', propertyId).gte('received_at', since24h)
        .limit(2000),
      // Last-7d inbound counts per sender (drill-down "sends per day" +
      // Feature 8 · daily-summary top-sender ranking).
      sb.schema('sales').from('email_messages')
        .select('from_email,from_name,thread_id,received_at,direction')
        .eq('property_id', propertyId)
        .gte('received_at', since7d)
        .limit(8000),
      // Latest Gmail poller run — used to detect a stalled pipeline (intake #15).
      sb.schema('sales').from('gmail_poll_runs')
        .select('started_at')
        .order('started_at', { ascending: false })
        .limit(1),
      // Very-last email in the system (regardless of time window).
      // Supports "Last email 8 days ago" messaging when last 24h is empty.
      sb.schema('sales').from('email_messages')
        .select('received_at')
        .eq('property_id', propertyId)
        .order('received_at', { ascending: false })
        .limit(1),
    ]);

    const unread = unreadRes.count ?? 0;
    const stats = statsRes.data?.[0] ?? { spam: 0, unanswered: 0 };
    const spam = stats.spam ?? 0;
    const unanswered = stats.unanswered ?? 0;

    const msgs = (msgRes.data ?? []).filter(m => m.direction === 'inbound');
    const sent24h = (msgRes.data ?? []).filter(m => m.direction === 'outbound');
    const inbound24 = msgs.length;
    const outbound24 = sent24h.length;

    // 7d inbound only for the sender ranking + Feature 8 card.
    const msgs7 = (msg7Res.data ?? []).filter(m => m.direction === 'inbound');
    const inbound7 = msgs7.length;
    const sent7d = (msg7Res.data ?? []).filter(m => m.direction === 'outbound');
    const outbound7 = sent7d.length;

    // Poller freshness (intake #15).
    const pollerRun = pollerRes.data?.[0];
    const pollerStarted = pollerRun?.started_at ?? null;
    const pollerMins = pollerStarted
      ? Math.floor((Date.now() - new Date(pollerStarted).getTime()) / 60_000)
      : null;

    // Last email (any time window).
    const lastEmailRec = lastEmailRes.data?.[0];
    const lastEmailAt = lastEmailRec?.received_at ?? null;
    const lastEmailMins = lastEmailAt
      ? Math.floor((Date.now() - new Date(lastEmailAt).getTime()) / 60_000)
      : null;

    // 24h senders ranking (legacy pill).
    const senderMap24 = new Map<string, { name: string | null; inbound: number; threads: Set<string>; lastMsg: string }>();
    for (const msg of msgs) {
      const k = msg.from_email ?? '';
      if (!k) continue;
      if (!senderMap24.has(k)) {
        senderMap24.set(k, { name: msg.from_name, inbound: 0, threads: new Set(), lastMsg: msg.received_at });
      }
      const s = senderMap24.get(k)!;
      s.inbound++;
      if (msg.thread_id) s.threads.add(msg.thread_id);
      if (msg.received_at > s.lastMsg) s.lastMsg = msg.received_at;
    }

    // 7d senders ranking (daily-summary card).
    const senderMap7 = new Map<string, { name: string | null; inbound: number; threads: Set<string>; lastMsg: string }>();
    for (const msg of msgs7) {
      const k = msg.from_email ?? '';
      if (!k) continue;
      if (!senderMap7.has(k)) {
        senderMap7.set(k, { name: msg.from_name, inbound: 0, threads: new Set(), lastMsg: msg.received_at });
      }
      const s = senderMap7.get(k)!;
      s.inbound++;
      if (msg.thread_id) s.threads.add(msg.thread_id);
      if (msg.received_at > s.lastMsg) s.lastMsg = msg.received_at;
    }

    const topSenders24: SenderSummary[] = Array.from(senderMap24.entries())
      .map(([email, s]) => ({ email, name: s.name, inbound_24h: s.inbound, inbound_7d: 0, threads_24h: s.threads.size, last_msg: s.lastMsg, is_automation: false }))
      .sort((a, b) => b.inbound_24h - a.inbound_24h).slice(0, 3);

    const topSenders7: SenderSummary[] = Array.from(senderMap7.entries())
      .map(([email, s]) => ({ email, name: s.name, inbound_24h: 0, inbound_7d: s.inbound, threads_24h: s.threads.size, last_msg: s.lastMsg, is_automation: false }))
      .sort((a, b) => b.inbound_7d - a.inbound_7d).slice(0, 10);

    return NextResponse.json({
      property_id: propertyId,
      connected: true,
      unread, unanswered, spam,
      inbound_24h: inbound24, outbound_24h: outbound24, top_senders_24h: topSenders24,
      inbound_7d: inbound7, outbound_7d: outbound7, top_senders_7d: topSenders7,
      focus_prompt_hint: FOCUS_PROMPT_HINT,
      generated_at: new Date().toISOString(),
      poller_last_run_at: pollerStarted,
      poller_minutes_since: pollerMins,
      last_email_at: lastEmailAt,
      last_email_minutes_since: lastEmailMins,
    });
  } catch (err) {
    console.error('inbox/summary error', err);
    return NextResponse.json(makeEmpty(propertyId, false));
  }
}
