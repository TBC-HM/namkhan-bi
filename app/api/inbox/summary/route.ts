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
import { NextResponse } from 'next/server';
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
  unread: number;
  unanswered: number;
  spam: number;
  inbound_24h: number;
  outbound_24h: number;
  top_senders_24h: SenderSummary[];
  generated_at: string;
}

const EMPTY: InboxSummary = {
  unread: 0, unanswered: 0, spam: 0,
  inbound_24h: 0, outbound_24h: 0, top_senders_24h: [],
  generated_at: new Date().toISOString(),
};

export async function GET() {
  noStore();
  try {
    const sb = getSupabaseAdmin();
    const since24h = new Date(Date.now() - 86_400_000).toISOString();
    const since7d  = new Date(Date.now() - 7 * 86_400_000).toISOString();

    // Run the four reads in parallel.
    const [unreadRes, statsRes, msgRes, msg7Res] = await Promise.all([
      // Unread = inquiries.status='new' for this property.
      sb.schema('sales').from('inquiries')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', PROPERTY_ID).eq('status', 'new'),
      // Mailbox aggregate (spam + unanswered roll-ups).
      sb.schema('sales').from('v_mailbox_stats')
        .select('spam,unanswered').eq('property_id', PROPERTY_ID),
      // Last-24h messages (inbound + outbound) for top-sender ranking.
      sb.schema('sales').from('email_messages')
        .select('from_email,from_name,thread_id,received_at,direction')
        .eq('property_id', PROPERTY_ID).gte('received_at', since24h)
        .limit(2000),
      // Last-7d inbound counts per sender (drill-down "sends per day").
      sb.schema('sales').from('email_messages')
        .select('from_email,received_at')
        .eq('property_id', PROPERTY_ID).eq('direction', 'inbound')
        .gte('received_at', since7d)
        .limit(5000),
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

    // Roll 7d inbound counts onto the same senders (drill-down stat).
    const msgs7 = (msg7Res.data ?? []) as Array<{ from_email: string | null }>;
    const seven = new Map<string, number>();
    for (const r of msgs7) {
      const k = (r.from_email || '(unknown)').toLowerCase();
      seven.set(k, (seven.get(k) ?? 0) + 1);
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

    const payload: InboxSummary = {
      unread:           unreadRes.count ?? 0,
      unanswered:       totalUnanswered,
      spam:             totalSpam,
      inbound_24h:      inbound24,
      outbound_24h:     outbound24,
      top_senders_24h,
      generated_at:     new Date().toISOString(),
    };
    return NextResponse.json(payload);
  } catch (err) {
    // Log so the failure is visible in Vercel/server logs; return a sentinel
    // so the frontend can distinguish "real zero" from "fetch error".
    console.error('[inbox/summary] query failed:', err);
    return NextResponse.json(
      { ...EMPTY, generated_at: new Date().toISOString(), _error: true },
      { status: 200 }, // keep 200 so the header never breaks
    );
  }
}
