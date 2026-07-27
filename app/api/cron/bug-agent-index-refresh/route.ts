// app/api/cron/bug-agent-index-refresh/route.ts
// 2026-07-27 (standing builder, brief autospec-bug_agent_module-20260725 §2)
// Nightly refresh of cockpit.bug_agent_code_index — the structural code
// inventory the bug-agent planner uses to resolve REAL repo paths instead of
// guessing (the [propertyId] guess blinded it for 8 days).
//
// Pass 1: full git tree of main → one row per app/** + lib/** TS file
//         (path, kind, blob sha); vanished paths pruned. 1 GitHub call.
// Pass 2: contents fetched ONLY for new/changed blobs (sha diff), capped per
//         run (?max=N, default 300) so the job stays inside maxDuration;
//         extracts exports + header comment. Remainder enriches next night.
//
// Vercel cron: nightly 19:30 UTC (02:30 Asia/Vientiane) — see vercel.json.
// Middleware whitelists /api/cron/*. GET + POST for manual smoke tests.

import { NextResponse } from '@/node_modules/next/server';
import { refreshCodeIndex } from '@/lib/bugAgent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function handle(req: Request) {
  const url = new URL(req.url);
  const max = Number(url.searchParams.get('max') ?? '300');
  try {
    const result = await refreshCodeIndex({ maxContentFetches: Number.isFinite(max) ? max : 300 });
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
