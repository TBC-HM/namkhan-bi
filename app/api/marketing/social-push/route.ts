// app/api/marketing/social-push/route.ts
// Handles POST from the Publish tab "Push →" button.
// Calls the social-push Supabase edge function, then redirects back.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EDGE_URL = 'https://kpenyneooigsyuuomgct.supabase.co/functions/v1/social-push';

export async function POST(req: NextRequest) {
  const body = await req.formData().catch(() => null);
  const postId = body?.get('post_id') as string | null;

  if (!postId) return NextResponse.json({ error: 'post_id required' }, { status: 400 });

  const sb = getSupabaseAdmin();

  // Get service role key for edge function auth (edge fn uses verify_jwt=false so anon key works)
  const response = await fetch(EDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ mode: 'push', post_id: postId }),
  });

  const result = await response.json().catch(() => ({}));

  // Redirect back to publish view with status
  const redirectUrl = new URL('/marketing/social', req.url);
  redirectUrl.searchParams.set('view', 'publish');
  if (!result.ok) redirectUrl.searchParams.set('error', result.error ?? 'push failed');

  return NextResponse.redirect(redirectUrl.toString(), { status: 303 });
}

export async function GET() {
  return NextResponse.json({ error: 'POST only' }, { status: 405 });
}
