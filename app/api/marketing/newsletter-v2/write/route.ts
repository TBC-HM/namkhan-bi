// app/api/marketing/newsletter-v2/write/route.ts
// Newsletter Writer Team v1 · Saya → Veda chain — Layers 2+3 (A4, A5).
// POST = ProposeBody with MANDATORY property_id. Runs the ONE shared writer
// engine (lib/emailAgents/engine.ts · REUSE-FIRST — same code path as legacy
// propose-one and the cron worker) with the Layer 0 guarantees enforced:
//   - refreshLiveContext on every call (context + pace pulled fresh from prod)
//   - strict_context: broken/empty grounding surface → 424 stale_context,
//     NO draft produced (v3 amendment)
//   - Veda critic loop: score < 60 → one grounded rewrite (max 2 iterations)
// Old routes stay live untouched; UI call sites swap here behind
// NEWSLETTER_V2_ENABLED in the A11 rewire (one batch).

import { NextResponse, type NextRequest } from 'next/server';
import { proposeOne, type ProposeBody } from '@/lib/emailAgents/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  let body: ProposeBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 }); }

  const pid = Number(body.property_id);
  if (!Number.isFinite(pid) || pid <= 0) {
    return NextResponse.json({ ok: false, error: 'property_id_required' }, { status: 400 });
  }

  return proposeOne({ ...body, property_id: pid, strict_context: true });
}
