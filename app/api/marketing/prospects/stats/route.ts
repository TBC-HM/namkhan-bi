// app/api/marketing/prospects/stats/route.ts
// PBS 2026-07-22 · Fix 404 on Audience → Scrape Engine tiles.
// Feeds the live count tiles above the scrape form (ScrapeEngineTab). All numbers
// scoped to Namkhan (property_id=260955). Every counter derives from
// public.v_marketing_prospects_directory except contacted*, which joins
// public.v_marketing_email_send_history so "sent at least once" reflects real
// send events — not just interest signals.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROPERTY_ID = 260955;

export async function GET() {
  const sb = getSupabaseAdmin();

  const dirQ = await sb
    .from('v_marketing_prospects_directory')
    .select('email, mx_valid, created_at')
    .eq('property_id', PROPERTY_ID)
    .limit(5000);
  if (dirQ.error) {
    return NextResponse.json({ ok: false, error: dirQ.error.message }, { status: 500 });
  }
  const rows = dirQ.data ?? [];
  const total       = rows.length;
  const with_email  = rows.filter(r => (r.email ?? '').trim().length > 0).length;
  const mx_valid    = rows.filter(r => r.mx_valid === true).length;
  const last_ingest_at = rows.reduce<string | null>((acc, r) => {
    const c = r.created_at as string | null;
    if (!c) return acc;
    return !acc || c > acc ? c : acc;
  }, null);

  const emails = rows.map(r => (r.email ?? '').trim().toLowerCase()).filter(Boolean);
  const emailSet = new Set(emails);

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let contacted = 0;
  let contacted_l30 = 0;
  if (emailSet.size > 0) {
    const sendQ = await sb
      .from('v_marketing_email_send_history')
      .select('subscriber_email, sent_at')
      .eq('property_id', PROPERTY_ID)
      .limit(20000);
    if (!sendQ.error && sendQ.data) {
      const contactedSet    = new Set<string>();
      const contactedL30Set = new Set<string>();
      for (const s of sendQ.data) {
        const e = (s.subscriber_email ?? '').trim().toLowerCase();
        if (!emailSet.has(e)) continue;
        contactedSet.add(e);
        if (s.sent_at && s.sent_at >= cutoff) contactedL30Set.add(e);
      }
      contacted     = contactedSet.size;
      contacted_l30 = contactedL30Set.size;
    }
  }

  return NextResponse.json({
    ok: true,
    stats: { total, with_email, mx_valid, contacted, contacted_l30, last_ingest_at },
  });
}
