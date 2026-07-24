// app/api/cron/brain-battery/route.ts
// BRAIN v1 · the leak / injection / grounding test battery. Runs the EXACT
// ask pipeline the owner UI uses (lib/brain/ask-core.ts) plus raw ACL probes
// against fn_brain_search, so a green battery certifies the live surface.
//
// NOT on any cron schedule — fired on demand (x-cron-secret, CRON_SHARED_SECRET;
// path sits under /api/cron/* so middleware exempts it and the header gate
// inside does the auth). POST body:
//   { "asks":       [{ "id": "...", "question": "...", "tier": "staff_ok|...|legal_confidential" }],
//     "acl_checks": [{ "id": "...", "q": "...", "tier": "..." }] }
// Response echoes per-test raw results (retrieved count, answered flag, answer,
// cited doc_ids) — judgement happens outside; this route never mutates data.

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { brainAsk, type BrainTier } from '@/lib/brain/ask-core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const TIERS = new Set(['staff_ok', 'management', 'owner_only', 'legal_confidential']);

function checkCronSecret(req: NextRequest): boolean {
  const provided = req.headers.get('x-cron-secret') ?? '';
  if (!provided) return false;
  const envSecret = process.env.CRON_SHARED_SECRET ?? process.env.CRON_SECRET ?? '';
  if (!envSecret) return false;
  return provided === envSecret;
}

type AskSpec = { id: string; question: string; tier?: string };
type AclSpec = { id: string; q: string; tier?: string };

export async function POST(req: NextRequest) {
  if (!checkCronSecret(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  let body: { asks?: AskSpec[]; acl_checks?: AclSpec[] } = {};
  try { body = await req.json(); } catch { /* noop */ }
  const asks = (body.asks ?? []).slice(0, 20);
  const aclChecks = (body.acl_checks ?? []).slice(0, 20);
  const sb = getSupabaseAdmin();

  const askResults: Array<Record<string, unknown>> = [];
  for (const a of asks) {
    const tier = (TIERS.has(a.tier ?? '') ? a.tier : 'legal_confidential') as BrainTier;
    try {
      const r = await brainAsk(String(a.question ?? '').slice(0, 2000), tier);
      askResults.push({
        id: a.id, tier, answered: r.answered, refused_reason: r.refusedReason,
        retrieved: r.retrievedChunkIds.length,
        cited_doc_ids: r.sources.map(s => s.doc_id),
        answer: r.answer.slice(0, 1500),
      });
    } catch (e) {
      askResults.push({ id: a.id, error: e instanceof Error ? e.message.slice(0, 300) : 'err' });
    }
  }

  const aclResults: Array<Record<string, unknown>> = [];
  for (const c of aclChecks) {
    const tier = TIERS.has(c.tier ?? '') ? c.tier : 'staff_ok';
    const { data, error } = await sb.rpc('fn_brain_search', {
      p_q: String(c.q ?? '').slice(0, 500), p_max_sensitivity: tier, p_limit: 8,
    });
    aclResults.push({
      id: c.id, tier, rows: error ? -1 : (data ?? []).length,
      sensitivities: error ? [] : [...new Set(((data ?? []) as Array<{ sensitivity: string }>).map(r => r.sensitivity))],
      error: error?.message,
    });
  }

  return NextResponse.json({ ok: true, asks: askResults, acl_checks: aclResults });
}
