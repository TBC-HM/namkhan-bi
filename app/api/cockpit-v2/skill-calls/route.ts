// app/api/cockpit-v2/skill-calls/route.ts
// Returns cap_skill_calls for a single agent role. Server-side, service-role
// scoped to cockpit schema. Used by the Team tab archive drawer.
//
// Originally named /archive — renamed 2026-05-13 because Vercel's build
// pipeline silently dropped the route folder literally named "archive"
// from the production manifest (no warning, no error). The pre-existing
// /api/cockpit/projects/[slug]/archive route had the same symptom on this
// build. Safer to use an unambiguous name.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { fetchAgentArchive } from '@/app/cockpit-v2/_lib/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const role = req.nextUrl.searchParams.get('role');
  if (!role) return NextResponse.json({ error: 'missing role' }, { status: 400 });
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || '50'), 500);
  const rows = await fetchAgentArchive(role, limit);
  return NextResponse.json({ rows });
}
