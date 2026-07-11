// app/api/cron/yt_shotstack_reconcile/route.ts
// Middleware-bypassed cron shim for check_shotstack_renders.
import { NextResponse } from 'next/server';
import { POST as checkRendersPOST } from '@/app/api/cockpit/skills/check_shotstack_renders/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authGate(req: Request): NextResponse | null {
  const required = process.env.CRON_SECRET;
  if (!required) return null;
  const url = new URL(req.url);
  const provided = url.searchParams.get('secret') ?? req.headers.get('x-cron-secret') ?? '';
  if (provided !== required) return NextResponse.json({ ok: false, error: 'cron_secret_invalid' }, { status: 401 });
  return null;
}

export async function POST(req: Request) {
  const gate = authGate(req);
  if (gate) return gate;
  return checkRendersPOST();
}
export const GET = POST;
