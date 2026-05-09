// app/api/cockpit/docs/rollback/route.ts
// POST /api/cockpit/docs/rollback
// Body: { doc_type, to_version, reason }
// PBS-only via cockpit (NOT exposed as agent skill).

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key"
);

export async function POST(req: Request) {
  noStore();
  const body = await req.json().catch(() => ({}));
  const { doc_type, to_version, reason } = body as { doc_type?: string; to_version?: number; reason?: string };
  if (!doc_type) return NextResponse.json({ error: "doc_type required" }, { status: 400 });
  if (typeof to_version !== "number") return NextResponse.json({ error: "to_version required" }, { status: 400 });
  if (!reason || reason.trim().length < 5) {
    return NextResponse.json({ error: "reason required (min 5 chars)" }, { status: 400 });
  }

  // 1. Take a pre-rollback safety backup (mandatory per spec).
  const { data: backupRow } = await supabase
    .schema("documentation" as never)
    .from("backup_log")
    .insert({ backup_type: "manual", triggered_by: "PBS:pre-rollback", status: "started" })
    .select()
    .single();

  // 2. Execute rollback via the SECURITY DEFINER function.
  const { data, error } = await supabase.schema("documentation" as never).rpc("rollback_doc", {
    p_doc_type: doc_type,
    p_to_version: to_version,
    p_actor: "PBS",
    p_reason: reason,
  });

  // 3. Mark backup completed (or failed).
  if (backupRow) {
    await supabase.schema("documentation" as never).from("backup_log").update({
      status: error ? "failed" : "completed",
      completed_at: new Date().toISOString(),
      backup_location: "pre-rollback",
      error_message: error?.message ?? null,
    }).eq("id", (backupRow as { id: string }).id);
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ...(data as Record<string, unknown>) });
}
