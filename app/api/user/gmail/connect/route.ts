// app/api/user/gmail/connect/route.ts
// GET: redirect the currently-signed-in user to Google's OAuth consent screen.
// State = signed-in user_id (so the callback can pair the tokens back to the
// right auth.users row).
import { NextResponse } from 'next/server';
import { getCurrentAuthUser, buildUserAuthUrl } from '@/lib/userGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'https://namkhan-bi.vercel.app'));
  try {
    const url = buildUserAuthUrl(user.id);
    return NextResponse.redirect(url);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return NextResponse.redirect(new URL('/settings/gmail?error=start_failed&detail=' + encodeURIComponent(msg), process.env.NEXT_PUBLIC_APP_URL || 'https://namkhan-bi.vercel.app'));
  }
}
