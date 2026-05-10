/**
 * API route: POST /api/parity/trigger
 * Manual on-demand run and health-check ping — ticket #596
 *
 * GET  → health check (returns status + last-run timestamp from DB)
 * POST → triggers the parity agent; accepts { dry_run?: boolean } body
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY — not exposed to the client.
 * Protect this route with an auth check suitable for your stack
 * (Supabase session check, CRON_SECRET header, etc.).
 */

import { NextRequest, NextResponse } from 'next/server';
import { runParityAgent } from '@/lib/parity/agent';

// Simple bearer-token guard — set PARITY_TRIGGER_SECRET in .env.local
function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.PARITY_TRIGGER_SECRET;
  if (!secret) return true; // no secret configured → open (dev only)
  const auth = req.headers.get('authorization') ?? '';
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  return NextResponse.json({
    status: 'ok',
    service: 'parity-agent',
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  let dryRun = false;
  try {
    const body = await req.json();
    dryRun = body?.dry_run === true;
  } catch {
    // no body — fine
  }

  try {
    const result = await runParityAgent({ dryRun });
    return NextResponse.json({ ok: true, dryRun, ...result });
  } catch (err) {
    const message = (err as Error).message;
    console.error('[/api/parity/trigger] Agent error:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
