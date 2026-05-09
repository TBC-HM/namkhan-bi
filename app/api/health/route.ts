// app/api/health/route.ts
// v3 brief C2 — external monitor target. Returns ok + DB reachability + last cron run.
// Designed to be hit by Better Stack / Healthchecks.io every minute.

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

export async function GET() {
  noStore();
  const t0 = Date.now();
  const checks: Record<string, unknown> = {
    ok: true,
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
    region: process.env.VERCEL_REGION ?? "local",
  };

  // DB reachability
  try {
    const { error } = await supabase.from("cockpit_audit_log").select("id").limit(1);
    checks.db_reachable = !error;
    if (error) { checks.ok = false; checks.db_error = error.message; }
  } catch (e) {
    checks.ok = false;
    checks.db_reachable = false;
    checks.db_error = e instanceof Error ? e.message : "unknown";
  }

  // Last audit log row — if cron is dead this gets stale fast
  try {
    const { data } = await supabase
      .from("cockpit_audit_log")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1);
    const last = data?.[0]?.created_at;
    if (last) {
      const ageMin = (Date.now() - new Date(last).getTime()) / 60000;
      checks.last_audit_log_age_min = Math.round(ageMin * 10) / 10;
      checks.last_audit_log_at = last;
      // 60 minutes without any audit row = something's stuck — still 200 but ok=false
      if (ageMin > 60) { checks.ok = false; checks.warning = "no audit_log activity for >60 min"; }
    } else {
      checks.last_audit_log_age_min = null;
    }
  } catch {
    checks.last_audit_log_age_min = "error";
  }

  checks.duration_ms = Date.now() - t0;
  return NextResponse.json(checks, { status: checks.ok ? 200 : 503 });
}
