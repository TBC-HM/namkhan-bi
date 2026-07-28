// app/api/cron/bug-agent-orphan-sweep/route.ts
// 2026-07-28 (standing builder, brief autospec-bug_agent_module-20260725,
// verifier objection G3) — 10-min heartbeat that finalizes bug-agent runs
// orphaned by a Vercel maxDuration kill (phase stuck non-terminal, ended_at
// NULL, >10 min). Logic lives in lib/bugAgent.ts finalizeOrphanRuns().
//
// WHY A SEPARATE CRON ROUTE: the natural host (bugs/sweep STEP C, which also
// calls the finalizer) sits behind the cookie-auth middleware — Vercel cron
// fires reach it unauthenticated and get 401. /api/cron/* is middleware-
// whitelisted, so this thin route is the heartbeat that actually fires.
// (That same 401 is very likely why sweep STEP A never created a single
// ticket in 11 weeks — noted in the brief for the verifier.)

import { NextResponse } from 'next/server';
import { finalizeOrphanRuns } from '@/lib/bugAgent';
import { automationGuard } from '@/lib/cron/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function handle() {
  // GLOBAL KILL SWITCH (ops-scheduler-console-v1 A3)
  const blocked = await automationGuard('/api/cron/bug-agent-orphan-sweep');
  if (blocked) return blocked;
  try {
    const r = await finalizeOrphanRuns();
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function GET() { return handle(); }
export async function POST() { return handle(); }
