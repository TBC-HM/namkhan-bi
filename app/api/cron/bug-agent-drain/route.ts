// app/api/cron/bug-agent-drain/route.ts
// PBS 2026-07-17 — cron-callable drain endpoint. Middleware whitelists
// /api/cron/*. Called by pg_cron job `bug-agent-drain-3h` (jobid 144).
//
// GET /api/cron/bug-agent-drain?max=3
//   → runs runAgentJob({mode:'drain', max, triggered_by:'cron'})
//
// POST accepted with same params for manual test via curl.

import { NextResponse } from 'next/server';
import { runAgentJob } from '@/lib/bugAgent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function handle(req: Request) {
  const url = new URL(req.url);
  const max = Math.min(Math.max(1, Number(url.searchParams.get('max') ?? '3')), 3);
  const result = await runAgentJob({ mode: 'drain', max, triggered_by: 'cron' });
  return NextResponse.json({ phase: 'B', trigger: 'cron', ...result });
}

export async function GET(req: Request)  { return handle(req); }
export async function POST(req: Request) { return handle(req); }
