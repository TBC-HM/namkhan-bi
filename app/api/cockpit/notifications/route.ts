// app/api/cockpit/notifications/route.ts
// it_only_window_v2 task 4.3 — bell-icon backend.
// GET → last 20 notifications + unseen count.
// POST { id, mark } → mark a notification seen.
// Author: PBS via Claude (Cowork) · 2026-05-07.

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key"
);

export async function GET() {
  noStore();
  const [{ data: rows }, { count }] = await Promise.all([
    supabase
      .from("v_notifications_bell")
      .select("id, ticket_id, agent, kind, severity, summary, seen_at, created_at")
      .limit(20),
    supabase
      .from("v_notifications_bell")
      .select("id", { count: "exact", head: true })
      .is("seen_at", null),
  ]);
  // Highest severity wins for badge color.
  const list = rows ?? [];
  const hasCritical = list.some((r) => (r as { seen_at: string | null; severity: string }).seen_at === null && ["critical", "emergency", "warning"].includes((r as { severity: string }).severity));
  return NextResponse.json({
    rows: list,
    unseen: count ?? 0,
    badge: count && count > 0 ? (hasCritical ? "red" : "green") : "off",
  });
}

export async function POST(req: Request) {
  noStore();
  const body = await req.json().catch(() => ({}));
  const id = Number((body as { id?: number }).id);
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await supabase
    .from("cockpit_notifications")
    .update({ seen_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
