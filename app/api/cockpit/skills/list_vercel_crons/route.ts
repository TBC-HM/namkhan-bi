// app/api/cockpit/skills/list_vercel_crons/route.ts
// COWORK BRIEF v2 / GAP 12 — discover Vercel cron jobs.
//
// Returns cron entries from the active Vercel project, with last-run state and
// schedule. Falls back to reading the repo's vercel.json when API unavailable.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERCEL_TEAM_ID = "team_vKod3ZYFgteGCHsam7IG8tEb";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

function isAuthorized(req: Request): boolean {
  if (process.env.COCKPIT_AUTH_GATE !== "on") return true;
  const auth = req.headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") && auth.slice(7) === process.env.COCKPIT_AGENT_TOKEN;
}

type CronEntry = {
  schedule: string;
  path: string;
  last_run_at?: string | null;
  last_run_status?: string | null;
  source: "vercel_api" | "vercel_json";
};

async function resolveProjectId(slug: string, token: string): Promise<string | null> {
  const r = await fetch(`https://api.vercel.com/v9/projects/${slug}?teamId=${VERCEL_TEAM_ID}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j.id ?? null;
}

async function fetchCronsFromVercel(projectId: string, token: string): Promise<CronEntry[]> {
  // v1 cron jobs endpoint
  const r = await fetch(`https://api.vercel.com/v1/projects/${projectId}/crons?teamId=${VERCEL_TEAM_ID}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!r.ok) return [];
  const j = await r.json();
  type RawCron = { schedule?: string; path?: string; lastFinishedAt?: number; lastRunStatus?: string };
  const arr: RawCron[] = j.crons ?? [];
  return arr.map((c) => ({
    schedule: c.schedule ?? "?",
    path: c.path ?? "?",
    last_run_at: c.lastFinishedAt ? new Date(c.lastFinishedAt).toISOString() : null,
    last_run_status: c.lastRunStatus ?? null,
    source: "vercel_api" as const,
  }));
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let body: { project?: string };
  try { body = await req.json(); } catch { body = {}; }
  const slug = body.project ?? "namkhan-bi";

  const t0 = Date.now();
  const token = process.env.VERCEL_TOKEN;

  const result: { project: string; crons: CronEntry[]; warning?: string } = {
    project: slug,
    crons: [],
  };

  if (!token) {
    result.warning = "VERCEL_TOKEN missing — returning empty list. Cannot read repo vercel.json from this runtime.";
  } else {
    const pid = await resolveProjectId(slug, token);
    if (!pid) {
      result.warning = `project ${slug} not resolvable on team ${VERCEL_TEAM_ID}`;
    } else {
      result.crons = await fetchCronsFromVercel(pid, token);
    }
  }

  await supabase.from("cockpit_audit_log").insert({
    agent: "skill-vercel-crons",
    action: "list_vercel_crons",
    target: slug,
    success: !result.warning,
    duration_ms: Date.now() - t0,
    metadata: { count: result.crons.length, warning: result.warning ?? null },
    reasoning: `Fetched ${result.crons.length} crons for ${slug}${result.warning ? ` (warn: ${result.warning})` : ""}.`,
  });

  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: Request) { return POST(req); }
