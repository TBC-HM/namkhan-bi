// app/api/marketing/social/push/route.ts
// Delegates post publishing to the social-push Supabase edge function.
// Edge fn uses Upload Post SDK (esm.sh) which bypasses Cloudflare Bot Protection
// that blocks raw fetch() from data-centre IPs.
//
// POST { post_id, property_id? }
// → { ok, up_request_id, up_status } | { ok: false, error }

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let body: { post_id?: string; property_id?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  if (!body.post_id) return NextResponse.json({ error: 'post_id required' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.functions.invoke('social-push', {
    body: { mode: 'push', post_id: body.post_id, property_id: body.property_id ?? null },
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  return NextResponse.json(data);
}
