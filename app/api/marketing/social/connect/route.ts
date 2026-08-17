// app/api/marketing/social/connect/route.ts
// Starts an Upload Post OAuth flow for a property's social profile.
// Profile slug: bc{property_id} — bc260955 = Namkhan, bc1000001 = Donna.
// One Upload Post account; tenant isolation is entirely via the profile slug.
//
// POST { property_id, platform, redirect_url? }
// → { ok, authorize_url, profile_username, state, expires_in }
//
// For OAuth without redirect UI, use client.generateJwt() via the edge fn instead.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UP_BASE = 'https://api.upload-post.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.beyondcircle.ai';

const SUPPORTED = new Set([
  'tiktok','instagram','facebook','linkedin','youtube',
  'x','threads','reddit','pinterest','google-business','snapchat',
]);

function profileSlug(pid: number): string { return `bc${pid}`; }

export async function POST(req: NextRequest) {
  let body: { property_id?: number; platform?: string; redirect_url?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const propertyId = Number(body.property_id);
  const platform   = (body.platform ?? '').toLowerCase();
  if (!propertyId) return NextResponse.json({ error: 'property_id required' }, { status: 400 });
  if (!SUPPORTED.has(platform)) {
    return NextResponse.json({ error: `unsupported_platform: ${platform}`, supported: [...SUPPORTED] }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data: apiKey } = await sb.rpc('fn_upload_post_credentials');
  if (!apiKey) return NextResponse.json({ error: 'upload_post_key_not_configured' }, { status: 500 });

  const profileUsername = profileSlug(propertyId);
  const callbackUrl = body.redirect_url
    ?? `${APP_URL}/api/marketing/social/connect/callback?property_id=${propertyId}&platform=${platform}`;

  const upRes = await fetch(`${UP_BASE}/api/uploadposts/oauth/${platform}/start`, {
    method: 'POST',
    headers: { 'Authorization': `Apikey ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile: profileUsername, redirect_url: callbackUrl }),
  });

  const upJson = await upRes.json().catch(() => ({})) as Record<string, unknown>;
  if (!upRes.ok || !upJson.authorize_url) {
    return NextResponse.json({ error: upJson.message ?? 'upload_post_oauth_error', detail: upJson }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    profile_username: profileUsername,
    authorize_url:    upJson.authorize_url,
    state:            upJson.state,
    expires_in:       upJson.expires_in ?? 900,
  });
}
