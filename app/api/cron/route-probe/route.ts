// app/api/cron/route-probe/route.ts
// TEMPORARY diagnostic (PBS 404 incident 2026-07-24). Middleware exempts
// /api/cron/*, so this answers WITHOUT auth — proving whether the production
// deployment contains routes from this commit. No data exposed, no secret
// needed for the existence check itself. Remove after the incident closes.

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    marker: 'route-probe-v1',
    commit_era: 'post-f44e809',
    now: new Date().toISOString(),
  });
}
