// POST /api/compset/run
// Triggers the compset-agent-run Edge Function. Body:
//   { mode: 'single' | 'phase_1_validation' | 'daily_lean' | 'custom',
//     dates?: string[],
//     comp_ids?: string[],
//     channels?: string[],
//     comp_id?: string, stay_date?: string, channel?: string,  // single mode
//   }
// Returns whatever the function returns (run_id, success/failed counts, outcomes).
//
// Auth: relies on the service-role JWT for invoking the function.
// Edge function runtime budget = 5min. We pass through; client should poll if needed.

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Vercel Pro: 5min

const FN_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') +
  '/functions/v1/compset-agent-run';

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { ok: false, error: 'Supabase env not configured (need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)' },
      { status: 500 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const mode = (body.mode as string | undefined) ?? 'phase_1_validation';

  // Cap dates client passes to keep run under 5min.
  // 22 jobs took ~3min in observed tests. 30 jobs ≈ 4.5min, our soft cap.
  const allowedModes = ['single', 'phase_1_validation', 'daily_lean', 'custom'];
  if (!allowedModes.includes(mode)) {
    return NextResponse.json(
      { ok: false, error: `mode must be one of ${allowedModes.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const fnRes = await fetch(FN_URL, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${key}`,
        'apikey': key,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const text = await fnRes.text();
    let data: unknown = text;
    try { data = JSON.parse(text); } catch {}
    return NextResponse.json(data as object, { status: fnRes.status });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `function invoke failed: ${String(e)}` },
      { status: 500 },
    );
  }
}
