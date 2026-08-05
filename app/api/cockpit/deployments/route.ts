// app/api/cockpit/deployments/route.ts
// GET — list recent prod + staging deploys.
// Tries Vercel API first; falls back to cockpit_audit_log when token is
// missing/invalid. The audit log is populated by the Vercel webhook
// (deployment.created → deploy_started, deployment.succeeded → deploy_succeeded)
// so this route always returns *something* even when VERCEL_TOKEN is dead.
//
// 2026-05-08 — PBS regression fix: prod token expired → "project not found"
// was misleading. Now: surface the real Vercel error AND backfill from Supabase.
//
// 2026-07-30 (brief fix-deployments-ingestion, goal 47): the Vercel webhook now
// writes every deployment.* event into deploy.deployments (v_deployments bridge),
// so v_deployments is the FIRST fallback (full sha/branch/message/state rows);
// the lossy audit_log fallback is kept as last resort only.

// ADR-231 (finding #69, PBS 2026-08-05): this route built its OWN Supabase client at
// MODULE level with a "build-placeholder-key" fallback. Module-level evaluation captured
// the placeholder, so every query silently returned zero rows — the page read
// "No deployments found" while v_deployments held 1,017 rows, 109 in the last 24h, newest
// at the exact minute of the screenshot. No error, no log, just an empty page.
// getSupabaseAdmin() reads the SAME env vars but LAZILY inside a function, which is why
// every other surface in the app works. Never construct a Supabase client at module scope.
import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const VERCEL_TEAM = "team_vKod3ZYFgteGCHsam7IG8tEb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RawDeploy = {
  uid: string;
  state: string;
  created: number;
  meta?: { githubCommitSha?: string; githubCommitRef?: string; githubCommitMessage?: string };
  url?: string;
};

type Deploy = {
  uid: string;
  state: string;
  created_at: string;
  sha: string;
  ref: string;
  message: string;
  url: string | null;
  source: "vercel" | "v_deployments" | "audit_log";
};

async function listDeploysFromVercel(project: string, token: string, limit: number): Promise<{ deploys?: Deploy[]; error?: string }> {
  const res = await fetch(
    `https://api.vercel.com/v6/deployments?projectId=${project}&teamId=${VERCEL_TEAM}&limit=${limit}&state=READY&target=production`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!res.ok) {
    const txt = await res.text();
    return { error: `vercel api ${res.status}: ${txt.slice(0, 200)}` };
  }
  const j = await res.json();
  return {
    deploys: ((j.deployments ?? []) as RawDeploy[]).map((d): Deploy => ({
      uid: d.uid,
      state: d.state,
      created_at: new Date(d.created).toISOString(),
      sha: (d.meta?.githubCommitSha ?? "").slice(0, 7),
      ref: d.meta?.githubCommitRef ?? "?",
      message: d.meta?.githubCommitMessage ?? "",
      url: d.url ? `https://${d.url}` : null,
      source: "vercel",
    })),
  };
}

async function listDeploysFromVDeployments(slug: string, limit: number): Promise<{ deploys: Deploy[] }> {
  const supabase = getSupabaseAdmin();   // ADR-231: lazy, per-call
  const { data } = await (supabase as any)
    .from("v_deployments")
    .select("vercel_deploy_id, state, created_at, commit_sha, branch, commit_message, preview_url")
    .eq("vercel_project_name", slug)
    .order("created_at", { ascending: false })
    .limit(limit);

  return {
    deploys: (data ?? []).map((r): Deploy => ({
      uid: r.vercel_deploy_id,
      state: r.state ?? "UNKNOWN",
      created_at: r.created_at,
      sha: (r.commit_sha ?? "").slice(0, 7),
      ref: r.branch ?? "?",
      message: r.commit_message ?? "",
      url: r.preview_url ?? null,
      source: "v_deployments",
    })),
  };
}

async function listDeploysFromAuditLog(slug: string, limit: number): Promise<{ deploys: Deploy[] }> {
  const supabase = getSupabaseAdmin();   // ADR-231: lazy, per-call
  const { data } = await (supabase as any)
    .from("cockpit_audit_log")
    .select("id, created_at, action, target, success, reasoning, metadata")
    .eq("agent", "vercel")
    .in("action", ["deploy_started", "deploy_succeeded", "deploy_ready"])
    .ilike("target", `%${slug}%`)
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = data ?? [];
  return {
    deploys: rows.map((r): Deploy => {
      const meta = (r.metadata as Record<string, unknown>) ?? {};
      const url = (meta.url as string) ?? (meta.deployment_url as string) ?? (meta.target_url as string) ?? null;
      const sha = ((meta.sha as string) ?? (meta.commit_sha as string) ?? "").slice(0, 7);
      const ref = (meta.branch as string) ?? (meta.ref as string) ?? "?";
      return {
        uid: `audit-${r.id}`,
        state: r.action === "deploy_succeeded" || r.action === "deploy_ready" ? "READY" : "BUILDING",
        created_at: r.created_at,
        sha,
        ref,
        message: (r.reasoning ?? "") || (r.action ?? ""),
        url: url ? (url.startsWith("http") ? url : `https://${url}`) : null,
        source: "audit_log",
      };
    }),
  };
}

export async function GET() {
  noStore();
  const slugs = ["namkhan-bi", "namkhan-bi-staging"];
  const result: Record<string, unknown> = {};
  const token = process.env.VERCEL_TOKEN;

  for (const slug of slugs) {
    let viaVercel: { deploys?: Deploy[]; error?: string } | null = null;

    if (token) {
      const projRes = await fetch(`https://api.vercel.com/v9/projects/${slug}?teamId=${VERCEL_TEAM}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (projRes.ok) {
        const proj = await projRes.json();
        if (proj?.id) viaVercel = await listDeploysFromVercel(proj.id, token, 20);
      } else {
        const txt = await projRes.text();
        viaVercel = { error: `vercel project lookup ${projRes.status}: ${txt.slice(0, 120)}` };
      }
    }

    if (viaVercel && viaVercel.deploys && viaVercel.deploys.length > 0) {
      result[slug] = { deploys: viaVercel.deploys, source: "vercel" };
    } else {
      const vercelNote = viaVercel?.error ?? (token ? "no rows from vercel" : "VERCEL_TOKEN missing — using DB fallback");
      const vd = await listDeploysFromVDeployments(slug, 20);
      if (vd.deploys.length > 0) {
        result[slug] = { deploys: vd.deploys, source: "v_deployments", vercel_note: vercelNote };
      } else {
        const fb = await listDeploysFromAuditLog(slug, 20);
        result[slug] = {
          deploys: fb.deploys,
          source: "audit_log",
          vercel_note: vercelNote,
        };
      }
    }
  }

  return NextResponse.json({ ...result, fetched_at: new Date().toISOString() });
}
