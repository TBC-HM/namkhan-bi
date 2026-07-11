// app/api/marketing/media/video-render/route.ts
// POST — insert media.video_edits row(s) then invoke shotstack-render.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Payload {
  property_id: number;
  title: string | null;
  channel: string;
  aspect: string | null;
  timeline: any;
  source_asset_ids: string[];
  extra_channels: string[];
}

async function insertAndRender(sb: any, payload: Omit<Payload, 'extra_channels'>) {
  const insert = {
    property_id: payload.property_id,
    title: payload.title,
    channel: payload.channel,
    aspect: payload.aspect,
    timeline: payload.timeline,
    source_asset_ids: payload.source_asset_ids,
    status: 'queued',
    created_by: 'PBS',
  };
  const { data: row, error: insErr } = await sb
    .schema('media')
    .from('video_edits')
    .insert(insert)
    .select('*')
    .single();
  if (insErr || !row) throw new Error(insErr?.message ?? 'insert_failed');

  const { data: fnData, error: fnErr } = await sb.functions.invoke('shotstack-render', {
    body: { video_edit_id: row.id },
  });
  if (fnErr) {
    const msg = (fnErr as any).message ?? String(fnErr);
    if (/SHOTSTACK_API_KEY/i.test(msg) || /shotstack.*missing/i.test(msg)) {
      throw Object.assign(new Error('shotstack_key_missing_in_vault'), { code: 'shotstack_key_missing_in_vault' });
    }
    // Not fatal — leave row in queued state.
    return { row, warn: msg };
  }
  return { row, fn: fnData };
}

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: Payload;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const { property_id, channel, timeline } = body || ({} as Payload);
  if (!property_id || !channel || !timeline) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });

  try {
    const primary = await insertAndRender(sb, {
      property_id, title: body.title ?? null, channel, aspect: body.aspect ?? null,
      timeline, source_asset_ids: body.source_asset_ids ?? [],
    });

    // Extra channels — fetch their aspect first
    const extraIds: string[] = [];
    const extraWarnings: string[] = [];
    for (const c of body.extra_channels ?? []) {
      const { data: spec } = await sb.from('v_media_channel_specs').select('video_aspect_ratio').eq('channel', c).maybeSingle();
      const aspect = spec?.video_aspect_ratio ?? null;
      try {
        const r = await insertAndRender(sb, {
          property_id, title: body.title ?? null, channel: c, aspect,
          timeline, source_asset_ids: body.source_asset_ids ?? [],
        });
        extraIds.push(r.row.id);
        if (r.warn) extraWarnings.push(`${c}: ${r.warn}`);
      } catch (e: any) {
        extraWarnings.push(`${c}: ${e.message}`);
      }
    }
    return NextResponse.json({ ok: true, id: primary.row.id, row: primary.row, extra_ids: extraIds, warnings: extraWarnings });
  } catch (e: any) {
    if (e.code === 'shotstack_key_missing_in_vault') {
      return NextResponse.json({ error: 'shotstack_key_missing_in_vault' }, { status: 503 });
    }
    return NextResponse.json({ error: e.message ?? 'unknown' }, { status: 500 });
  }
}
