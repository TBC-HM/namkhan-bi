// app/api/it2/action-center/route.ts
// action-center-inbox-v1 (2026-08-04): client refetch surface for the Action
// Center. Delegates to the SAME fetch the server page uses (_lib/actionCenter)
// so SSR and live refresh can never disagree. Polled after every owner action,
// every 60s, and on tab refocus (A1/A4).

import { NextResponse } from 'next/server';
import { fetchActionCenter } from '@/app/holding/it2/_lib/actionCenter';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const payload = await fetchActionCenter();
    return NextResponse.json(payload);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'fetch failed' }, { status: 500 });
  }
}
