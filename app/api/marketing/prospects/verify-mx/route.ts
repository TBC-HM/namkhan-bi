// app/api/marketing/prospects/verify-mx/route.ts
// PBS 2026-07-05: check whether the domain of each subscriber has ANY MX record.
// Fast + free — Node's built-in DNS. Does NOT confirm the specific mailbox exists,
// only that the domain accepts mail at all. Sub-domains-of-domains that don't resolve
// or have no MX are flagged for deletion.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { promises as dns } from 'dns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function checkMx(email: string): Promise<{ ok: boolean; hosts?: string[] }> {
  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (!domain) return { ok: false };
  try {
    const rec = await dns.resolveMx(domain);
    if (!rec || rec.length === 0) return { ok: false };
    const hosts = rec.sort((a, b) => a.priority - b.priority).map(r => r.exchange).slice(0, 3);
    return { ok: true, hosts };
  } catch {
    return { ok: false };
  }
}

const CONCURRENCY = 20;

async function runBatch<T, R>(items: T[], fn: (t: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
  return results;
}

export async function POST(req: Request) {
  let body: { subscriber_ids?: string[]; all_unchecked?: boolean; limit?: number };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }

  const sb = getSupabaseAdmin();

  let ids: string[] = Array.isArray(body.subscriber_ids) ? body.subscriber_ids : [];

  if (body.all_unchecked) {
    const limit = Math.min(2000, Math.max(1, Number(body.limit ?? 500)));
    const { data } = await sb
      .from('v_marketing_prospects_directory')
      .select('subscriber_id, email')
      .eq('property_id', 260955)
      .is('mx_valid', null)
      .not('email', 'is', null)
      .limit(limit);
    if (data) ids = (data as Array<{ subscriber_id: string; email: string }>).map(r => r.subscriber_id);
  }

  if (!ids.length) return NextResponse.json({ ok: false, error: 'no_ids' }, { status: 400 });

  // Pull emails for the ids
  const { data: rows } = await sb
    .from('v_marketing_prospects_directory')
    .select('subscriber_id, email')
    .in('subscriber_id', ids);
  const items = (rows as Array<{ subscriber_id: string; email: string | null }> | null)?.filter(r => !!r.email) ?? [];

  const results = await runBatch(items, async (r) => {
    const c = await checkMx(r.email as string);
    return { id: r.subscriber_id, ...c };
  });

  let ok = 0; let bad = 0;
  for (const r of results) {
    await sb.rpc('fn_prospect_set_mx', { p_subscriber_id: r.id, p_mx_valid: r.ok, p_mx_hosts: r.hosts ?? null });
    if (r.ok) ok++; else bad++;
  }

  return NextResponse.json({ ok: true, checked: results.length, valid: ok, invalid: bad });
}
