// app/api/marketing/newsletter-v2/refine/route.ts
// Newsletter Writer Team v1 · campaign refine — A11 UI cutover surface.
//
// POST { campaign_id, instruction } — the RefineNewsletterButton now calls
// THIS route unconditionally; the NEWSLETTER_V2_ENABLED flag is read
// SERVER-SIDE here (R5 design — no client env leakage):
//   flag ON  → the shared writer engine runs in refine mode (instruction +
//              prior) with the full Layer 0 guarantees: refreshLiveContext on
//              every call, strict stale-context guard (424, no output), Veda
//              score attached to the response. NO campaign_id is passed to
//              the engine, so nothing is persisted — accept only updates the
//              editor and PBS still clicks Save (unchanged UX, and seeded
//              DO-NOT-TOUCH campaigns can never be rewritten from here).
//   flag OFF → proxies to the legacy /api/marketing/email/refine-block
//              handler (old route stays live, byte-identical behavior).

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { proposeOne, type ProposeBody } from '@/lib/emailAgents/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

function v2Enabled(): boolean {
  const v = String(process.env.NEWSLETTER_V2_ENABLED ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'on';
}

type RefineBody = { campaign_id?: string; instruction?: string };

export async function POST(req: NextRequest) {
  let body: RefineBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 }); }

  const campaign_id = String(body.campaign_id ?? '').trim();
  const instruction = String(body.instruction ?? '').trim().slice(0, 800);
  if (!campaign_id) return NextResponse.json({ ok: false, error: 'campaign_id_required' }, { status: 400 });
  if (!instruction) return NextResponse.json({ ok: false, error: 'instruction_required' }, { status: 400 });

  if (!v2Enabled()) {
    // Legacy path: same handler the button called before the A11 rewire.
    const r = await fetch(`${req.nextUrl.origin}/api/marketing/email/refine-block`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'newsletter_campaign', id: campaign_id, instruction }),
    });
    const j = await r.json().catch(() => ({ ok: false, error: `legacy_http_${r.status}` }));
    return NextResponse.json(j, { status: r.status });
  }

  const sb = getSupabaseAdmin();
  const { data: camp, error: campErr } = await sb.schema('guest').from('campaigns')
    .select('campaign_id, property_id, name, subject, body_md, campaign_kind, group_slug, audience_type, planned_date')
    .eq('campaign_id', campaign_id).maybeSingle();
  if (campErr) return NextResponse.json({ ok: false, error: `load_campaign_failed: ${campErr.message}` }, { status: 500 });
  if (!camp) return NextResponse.json({ ok: false, error: 'campaign_not_found' }, { status: 404 });

  const proposeBody: ProposeBody = {
    property_id: Number(camp.property_id),
    kind: camp.campaign_kind ?? 'broadcast',
    seed_text: String(camp.name ?? camp.subject ?? '').trim() || `Campaign ${campaign_id}`,
    group_slug: camp.group_slug ?? null,
    audience_type: camp.audience_type === 'b2b' ? 'b2b' : 'b2c',
    target_date: camp.planned_date ?? undefined,
    instruction,
    prior: { subject: camp.subject ?? undefined, body_md: camp.body_md ?? undefined },
    strict_context: true,
    // NO campaign_id — refine never auto-persists (accept → editor → Save).
  };

  const res = await proposeOne(proposeBody);
  const j = await res.json().catch(() => null) as {
    ok?: boolean; error?: string; stale?: string[];
    proposal?: { subject?: string; body_md?: string };
    veda?: { score?: number; issues?: string[]; critique?: string };
  } | null;

  if (!j?.ok || !j.proposal) {
    return NextResponse.json(
      { ok: false, error: j?.error ?? `engine_http_${res.status}`, stale: j?.stale },
      { status: res.status === 200 ? 502 : res.status },
    );
  }

  return NextResponse.json({
    ok: true,
    proposal: {
      campaign_id,
      subject: j.proposal.subject ?? null,
      body_md: j.proposal.body_md ?? null,
    },
    veda: j.veda ?? null,
    property_id: Number(camp.property_id),
    engine: 'newsletter-v2',
  });
}
