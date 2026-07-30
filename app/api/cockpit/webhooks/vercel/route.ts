// app/api/cockpit/webhooks/vercel/route.ts
// Vercel deploy webhook → auto-rollback on failure + log incident.
// Replaces Make.com scenario 01 entirely.
//
// Setup (one-time):
//   Vercel Dashboard → namkhan-bi project → Settings → Git → Deploy Hooks
//   Add Hook: paste this URL:
//     https://namkhan-bi.vercel.app/api/cockpit/webhooks/vercel?secret=<COCKPIT_WEBHOOK_SECRET>
//   Subscribe to events: deployment.error, deployment.canceled, deployment.succeeded
//
// Behaviour:
//   deployment.error      → fetch last 2 prod deploys → promote previous (rollback) → log severity-1 incident
//   deployment.canceled   → log severity-3 incident
//   deployment.succeeded  → log audit row only
//
// 2026-07-30 (brief fix-deployments-ingestion, goal 47): every deployment.*
// event now ALSO upserts deploy.deployments (through the public.v_deployments
// bridge view) so the cockpit deploy surfaces read live truth instead of the
// 2026-05-17 one-time seed. Incident/rollback/audit behaviour unchanged.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key"
);

const VERCEL_PROJECT_ID = "prj_be5AGzi7cB5HnkTEvOWTzUv3YCAl";
const VERCEL_TEAM_ID = "team_vKod3ZYFgteGCHsam7IG8tEb";

// Accept either:
//  (a) Vercel account-level webhook with HMAC-SHA1 signature in x-vercel-signature
//      verified against VERCEL_WEBHOOK_SECRET (Vercel-generated).
//  (b) Legacy Deploy Hook with ?secret=/x-cockpit-secret query param matched to
//      COCKPIT_WEBHOOK_SECRET.
function checkAuth(req: Request, rawBody: string): boolean {
  const sig = req.headers.get("x-vercel-signature");
  const vwSecret = process.env.VERCEL_WEBHOOK_SECRET;
  if (sig && vwSecret) {
    const expected = crypto.createHmac("sha1", vwSecret).update(rawBody).digest("hex");
    if (sig.length === expected.length) {
      try {
        if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return true;
      } catch { /* fall through */ }
    }
  }
  const cwSecret = process.env.COCKPIT_WEBHOOK_SECRET;
  if (cwSecret) {
    const url = new URL(req.url);
    if (url.searchParams.get("secret") === cwSecret) return true;
    if (req.headers.get("x-cockpit-secret") === cwSecret) return true;
  }
  return false;
}

// Map a deployment.* webhook event onto a deploy.deployments row and write it
// through the public.v_deployments bridge view (plain single-table view,
// insertable/updatable; service_role has INSERT/UPDATE). Select-then-write is
// used instead of PostgREST upsert because on_conflict is unreliable on views.
// Never throws — a failed record must not break the incident/rollback path.
async function recordDeployment(
  eventType: string,
  payload: Record<string, unknown>,
): Promise<{ recorded: boolean; reason?: string }> {
  try {
    const p = (payload.payload ?? {}) as Record<string, unknown>;
    const deployment = (p.deployment ?? {}) as Record<string, unknown>;
    const meta = (deployment.meta ?? {}) as Record<string, unknown>;
    const deployId = (deployment.id ?? deployment.uid ?? "") as string;
    if (!deployId) return { recorded: false, reason: "no deployment id in payload" };

    const state =
      eventType === "deployment.succeeded" ? "READY"
      : eventType === "deployment.error" ? "ERROR"
      : eventType === "deployment.canceled" ? "CANCELED"
      : eventType === "deployment.created" ? "BUILDING"
      : "UNKNOWN";

    const target = ((p.target ?? deployment.target) ?? null) as string | null;
    const project = (p.project ?? {}) as Record<string, unknown>;
    const team = (p.team ?? {}) as Record<string, unknown>;
    const rawUrl = (deployment.url ?? "") as string;
    const commitSha = (meta.githubCommitSha ?? null) as string | null;
    const nowIso = new Date().toISOString();
    const isProdReady = state === "READY" && target === "production";

    const row: Record<string, unknown> = {
      vercel_deploy_id: deployId,
      vercel_project_id: ((project.id as string) || VERCEL_PROJECT_ID),
      vercel_project_name: (((deployment.name as string) || (project.name as string)) || "namkhan-bi"),
      vercel_team_id: ((team.id as string) || VERCEL_TEAM_ID),
      commit_sha: commitSha,
      commit_message: (meta.githubCommitMessage ?? null) as string | null,
      commit_author_name: (meta.githubCommitAuthorName ?? null) as string | null,
      branch: (meta.githubCommitRef ?? null) as string | null,
      source: commitSha ? "git" : "cli",
      target,
      state,
      preview_url: rawUrl ? (rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`) : null,
      build_ready_at: state === "READY" ? nowIso : null,
      build_error_text: state === "ERROR" ? (((deployment.errorMessage ?? "") as string) || null) : null,
      deployer: ((meta.githubCommitAuthorLogin ?? meta.githubCommitAuthorName) ?? null) as string | null,
      prod_aliased: isProdReady,
      prod_aliased_at: isProdReady ? nowIso : null,
      raw_meta: payload,
      updated_at: nowIso,
    };

    const { data: existing, error: selErr } = await supabase
      .from("v_deployments")
      .select("id")
      .eq("vercel_deploy_id", deployId)
      .maybeSingle();
    if (selErr) return { recorded: false, reason: `select: ${selErr.message}` };

    if (existing?.id) {
      const { error } = await supabase.from("v_deployments").update(row).eq("vercel_deploy_id", deployId);
      if (error) return { recorded: false, reason: `update: ${error.message}` };
    } else {
      const { error } = await supabase.from("v_deployments").insert(row);
      if (error) return { recorded: false, reason: `insert: ${error.message}` };
    }
    return { recorded: true };
  } catch (e) {
    return { recorded: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

async function rollback(failedDeploymentId: string, failedDeploymentName: string, errorMessage: string) {
  const vercelToken = process.env.VERCEL_TOKEN;
  if (!vercelToken) {
    return { rolled_back: false, reason: "VERCEL_TOKEN missing" };
  }

  // List last 2 successful prod deploys.
  const listRes = await fetch(
    `https://api.vercel.com/v6/deployments?projectId=${VERCEL_PROJECT_ID}&teamId=${VERCEL_TEAM_ID}&target=production&state=READY&limit=2`,
    { headers: { Authorization: `Bearer ${vercelToken}` } },
  );
  if (!listRes.ok) {
    return { rolled_back: false, reason: `vercel list ${listRes.status}` };
  }
  const list = await listRes.json();
  const deployments = list?.deployments ?? [];
  const previous = deployments.find((d: { uid: string }) => d.uid !== failedDeploymentId);
  if (!previous) {
    return { rolled_back: false, reason: "no previous successful deploy found" };
  }

  // Promote it.
  const promoteRes = await fetch(
    `https://api.vercel.com/v13/deployments/${previous.uid}/promote?teamId=${VERCEL_TEAM_ID}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    },
  );
  if (!promoteRes.ok) {
    return { rolled_back: false, reason: `vercel promote ${promoteRes.status}` };
  }

  // Log the incident.
  await supabase.from("cockpit_incidents").insert({
    severity: 1,
    symptom: `deploy failed: ${failedDeploymentName}`,
    source: "vercel",
    auto_resolved: true,
    rollback_attempted: true,
    fix: `auto-promoted previous deployment ${previous.uid}`,
    metadata: {
      failed_deployment: failedDeploymentId,
      promoted_deployment: previous.uid,
      error: errorMessage,
    },
  });

  return { rolled_back: true, promoted: previous.uid };
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  if (!checkAuth(req, rawBody)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const eventType = (payload.type ?? "") as string;
  const deployment = (payload.payload as { deployment?: Record<string, unknown> })?.deployment ?? {};
  const deploymentId = (deployment.id ?? deployment.uid ?? "") as string;
  const deploymentName = (deployment.name ?? "") as string;
  const errorMessage = (deployment.errorMessage ?? "") as string;
  const deploymentUrl = (deployment.url ?? "") as string;

  if (eventType === "deployment.error") {
    const deployRow = await recordDeployment(eventType, payload);
    const result = await rollback(deploymentId, deploymentName, errorMessage);
    return NextResponse.json({ event: eventType, ...result, deploy_row: deployRow });
  }

  if (eventType === "deployment.canceled") {
    const deployRow = await recordDeployment(eventType, payload);
    await supabase.from("cockpit_incidents").insert({
      severity: 3,
      symptom: "deploy canceled",
      source: "vercel",
      auto_resolved: true,
      metadata: { deployment: deploymentId, name: deploymentName },
    });
    return NextResponse.json({ event: eventType, logged: true, deploy_row: deployRow });
  }

  if (eventType === "deployment.succeeded") {
    const deployRow = await recordDeployment(eventType, payload);
    await supabase.from("cockpit_audit_log").insert({
      agent: "vercel",
      action: "deploy_succeeded",
      target: deploymentUrl || deploymentId,
      success: true,
      metadata: { deployment: deploymentId, name: deploymentName, deploy_row: deployRow },
    });
    return NextResponse.json({ event: eventType, audited: true, deploy_row: deployRow });
  }

  // deployment.created — not currently in the Vercel-side subscription (only
  // succeeded/error/canceled fire today), but handle it truthfully if it ever
  // arrives: record a BUILDING row, no incident, no rollback.
  if (eventType === "deployment.created") {
    const deployRow = await recordDeployment(eventType, payload);
    return NextResponse.json({ event: eventType, deploy_row: deployRow });
  }

  // Unknown event — log to audit, do nothing else.
  await supabase.from("cockpit_audit_log").insert({
    agent: "vercel",
    action: "unknown_event",
    target: eventType,
    success: false,
    metadata: payload,
    reasoning: `unhandled event type: ${eventType}`,
  });
  return NextResponse.json({ event: eventType, ignored: true });
}

export async function GET() {
  return NextResponse.json({
    endpoint: "vercel deploy webhook",
    auth: "?secret= or X-Cockpit-Secret header",
    handles: [
      "deployment.error (auto-rollback + deploy row)",
      "deployment.canceled (incident + deploy row)",
      "deployment.succeeded (audit + deploy row)",
      "deployment.created (deploy row, BUILDING)",
    ],
  });
}
