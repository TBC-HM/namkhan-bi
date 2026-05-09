// app/api/cockpit/deploy/rollback/route.ts
// POST — auto-rollback hook called by deploy-prod.yml on smoke-test failure.
//
// v1: logs the rollback intent + creates a cockpit_incident.
//     Actual Vercel rollback (vercel deploy promote <prev_sha>) is deferred
//     to v2 — for now PBS manually rolls back via Vercel dashboard or CLI.
//
// Auth: Bearer COCKPIT_AGENT_TOKEN.
//
// Body: { reason: string, sha: string }
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
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key"
);

export async function POST(req: Request) {
  noStore();
  if (!ok(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const reason = (body?.reason ?? "no reason provided").toString().slice(0, 500);
  const sha = (body?.sha ?? "unknown").toString().slice(0, 64);

  // 1. Log to audit log
  await supabase.from("cockpit_audit_log").insert({
    agent: "deploy-rollback-hook",
    action: "rollback_requested",
    target: "vercel-prod",
    success: true,
    metadata: { reason, sha, version: "v1-stub" },
    reasoning: `Auto-rollback hook fired by deploy-prod.yml. Reason: ${reason}. SHA: ${sha}.`,
  });

  // 2. Open a cockpit incident
  const { data: incident } = await supabase
    .from("cockpit_incidents")
    .insert({
      severity: "high",
      source: "deploy-rollback-hook",
      summary: `Prod deploy smoke test failed — rollback requested for ${sha.slice(0, 7)}`,
      details: { reason, sha },
      status: "open",
    })
    .select("id")
    .single();

  return NextResponse.json({
    ok: true,
    incident_id: incident?.id ?? null,
    note: "v1 stub — logs intent + opens incident. Actual Vercel rollback is manual until v2.",
  });
}
