// app/api/cockpit/deploy/rollback/route.ts
// POST — roll the production alias back to the previous known-good build.
//
// v2 (brief recovery-page-v1 §0.V work order · 2026-08-09):
//   REAL Vercel rollback. Lists READY production deployments and promotes the
//   previous one via the same v13 promote endpoint the deploy webhook's
//   auto-rollback already uses. No branch is pushed — the `production` branch
//   stays owned by the ADR-222 promoter; a rollback only re-points the
//   production alias to a build that already passed the promotion gate, so
//   every reachable rollback target is by construction a previously-promoted,
//   checks-green build. Forward promotion resumes untouched on the next
//   fn_promotion_sweep pass.
//
// Auth — two callers:
//   (a) Bearer COCKPIT_AGENT_TOKEN — legacy CI hook path (kept intact; also
//       opens a cockpit incident, as v1 did).
//   (b) Signed-in session cookie — the Recovery page's Safe-tier one-click
//       "Roll back to last good build" (guard ladder: reversible in seconds,
//       no confirm). Same session pattern as /api/cockpit/recovery/trigger.
//
// Body: { reason?: string, sha?: string }
// Every call is written to public.cockpit_audit_log. NO AI in this path
// (recovery_module §10). Zero DDL.

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const VERCEL_PROJECT_ID = "prj_be5AGzi7cB5HnkTEvOWTzUv3YCAl";
const VERCEL_TEAM_ID = "team_vKod3ZYFgteGCHsam7IG8tEb";

function bearerOk(req: Request) {
  const token = process.env.COCKPIT_AGENT_TOKEN;
  if (!token) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${token}`;
}

async function sessionEmail(): Promise<string | null> {
  const jar = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll().map((c) => ({ name: c.name, value: c.value })),
        setAll: () => { /* read-only — no session mutation from this route */ },
      },
    },
  );
  const { data: { user } } = await sb.auth.getUser();
  return user?.email ?? null;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key"
);

type VercelDeploy = { uid: string; url?: string; createdAt?: number; meta?: Record<string, string> };

export async function POST(req: Request) {
  noStore();

  const viaHook = bearerOk(req);
  const actor = viaHook ? "deploy-hook" : await sessionEmail();
  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const reason = (body?.reason ?? "no reason provided").toString().slice(0, 500);
  const sha = (body?.sha ?? "").toString().slice(0, 64);

  const vercelToken = process.env.VERCEL_TOKEN;
  if (!vercelToken) {
    await supabase.from("cockpit_audit_log").insert({
      agent: "deploy-rollback",
      action: "rollback_requested",
      target: "vercel-prod",
      success: false,
      metadata: { actor, reason, sha, error: "VERCEL_TOKEN missing" },
      reasoning: "Rollback requested but VERCEL_TOKEN is not set on the server — nothing was promoted.",
    });
    return NextResponse.json(
      { error: "Rollback credential missing on the server — promote the previous build from the Vercel dashboard" },
      { status: 503 },
    );
  }

  // 1. Last READY production deployments. deployments[0] is the build the
  //    production alias currently points at (or the newest good one); the next
  //    distinct uid is the previous known-good build — the rollback target.
  const listRes = await fetch(
    `https://api.vercel.com/v6/deployments?projectId=${VERCEL_PROJECT_ID}&teamId=${VERCEL_TEAM_ID}&target=production&state=READY&limit=5`,
    { headers: { Authorization: `Bearer ${vercelToken}` }, cache: "no-store" },
  );
  if (!listRes.ok) {
    return NextResponse.json({ error: `Vercel refused the deployment list (${listRes.status})` }, { status: 502 });
  }
  const list = await listRes.json();
  const deployments: VercelDeploy[] = list?.deployments ?? [];
  const current = deployments[0] ?? null;
  const target = deployments.find((d) => d.uid !== current?.uid) ?? null;
  if (!current || !target) {
    return NextResponse.json(
      { error: "No previous good build found to roll back to" },
      { status: 409 },
    );
  }

  // 2. Promote it (re-points the production alias; nothing is rebuilt).
  const promoteRes = await fetch(
    `https://api.vercel.com/v13/deployments/${target.uid}/promote?teamId=${VERCEL_TEAM_ID}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${vercelToken}`, "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
    },
  );
  const promoted = promoteRes.ok;
  let promoteDetail: string | null = null;
  if (!promoted) {
    const t = await promoteRes.text().catch(() => "");
    promoteDetail = `${promoteRes.status} ${t.slice(0, 300)}`;
  }

  // 3. Audit log — every call, both auth paths, success or not.
  await supabase.from("cockpit_audit_log").insert({
    agent: "deploy-rollback",
    action: promoted ? "deploy_rollback_executed" : "rollback_requested",
    target: "vercel-prod",
    success: promoted,
    metadata: {
      actor,
      source: viaHook ? "ci-hook" : "recovery-page",
      reason,
      sha: sha || null,
      from_deployment: current.uid,
      to_deployment: target.uid,
      to_commit: target.meta?.githubCommitSha ?? null,
      error: promoteDetail,
      version: "v2-promote",
    },
    reasoning: promoted
      ? `Production alias rolled back from ${current.uid} to previous good build ${target.uid} by ${actor}. Reason: ${reason}.`
      : `Rollback attempted by ${actor} but Vercel promote failed: ${promoteDetail}.`,
  });

  // 4. Legacy hook contract: smoke-test failures also open an incident.
  let incidentId: string | null = null;
  if (viaHook) {
    const { data: incident } = await supabase
      .from("cockpit_incidents")
      .insert({
        severity: "high",
        source: "deploy-rollback-hook",
        summary: `Prod deploy smoke test failed — rollback ${promoted ? "executed" : "FAILED"} for ${sha.slice(0, 7) || "unknown"}`,
        details: { reason, sha, promoted, to_deployment: target.uid, error: promoteDetail },
        status: "open",
      })
      .select("id")
      .single();
    incidentId = incident?.id ?? null;
  }

  if (!promoted) {
    return NextResponse.json(
      { error: `Vercel refused the promotion (${promoteDetail}) — nothing changed`, incident_id: incidentId },
      { status: 502 },
    );
  }
  return NextResponse.json({
    ok: true,
    promoted: target.uid,
    note: "Previous good build is back on the production URL. The next forward promotion resumes automatically once a fixed commit passes the gate.",
    incident_id: incidentId,
  });
}
