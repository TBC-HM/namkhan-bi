// app/api/google/pull-now/route.ts
// PBS 2026-07-03: manual "Pull latest" trigger for Google reviews + Maps insights.
// Fires both pulls, redirects back to /guest/reputation with status params.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const property = Number(req.nextUrl.searchParams.get('property') ?? '260955');
  const base = new URL('/guest/reputation', req.url);
  try {
    const sb = getSupabaseAdmin();
    const [reviewsR, perfR] = await Promise.all([
      sb.functions.invoke('google-sync', { body: { action: 'pull-reviews',     propertyID: property } }),
      sb.functions.invoke('google-sync', { body: { action: 'pull-performance', propertyID: property, daysBack: 540 } }),
    ]);
    const parts: string[] = [];
    if (reviewsR.error) parts.push('reviews_err:' + String((reviewsR.error as any)?.message ?? reviewsR.error).slice(0,80));
    else parts.push('reviews:' + ((reviewsR.data as any)?.upserted ?? 0));
    if (perfR.error) parts.push('perf_err:' + String((perfR.error as any)?.message ?? perfR.error).slice(0,80));
    else parts.push('perf:' + ((perfR.data as any)?.days ?? 0));
    base.searchParams.set('pull', parts.join(' · '));
    return NextResponse.redirect(base, 302);
  } catch (e: any) {
    base.searchParams.set('pull', 'error:' + String(e?.message ?? e).slice(0,120));
    return NextResponse.redirect(base, 302);
  }
}
