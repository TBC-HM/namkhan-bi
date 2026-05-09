// app/api/cockpit/deployments/dismiss-all/route.ts
// Bulk-mark every unseen ND notification as seen.
// 2026-05-08 PBS directive: "all those old deploys, where to dismiss".

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

export async function POST() {
  const { data, error } = await supabase
    .from("cockpit_pbs_notifications")
    .update({ seen_at: new Date().toISOString(), seen_by: "PBS" })
    .is("seen_at", null)
    .select("id");

  await supabase.from("cockpit_audit_log").insert({
    agent: "pbs",
    action: "notifications_dismiss_all",
    target: "cockpit_pbs_notifications",
    success: !error,
    metadata: { dismissed_count: data?.length ?? 0 },
    reasoning: `PBS dismissed all ${data?.length ?? 0} unseen rows from ND dropdown.`,
  });

  return NextResponse.json({
    ok: !error,
    dismissed: data?.length ?? 0,
    error: error?.message ?? null,
  });
}
