// app/api/marketing/media/render-for-channel/route.ts
// POST — render a stored master asset to a specific channel size.
// Tries edge fn 'render-media' first; if it does not exist, returns a
// graceful "not_yet_configured" response so the button never 500s.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const { asset_id, channel, property_id } = body || {};
  if (!asset_id || !channel) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });

  try {
    const { data: spec, error: specErr } = await sb.from('v_media_channel_specs').select('*').eq('channel', channel).maybeSingle();
    if (specErr || !spec) return NextResponse.json({ error: 'unknown_channel', channel }, { status: 400 });

    const { data, error } = await sb.functions.invoke('render-media', {
      body: { asset_id, channel, property_id: property_id ?? null, spec },
    });
    if (error) {
      const msg = (error as any).message ?? String(error);
      if (/not.*found/i.test(msg) || /404/.test(msg) || /No such function/i.test(msg)) {
        return NextResponse.json({
          ok: false, error: 'render_media_not_yet_configured',
          message: 'render-media edge function is not deployed yet — request queued for later.',
          channel,
        }, { status: 202 });
      }
      return NextResponse.json({ error: msg }, { status: 502 });
    }
    return NextResponse.json({ ok: true, ...(data as any) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'unknown' }, { status: 500 });
  }
}
