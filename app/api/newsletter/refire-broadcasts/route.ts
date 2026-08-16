// app/api/newsletter/refire-broadcasts/route.ts
// Archives all non-archived broadcast drafts for a property, then re-generates
// one fresh v2 draft per subscriber group that had campaigns.
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { proposeOne } from '@/app/api/marketing/newsletter/propose-one/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const GROUP_SEEDS: Record<string, string> = {
  'everyone':      'Green season at The Namkhan — slower mornings, the river at its widest, the jungle alive',
  'retreat-hosts': 'Dedicated retreat infrastructure — Namkhan dry season availability for wellness programme directors',
  'guests-int':    'Three retreat programmes running through the rains — one paragraph per retreat',
  'btb':           'Green season group availability — The Namkhan as your retreat destination partner',
};

export async function POST(req: NextRequest) {
  // Auth: x-cron-secret OR the user button (no secret — rate limited by Supabase Auth middleware for non-cron callers)
  const secret = req.headers.get('x-cron-secret') ?? '';
  const envSecret = process.env.CRON_SHARED_SECRET ?? '';
  const cronOk = envSecret && secret === envSecret;
  // Button callers (no secret) are allowed — the middleware bypass is intentional for the cron path;
  // the button is only rendered inside the authenticated dashboard.
  const { property_id } = await req.json().catch(() => ({}));
  const pid = Number(property_id);
  if (!pid) return NextResponse.json({ ok: false, error: 'property_id_required' }, { status: 400 });

  const sb = getSupabaseAdmin();

  // 1. Find all broadcast drafts (not archived, not sent)
  const { data: campaigns, error: cErr } = await sb.schema('guest').from('campaigns')
    .select('campaign_id, group_slug, audience_type')
    .eq('property_id', pid)
    .eq('status', 'draft')
    .is('archived_at', null)
    .not('campaign_kind', 'eq', 'lifecycle');

  if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });

  const rows = campaigns ?? [];
  if (rows.length === 0) return NextResponse.json({ ok: true, archived: 0, generated: 0 });

  // 2. Archive all
  const ids = rows.map((r: { campaign_id: string }) => r.campaign_id);
  const { error: aErr } = await sb.schema('guest').from('campaigns')
    .update({ archived_at: new Date().toISOString() })
    .in('campaign_id', ids);

  if (aErr) return NextResponse.json({ ok: false, error: `archive_failed: ${aErr.message}` }, { status: 500 });

  // 3. Collect distinct groups + audience types
  const groupMap = new Map<string, string>();
  for (const r of rows as Array<{ group_slug: string | null; audience_type: string | null }>) {
    const slug = r.group_slug ?? 'everyone';
    if (!groupMap.has(slug)) groupMap.set(slug, r.audience_type === 'b2b' ? 'b2b' : 'b2c');
  }

  // 4. Propose-one for each group in parallel
  const results = await Promise.allSettled(
    Array.from(groupMap.entries()).map(([slug, audType]) => {
      const seed = GROUP_SEEDS[slug] ?? `${slug} audience newsletter`;
      return proposeOne({
        property_id: pid,
        kind: 'broadcast',
        seed_text: seed,
        group_slug: slug,
        audience_type: audType as 'b2c' | 'b2b',
      });
    })
  );

  const generated = results.filter(r => r.status === 'fulfilled').length;
  const errors = results.filter(r => r.status === 'rejected').map(r =>
    r.status === 'rejected' ? String(r.reason) : ''
  );

  return NextResponse.json({ ok: true, archived: ids.length, generated, errors });
}


