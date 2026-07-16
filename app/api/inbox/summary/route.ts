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

    // Connected = at least one sales.gmail_connections row for this property.
    // Donna (1000001) currently has no rows → connected=false → frontend
    // shows "not connected yet" instead of zero counts.
    // (PK column is `email`, not `id` — gotcha caught 2026-05-12.)
    const { count: connCount } = await sb.schema('sales').from('gmail_connections')
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
      // Last inbound email regardless of window — surfaces "Last mail 8d ago"
      // when the 24h count looks suspiciously like a bug.
      sb.schema('sales').from('email_messages')
        .select('received_at')
        .eq('property_id', propertyId).eq('direction', 'inbound')
        .order('received_at', { ascending: false })
        .limit(1),
    ]);

    const stats = (statsRes.data ?? []) as Array<{ spam: number; unanswered: number }>;
    const totalSpam       = stats.reduce((s, r) => s + (r.spam ?? 0), 0);
    const totalUnanswered = stats.reduce((s, r) => s + (r.unanswered ?? 0), 0);

    // 24h sender aggregation.
    const msgs24 = (msgRes.data ?? []) as Array<{
      from_email: string | null; from_name: string | null;
      thread_id: string | null; received_at: string;
      direction: 'inbound' | 'outbound';
    }>;
    let inbound24 = 0, outbound24 = 0;
    const senders = new Map<string, SenderSummary & { _threads: Set<string> }>();
    for (const r of msgs24) {
      if (r.direction === 'outbound') { outbound24 += 1; continue; }
      inbound24 += 1;
      const email = (r.from_email || '(unknown)').toLowerCase();
      let s = senders.get(email);
      if (!s) {
        s = {
          email,
          name: r.from_name ?? null,
          inbound_24h: 0,
          inbound_7d: 0,
          threads_24h: 0,
          last_msg: null,
          is_automation: /noreply|no-reply|donotreply|do-not-reply|notification|mailer-daemon|drive-shares-dm/i.test(email),
          _threads: new Set<string>(),
        };
        senders.set(email, s);
      }
      s.inbound_24h += 1;
      if (r.thread_id) s._threads.add(r.thread_id);
      if (!s.last_msg || r.received_at > s.last_msg) s.last_msg = r.received_at;
      if (!s.name && r.from_name) s.name = r.from_name;
    }

    // PBS 2026-07-17 Feature 8: full 7d aggregation for daily-summary card.
    const msgs7 = (msg7Res.data ?? []) as Array<{
      from_email: string | null; from_name: string | null;
      thread_id: string | null; received_at: string;
      direction: 'inbound' | 'outbound';
    }>;
    let inbound7 = 0, outbound7 = 0;
    const seven = new Map<string, number>();
    const senders7 = new Map<string, SenderSummary & { _threads: Set<string> }>();
    for (const r of msgs7) {
      if (r.direction === 'outbound') { outbound7 += 1; continue; }
      inbound7 += 1;
      const k = (r.from_email || '(unknown)').toLowerCase();
      seven.set(k, (seven.get(k) ?? 0) + 1);
      let s = senders7.get(k);
      if (!s) {
        s = {
          email: k, name: r.from_name ?? null,
          inbound_24h: 0, inbound_7d: 0, threads_24h: 0, last_msg: null,
          is_automation: /noreply|no-reply|donotreply|do-not-reply|notification|mailer-daemon|drive-shares-dm/i.test(k),
          _threads: new Set<string>(),
        };
        senders7.set(k, s);
      }
      s.inbound_7d += 1;
      if (r.thread_id) s._threads.add(r.thread_id);
      if (!s.last_msg || r.received_at > s.last_msg) s.last_msg = r.received_at;
      if (!s.name && r.from_name) s.name = r.from_name;
    }

    const top_senders_24h: SenderSummary[] = Array.from(senders.values())
      .map((s) => ({
        email: s.email,
        name: s.name,
        inbound_24h: s.inbound_24h,
        inbound_7d: seven.get(s.email) ?? s.inbound_24h,
        threads_24h: s._threads.size,
        last_msg: s.last_msg,
        is_automation: s.is_automation,
      }))
      .sort((a, b) => b.inbound_24h - a.inbound_24h)
      .slice(0, 5);

    const top_senders_7d: SenderSummary[] = Array.from(senders7.values())
      .filter((s) => !s.is_automation)
      .map((s) => ({
        email: s.email,
        name: s.name,
        inbound_24h: seven.get(s.email) ?? 0,
        inbound_7d: s.inbound_7d,
        threads_24h: s._threads.size,
        last_msg: s.last_msg,
        is_automation: s.is_automation,
      }))
      .sort((a, b) => b.inbound_7d - a.inbound_7d)
      .slice(0, 10);

    // Poller freshness (intake #15).
    const pollerRow = ((pollerRes.data ?? []) as Array<{ started_at: string }>)[0] ?? null;
    const pollerLast = pollerRow?.started_at ?? null;

    const lastEmailRow = ((lastEmailRes.data ?? []) as Array<{ received_at: string }>)[0] ?? null;
    const lastEmailAt = lastEmailRow?.received_at ?? null;
    const lastEmailMinSince = lastEmailAt
      ? Math.round((Date.now() - new Date(lastEmailAt).getTime()) / 60_000)
      : null;
    const pollerMinSince = pollerLast
      ? Math.round((Date.now() - new Date(pollerLast).getTime()) / 60_000)
      : null;

    const payload: InboxSummary = {
      property_id:              propertyId,
      connected:                true,
      unread:                   unreadRes.count ?? 0,
      unanswered:               totalUnanswered,
      spam:                     totalSpam,
      inbound_24h:              inbound24,
      outbound_24h:             outbound24,
      top_senders_24h,
      // PBS 2026-07-17 Feature 8 · 7d fields.
      inbound_7d:               inbound7,
      outbound_7d:              outbound7,
      top_senders_7d,
      focus_prompt_hint:        FOCUS_PROMPT_HINT,
      generated_at:             new Date().toISOString(),
      poller_last_run_at:       pollerLast,
      poller_minutes_since:     pollerMinSince,
      last_email_at:            lastEmailAt,
      last_email_minutes_since: lastEmailMinSince,
    };
    return NextResponse.json(payload);
  } catch {
    // Never break the header on a transient query failure. Report as
    // "connected but errored" — frontend still hides the not-connected
    // notice and just keeps the last known values.
    return NextResponse.json(makeEmpty(propertyId, true));
  }
}
