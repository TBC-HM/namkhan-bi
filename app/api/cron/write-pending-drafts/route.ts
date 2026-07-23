// app/api/cron/write-pending-drafts/route.ts
// PBS 2026-07-23 · Background writer for accepted Director slots.
// Accept is now INSTANT in the UI (no awaited ~30s email write); this worker picks
// up concept-only draft campaigns and writes them via the SAME code path as
// propose-one (imported engine — no HTTP self-call).
//
// Auth: x-cron-secret header (CRON_SHARED_SECRET, same pattern as
// /api/marketing/gmail/extract-shared/process). Fired by pg_cron job
// 'write-pending-drafts-2min' (*/2 * * * *) via net.http_post.
//
// Selection: guest.campaigns · status='draft' · property 260955 · updated in the
// last 48h · body is still the bare plan concept (same isConceptOnly test as the
// Broadcasts page: non-empty, <= 700 chars, no '![', no 'Warm regards') · not
// already written by the engine. Oldest first, max 3 per fire (~30s each).

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { proposeOne } from '@/app/api/marketing/newsletter/propose-one/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const NAMKHAN_ID = 260955;
const MAX_PER_RUN = 3;

function checkCronSecret(req: NextRequest): boolean {
  const provided = req.headers.get('x-cron-secret') ?? '';
  if (!provided) return false;
  const envSecret = process.env.CRON_SHARED_SECRET ?? process.env.CRON_SECRET ?? '';
  if (!envSecret) return false;
  return provided === envSecret;
}

// Mirror of broadcasts/page.tsx isConceptOnly — a draft whose body is still the
// bare plan concept (no hero image markdown, no signature).
function isConceptOnly(body_md: string | null, ai_model: string | null): boolean {
  const b = (body_md ?? '').trim();
  if (!(b.length > 0 && b.length <= 700 && !b.includes('Warm regards') && !b.includes('!['))) return false;
  // belt-and-braces: rows the engine already wrote carry a hero + signature and
  // fail the body test anyway; the ai_model guard covers exotic manual edits.
  if (ai_model && /fable5/i.test(ai_model) && b.includes('![')) return false;
  return true;
}

async function run(req: NextRequest): Promise<NextResponse> {
  if (!checkCronSecret(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

  const { data, error } = await sb.schema('guest').from('campaigns')
    .select('campaign_id, body_md, ai_model, updated_at, name')
    .eq('property_id', NAMKHAN_ID)
    .eq('status', 'draft')
    .gt('updated_at', since)
    .not('body_md', 'is', null)
    .order('updated_at', { ascending: true })
    .limit(40);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const pending = (data ?? [])
    .filter(r => isConceptOnly(r.body_md as string | null, r.ai_model as string | null))
    .slice(0, MAX_PER_RUN);

  const results: Array<{ campaign_id: string; ok: boolean; persisted: boolean; veda?: number; error?: string }> = [];
  for (const row of pending) {
    const t = Date.now();
    try {
      const res = await proposeOne({ property_id: NAMKHAN_ID, campaign_id: String(row.campaign_id) });
      const j = await res.json().catch(() => ({} as Record<string, unknown>)) as {
        ok?: boolean; persisted?: { ok?: boolean } | null; veda?: { score?: number }; error?: string;
      };
      results.push({
        campaign_id: String(row.campaign_id),
        ok: !!j.ok,
        persisted: !!j.persisted?.ok,
        veda: j.veda?.score,
        error: j.ok ? undefined : (j.error ?? `status_${res.status}`),
      });
    } catch (e) {
      results.push({ campaign_id: String(row.campaign_id), ok: false, persisted: false, error: (e as Error).message });
    }
    console.log(`[write-pending-drafts] ${row.campaign_id} → ${results[results.length - 1].ok ? 'ok' : 'failed'} in ${Date.now() - t}ms`);
  }

  return NextResponse.json({ ok: true, scanned: (data ?? []).length, pending_found: pending.length, processed: results });
}

export async function POST(req: NextRequest) { return run(req); }
export async function GET(req: NextRequest) { return run(req); }
