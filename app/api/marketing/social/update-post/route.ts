// app/api/marketing/social/update-post/route.ts
// PBS 2026-09-03 — client-facing wrapper for fn_social_post_update(jsonb).
// Accepts partial fields (caption, hashtags, title, media_urls, link_url,
// scheduled_at) — only keys present in the request body are updated (the DB
// function uses jsonb ? operator for selective PATCH semantics).
// Draft and ready posts only; pushed/cancelled posts are read-only.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_FIELDS = new Set(['caption', 'hashtags', 'title', 'media_urls', 'link_url', 'scheduled_at']);

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const post_id = String(body.post_id ?? '').trim();
  if (!post_id) return NextResponse.json({ ok: false, error: 'post_id required' }, { status: 400 });

  // Build update patch — only whitelisted fields
  const patch: Record<string, unknown> = { post_id };
  for (const key of ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      patch[key] = body[key];
    }
  }
  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ ok: false, error: 'no updatable fields provided' }, { status: 400 });
  }

  // Guard: only draft or ready posts
  const sb = getSupabaseAdmin();
  const { data: existing } = await sb.from('v_social_posts')
    .select('status,property_id')
    .eq('post_id', post_id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ ok: false, error: 'post not found' }, { status: 404 });
  if (!['draft', 'ready'].includes(existing.status)) {
    return NextResponse.json({ ok: false, error: `cannot edit ${existing.status} post` }, { status: 409 });
  }

  const { error } = await sb.rpc('fn_social_post_update', { p: patch });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, post_id });
}
