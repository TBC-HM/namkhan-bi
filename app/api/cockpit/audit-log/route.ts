// app/api/cockpit/audit-log/route.ts
// POST — generic audit-log writer for workflows + automated agents.
// GET — recent rows (last 100), filter by agent/action.
//
// Auth: Bearer COCKPIT_AGENT_TOKEN.
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
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  noStore();
  if (!ok(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const { error } = await supabase.from("cockpit_audit_log").insert({
    agent: (body?.agent ?? "unknown").toString().slice(0, 64),
    action: (body?.action ?? "unspecified").toString().slice(0, 64),
    target: (body?.target ?? null)?.toString().slice(0, 200) ?? null,
    success: body?.success !== false,
    metadata: body?.metadata ?? {},
    reasoning: (body?.reasoning ?? null)?.toString().slice(0, 4000) ?? null,
  });
  if (error) {
    return NextResponse.json(
      { error: "audit_insert_failed", detail: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  noStore();
  if (!ok(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const agent = url.searchParams.get("agent");
  const action = url.searchParams.get("action");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 100);

  let q = supabase
    .from("cockpit_audit_log")
    .select("id, created_at, agent, action, target, success, metadata, reasoning")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (agent) q = q.eq("agent", agent);
  if (action) q = q.eq("action", action);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json(
      { error: "audit_select_failed", detail: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ rows: data ?? [] });
}
