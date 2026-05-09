// app/api/cockpit/skills/run_typecheck/route.ts
// COWORK BRIEF v2 / GAP 8 — typecheck verification.
//
// Pragmatic MVP: reads the LATEST Vercel deployment for the named project and
// reports its build state + parsed tsc errors from the build logs. Carla calls
// this AFTER github_commit_file (which triggers an auto-deploy) to confirm the
// commit didn't break the build before reporting "deployed".
//
// A pre-commit (don't-commit-if-broken) typecheck would require either:
//   (a) running tsc inline against a fetched repo snapshot — heavy, slow, fails on Edge
//   (b) a CI gate (GitHub Actions) — separate work
// Both are deferred. This skill catches the most common "agent says deployed,
// build actually errored" failure mode.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERCEL_TEAM_ID = "team_vKod3ZYFgteGCHsam7IG8tEb";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key"
);

function isAuthorized(req: Request): boolean {
  if (process.env.COCKPIT_AUTH_GATE !== "on") return true;
  const auth = req.headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") && auth.slice(7) === process.env.COCKPIT_AGENT_TOKEN;
}

async function resolveProjectId(slug: string, token: string): Promise<string | null> {
  const r = await fetch(`https://api.vercel.com/v9/projects/${slug}?teamId=${VERCEL_TEAM_ID}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j.id ?? null;
}

async function getLatestDeploy(projectId: string, token: string): Promise<{ uid: string; state: string; created: number; sha?: string } | null> {
  const r = await fetch(`https://api.vercel.com/v6/deployments?projectId=${projectId}&teamId=${VERCEL_TEAM_ID}&limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!r.ok) return null;
  const j = await r.json();
  const d = (j.deployments ?? [])[0];
  if (!d) return null;
  return { uid: d.uid, state: d.state, created: d.created, sha: d.meta?.githubCommitSha };
}

async function getBuildLogs(deployId: string, token: string): Promise<string> {
  const r = await fetch(`https://api.vercel.com/v3/deployments/${deployId}/events?teamId=${VERCEL_TEAM_ID}&direction=forward&limit=500&builds=1`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!r.ok) return "";
  const j = await r.json();
  type Ev = { text?: string; payload?: { text?: string } };
  return ((j as Ev[]) ?? []).map((ev) => ev.text ?? ev.payload?.text ?? "").filter(Boolean).join("\n");
}

function parseTsErrors(log: string): { file: string; line: number; col?: number; message: string }[] {
  // Matches "Type error: " (Next) and bare tsc "(NN,NN): error TSxxx:"
  const errors: { file: string; line: number; col?: number; message: string }[] = [];
  const nextRe = /([./\w-]+\.tsx?):(\d+):(\d+)\s*\n\s*Type error:\s*(.+?)(?:\n|$)/g;
  const tscRe = /([./\w-]+\.tsx?)\((\d+),(\d+)\):\s*error\s*TS\d+:\s*(.+?)(?:\n|$)/g;
  let m: RegExpExecArray | null;
  while ((m = nextRe.exec(log))) errors.push({ file: m[1], line: +m[2], col: +m[3], message: m[4].trim() });
  while ((m = tscRe.exec(log))) errors.push({ file: m[1], line: +m[2], col: +m[3], message: m[4].trim() });
  // de-dupe
  const seen = new Set<string>();
  return errors.filter((e) => {
    const k = `${e.file}:${e.line}:${e.message}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let body: { project?: string };
  try { body = await req.json(); } catch { body = {}; }
  const slug = body.project ?? "namkhan-bi-staging";

  const token = process.env.VERCEL_TOKEN;
  if (!token) return NextResponse.json({ ok: false, error: "VERCEL_TOKEN env var missing" }, { status: 500 });

  const t0 = Date.now();
  const pid = await resolveProjectId(slug, token);
  if (!pid) return NextResponse.json({ ok: false, error: `project ${slug} not found` }, { status: 404 });

  const deploy = await getLatestDeploy(pid, token);
  if (!deploy) return NextResponse.json({ ok: false, error: "no deployments found" }, { status: 404 });

  let errors: { file: string; line: number; col?: number; message: string }[] = [];
  if (deploy.state === "ERROR") {
    const log = await getBuildLogs(deploy.uid, token);
    errors = parseTsErrors(log);
  }

  const ok = deploy.state === "READY";
  const result = {
    ok,
    project: slug,
    deployment_id: deploy.uid,
    deployment_state: deploy.state,
    sha: deploy.sha?.slice(0, 7) ?? null,
    errors,
    note: ok
      ? "Latest deploy is READY — build passed type-check."
      : deploy.state === "BUILDING"
        ? "Latest deploy still BUILDING — call again in 30-60s."
        : `Latest deploy state ${deploy.state}. ${errors.length} type error(s) parsed from build log.`,
  };

  await supabase.from("cockpit_audit_log").insert({
    agent: "skill-typecheck",
    action: "run_typecheck",
    target: slug,
    success: ok,
    duration_ms: Date.now() - t0,
    metadata: {
      deployment_id: deploy.uid,
      deployment_state: deploy.state,
      sha: deploy.sha?.slice(0, 7) ?? null,
      error_count: errors.length,
    },
    reasoning: result.note,
  });

  return NextResponse.json({ ok: true, result });
}
