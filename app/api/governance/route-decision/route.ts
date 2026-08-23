// app/api/governance/route-decision/route.ts
// brief route_canon_registry-v1 · D3 — set decision on governance.route_registry
// Uses raw fetch + Content-Profile: governance (same pattern as sync-route-registry.mjs)
// because governance schema is not in pgrst.db_schemas public exposure list.
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { route_path, decision, decision_note } = await req.json() as {
    route_path: string;
    decision: string;
    decision_note?: string;
  };

  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'supabase env not configured' }, { status: 500 });

  const res = await fetch(
    `${url}/rest/v1/route_registry?route_path=eq.${encodeURIComponent(route_path)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Content-Profile': 'governance',
        'Accept-Profile': 'governance',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        decision,
        decision_note: decision_note ?? null,
        decision_by:  'operator',
        decision_at:  new Date().toISOString(),
      }),
    }
  );

  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 });
  return NextResponse.json({ ok: true });
}
