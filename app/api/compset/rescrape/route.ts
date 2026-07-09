// app/api/compset/rescrape/route.ts
// PBS 2026-07-09 pm: Server-side relay to scrape-competitor-profile edge fn.
// Uses service-role key to bypass the fn's verify_jwt gate.

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body?.comp_id) return NextResponse.json({ error: 'comp_id required' }, { status: 400 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ error: 'server not configured' }, { status: 500 });

    const res = await fetch(`${url}/functions/v1/scrape-competitor-profile`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ comp_id: body.comp_id }),
    });
    const j = await res.json().catch(() => ({ error: `edge fn returned ${res.status}` }));
    return NextResponse.json(j, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
