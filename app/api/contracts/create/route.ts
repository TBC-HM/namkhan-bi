// app/api/contracts/create/route.ts
// PBS 2026-07-07: server-side relay to create-revenue-contract edge fn.
// The edge fn has verify_jwt=true; we authenticate with the service-role key.

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: 'server not configured (SUPABASE_URL / SERVICE_ROLE_KEY missing)' }, { status: 500 });
    }
    const res = await fetch(`${url}/functions/v1/create-revenue-contract`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({ error: `edge fn returned ${res.status}` }));
    return NextResponse.json(j, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
