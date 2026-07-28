// app/api/cron/yt_audit_run/route.ts
// Secret-gated shim for the Lens channel audit (yt-completion brief 2026-07-28,
// verifier objection #3). The real route /api/marketing/youtube/audit-run sits
// behind the Supabase-auth middleware, which is right for the UI button but
// leaves no path for the standing verifier/builder loop to exercise A6.
// Same pattern as every other /api/cron/yt_* shim: CRON_SHARED_SECRET (or
// legacy CRON_SECRET) via ?secret= or x-cron-secret, then delegate to the
// audit handler. Not on a pg_cron schedule — fired on demand.
import { NextResponse } from 'next/server';
import { POST as auditRunPOST } from '@/app/api/marketing/youtube/audit-run/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authGate(req: Request): NextResponse | null {
  const required = process.env.CRON_SHARED_SECRET ?? process.env.CRON_SECRET;
  if (!required) return null;
  const url = new URL(req.url);
  const provided = url.searchParams.get('secret') ?? req.headers.get('x-cron-secret') ?? '';
  if (provided !== required) return NextResponse.json({ ok: false, error: 'cron_secret_invalid' }, { status: 401 });
  return null;
}

export async function POST(req: Request) {
  const gate = authGate(req);
  if (gate) return gate;
  return auditRunPOST();
}
export const GET = POST;
