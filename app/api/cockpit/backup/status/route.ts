// app/api/cockpit/backup/status/route.ts
// GET — returns last successful backup timestamp.
// Used by promote-staging-to-prod.yml workflow to gate promotion.
//
// Auth: Bearer COCKPIT_AGENT_TOKEN (workflow sends it).
//
// Response:
//   200 { last_success_at: ISO8601 | null, age_hours: number | null }
//   401 Unauthorized
//
// Author: PBS via Claude (Cowork) · 2026-05-06.

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

function ok(req: Request) {
  const token = process.env.COCKPIT_AGENT_TOKEN;
  if (!token) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${token}`;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

export async function GET(req: Request) {
  noStore();
  if (!ok(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .schema("documentation" as never)
    .from("backup_log")
    .select("completed_at")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "backup_status_lookup_failed", detail: error.message },
      { status: 500 }
    );
  }

  const lastSuccessAt = data?.completed_at ?? null;
  const ageHours = lastSuccessAt
    ? (Date.now() - new Date(lastSuccessAt).getTime()) / 3_600_000
    : null;

  return NextResponse.json({
    last_success_at: lastSuccessAt,
    age_hours: ageHours,
  });
}
