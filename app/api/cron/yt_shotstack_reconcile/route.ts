// app/api/cron/yt_shotstack_reconcile/route.ts
// Middleware-bypassed cron shim for check_shotstack_renders.
// 2026-07-28 (yt-completion brief):
//  - authGate now accepts CRON_SHARED_SECRET (the secret pg_cron actually sends,
//    same pattern as brain-classify). The old CRON_SECRET-only check 401'd every
//    pg_cron fire since job creation — 4,000+ burned no-op fires.
//  - Early-exit BEFORE loading the skill when no render job is in a non-terminal
//    state: one indexed count on v_yt_render_jobs, no Shotstack call, <200ms.
//    Preserves the 5-min pg_cron schedule (job 138).
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { POST as checkRendersPOST } from '@/app/api/cockpit/skills/check_shotstack_renders/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NON_TERMINAL = ['queued', 'submitted', 'fetching', 'rendering', 'saving'];

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

  // Cheap early-exit: nothing to reconcile → don't touch Shotstack at all.
  const sb = getSupabaseAdmin();
  const { count, error } = await sb
    .from('v_yt_render_jobs')
    .select('render_job_id', { count: 'exact', head: true })
    .in('status', NON_TERMINAL);
  if (!error && (count ?? 0) === 0) {
    return NextResponse.json({ ok: true, checked: 0, transitions: [], early_exit: true });
  }

  return checkRendersPOST();
}
export const GET = POST;
