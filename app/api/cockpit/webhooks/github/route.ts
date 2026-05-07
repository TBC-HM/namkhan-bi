// app/api/cockpit/webhooks/github/route.ts
// POST — receive GitHub webhooks (push, pull_request, workflow_run,
// code_scanning_alert, dependabot_alert). Verify HMAC-SHA256 sig with
// GITHUB_WEBHOOK_SECRET. Log to cockpit_audit_log. Open incident on
// critical CodeQL or failed workflow runs against main.
//
// Author: PBS via Claude (Cowork) · 2026-05-06.

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function verifySig(body: string, header: string | null): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
  if (header.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

export async function POST(req: Request) {
  noStore();
  const body = await req.text();
  if (!verifySig(body, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  const event = req.headers.get("x-github-event") ?? "unknown";
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(body); } catch { /* keep empty */ }

  await supabase.from("cockpit_audit_log").insert({
    agent: "github-webhook",
    action: `github_${event}`,
    target: (payload?.repository as { full_name?: string })?.full_name ?? "unknown",
    success: true,
    metadata: {
      event,
      action: payload?.action ?? null,
      sender: (payload?.sender as { login?: string })?.login ?? null,
      ref: payload?.ref ?? null,
      sha: (payload?.head_commit as { id?: string })?.id ?? null,
    },
    reasoning: `GitHub ${event} from ${(payload?.sender as { login?: string })?.login ?? "unknown"}`,
  });

  // Critical alerts → open incident
  const isCritical =
    (event === "code_scanning_alert" && (payload?.alert as { rule?: { severity?: string } })?.rule?.severity === "critical") ||
    (event === "dependabot_alert" && (payload?.alert as { security_advisory?: { severity?: string } })?.security_advisory?.severity === "critical") ||
    (event === "workflow_run" && (payload?.workflow_run as { conclusion?: string; head_branch?: string })?.conclusion === "failure" &&
      (payload?.workflow_run as { head_branch?: string })?.head_branch === "main");

  if (isCritical) {
    await supabase.from("cockpit_incidents").insert({
      severity: "high",
      source: "github-webhook",
      summary: `GitHub ${event} CRITICAL — ${(payload?.repository as { full_name?: string })?.full_name ?? ""}`,
      details: payload,
      status: "open",
    });
  }

  return NextResponse.json({ ok: true });
}
