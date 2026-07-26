// app/api/marketing/newsletter-v2/retrieve/route.ts
// Newsletter Writer Team v1 · Liam (curator) retrieval package — Layer 1 (A3).
// POST { property_id, group_slug?, target_date?, seed_text?|concept? } →
// { ok, pace_state, media_captions[3], retreats[], anchor_hints[], surfaces }.
// REUSE-FIRST: wraps the shared engine's refreshLiveContext + fallbackPhotoPick
// (same curated tier-ladder Liam uses inside propose-one) — no duplicate queries.
// Strict by contract: any broken/empty grounding surface → 424 stale_context,
// NO package produced (v3 amendment).

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { refreshLiveContext, fallbackPhotoPick } from '@/lib/emailAgents/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type RetrieveBody = {
  property_id?: number;
  group_slug?: string | null;
  target_date?: string | null;
  seed_text?: string;
  concept?: string;
};

export async function POST(req: NextRequest) {
  let body: RetrieveBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 }); }

  const pid = Number(body.property_id);
  if (!Number.isFinite(pid) || pid <= 0) {
    return NextResponse.json({ ok: false, error: 'property_id_required' }, { status: 400 });
  }
  const group_slug = body.group_slug ? String(body.group_slug) : null;

  const live = await refreshLiveContext(pid, group_slug, body.target_date ?? null);
  if (live.stale.length > 0) {
    return NextResponse.json(
      { ok: false, error: 'stale_context', stale: live.stale, surfaces: live.ctx.surfaces },
      { status: 424 },
    );
  }

  // Photo captions: curated tier ladder (ota/web first, social only as fallback —
  // never archive/internal/untiered). Exactly the pick Liam feeds the writer.
  const sb = getSupabaseAdmin();
  const photos = await fallbackPhotoPick(sb, pid);
  const media_captions = photos.slice(0, 3).map(p => ({
    asset_id: p.asset_id,
    caption: p.caption,
    alt_text: p.alt_text,
    property_area: p.property_area,
  }));

  return NextResponse.json({
    ok: true,
    property_id: pid,
    pace_state: live.pace,
    media_captions,
    retreats: live.ctx.retreats,
    anchor_hints: live.ctx.links.map(l => ({
      section: l.section,
      anchor_hint: l.anchor_hint,
      url: l.url,
      is_pinned: !!l.is_pinned,
    })),
    surfaces: live.ctx.surfaces,
  });
}
