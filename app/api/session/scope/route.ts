// app/api/session/scope/route.ts
// GET — returns the current user's property + dept scope. Used by client
// components (top menu, N-dropdown, cockpit-v2 property switcher) to filter UI.
// Author: IT-team agent · 2026-05-13.

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { getSessionScope } from "@/lib/session-scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export async function GET() {
  noStore();
  const scope = await getSessionScope();
  return NextResponse.json(scope, {
    headers: { "cache-control": "no-store" },
  });
}
