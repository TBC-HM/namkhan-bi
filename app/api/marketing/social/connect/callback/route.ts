// app/api/marketing/social/connect/callback/route.ts
// OAuth callback — Upload Post redirects here after a social account is connected.
// Upserts the profile into upload_post_profiles and fires sync_profiles (fire-and-forget).
//
// GET ?property_id=260955&platform=instagram[&error=...]

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.beyondcircle.ai';

function profileSlug(pid: number): string { return `bc${pid}`; }

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const propertyId = Number(searchParams.get('property_id'));
  const platform   = searchParams.get('platform') ?? '';
  const oauthError = searchParams.get('error');

  const settingsBase = `${APP_URL}/h/${propertyId}/settings/social`;

  if (oauthError || !propertyId || !platform) {
    return NextResponse.redirect(
      `${settingsBase}?connect=failed&platform=${platform}&reason=${oauthError ?? 'missing_params'}`,
    );
  }

  const sb = getSupabaseAdmin();

  await sb.rpc('fn_social_profile_upsert', {
    p_property_id:  propertyId,
    p_platform:     platform,
    p_up_user_id:   profileSlug(propertyId),
    p_display_name: null,
    p_handle:       null,
    p_avatar_url:   null,
  });

  // Fire-and-forget: fill handle/display_name via sync_profiles
  sb.functions.invoke('social-push', {
    body: { mode: 'sync_profiles', property_id: propertyId, platforms: [platform] },
  }).catch(() => {});

  return NextResponse.redirect(`${settingsBase}?connect=success&platform=${platform}`);
}
