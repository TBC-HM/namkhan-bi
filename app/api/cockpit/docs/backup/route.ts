// app/api/cockpit/docs/backup/route.ts
// GET — list recent backups + status panel data
// POST — manual "Backup Now" trigger

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

export async function GET() {
  noStore();
  const { data: rows } = await supabase
    .schema("documentation" as never)
    .from("backup_log")
    .select("id, backup_type, triggered_by, deployment_id, status, backup_location, size_bytes, started_at, completed_at, error_message")
    .order("started_at", { ascending: false })
    .limit(30);

  const list = rows ?? [];
  const lastSuccess = list.find((r: { status: string }) => r.status === "completed");
  const lastFail = list.find((r: { status: string }) => r.status === "failed");
  return NextResponse.json({
    last_success: lastSuccess ?? null,
    last_failure: lastFail ?? null,
    recent: list,
  });
}

export async function POST(req: Request) {
  noStore();
  const body = await req.json().catch(() => ({}));
  const backupType = (body.backup_type as string) ?? "manual";
  const deploymentId = body.deployment_id ?? null;

  const { data: started, error: e1 } = await supabase
    .schema("documentation" as never)
    .from("backup_log")
    .insert({ backup_type: backupType, triggered_by: "cockpit:manual", deployment_id: deploymentId, status: "started" })
    .select()
    .single();
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

  try {
    const [staging, production, sv, pv] = await Promise.all([
      supabase.schema("documentation_staging" as never).from("documents").select("*"),
      supabase.schema("documentation" as never).from("documents").select("*"),
      supabase.schema("documentation_staging" as never).from("document_versions").select("*"),
      supabase.schema("documentation" as never).from("document_versions").select("*"),
    ]);
    const payload = {
      staging: staging.data ?? [],
      production: production.data ?? [],
      staging_versions: sv.data ?? [],
      production_versions: pv.data ?? [],
    };
    const sizeBytes = JSON.stringify(payload).length;
    await supabase.schema("documentation" as never).from("backup_log").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      backup_location: "inline:backup_log.metadata",
      size_bytes: sizeBytes,
      metadata: payload,
    }).eq("id", (started as { id: string }).id);
    return NextResponse.json({ ok: true, backup_id: (started as { id: string }).id, size_bytes: sizeBytes });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    await supabase.schema("documentation" as never).from("backup_log").update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: msg,
    }).eq("id", (started as { id: string }).id);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
