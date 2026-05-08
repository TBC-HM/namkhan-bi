// app/api/cockpit/deployments/route.ts
// GET — list recent prod + staging deploys.
// Tries Vercel API first; falls back to cockpit_audit_log when token is
// missing/invalid. The audit log is populated by the Vercel webhook
// (deployment.created → deploy_started, deployment.succeeded → deploy_succeeded)
// so this route always returns *something* even when VERCEL_TOKEN is dead.
//
// 2026-05-08 — PBS regression fix: prod token expired → "project not found"
// was misleading. Now: surface the real Vercel error AND backfill from Supabase.

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";

const VERCEL_TEAM = "team_vKod3ZYFgteGCHsam7IG8tEb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

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
  source: "vercel" | "audit_log";
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

async function listDeploysFromAuditLog(slug: string, limit: number): Promise<{ deploys: Deploy[] }> {
  // The Vercel webhook stores 2 row shapes:
  //   1. action='deploy_succeeded', target=<deployment URL>, metadata={name, deployment}
  //   2. action='unknown_event', target='deployment.created', metadata.payload={name, deployment{meta:{...}}}
  // Both have the slug at metadata->>'name' OR metadata->'payload'->>'name', so query both.
  // Slug-keying via target string fails because target is the deploy URL alias,
  // not the slug. Query everything vercel-tagged and post-filter by slug in JS.
  const { data } = await supabase
    .from("cockpit_audit_log")
    .select("id, created_at, action, target, success, reasoning, metadata")
    .eq("agent", "vercel")
    .order("created_at", { ascending: false })
    .limit(Math.max(limit * 4, 80));

  const rows = (data ?? []).filter((r) => {
    const m = (r.metadata as Record<string, unknown>) ?? {};
    const direct = m.name as string | undefined;
    const payload = (m.payload as Record<string, unknown> | undefined);
    const fromPayload = payload?.name as string | undefined;
    return direct === slug || fromPayload === slug;
  }).slice(0, limit);

  return {
    deploys: rows.map((r): Deploy => {
      const meta = (r.metadata as Record<string, unknown>) ?? {};
      const payload = (meta.payload as Record<string, unknown> | undefined) ?? {};
      const deployment = (payload.deployment as Record<string, unknown> | undefined) ?? {};
      const dpMeta = (deployment.meta as Record<string, unknown> | undefined) ?? {};

      const url = (meta.url as string)
        ?? (meta.deployment_url as string)
        ?? (payload.url as string)
        ?? (deployment.url as string)
        ?? r.target
        ?? null;
      const sha = ((dpMeta.githubCommitSha as string) ?? (meta.sha as string) ?? "").slice(0, 7);
      const ref = (dpMeta.githubCommitRef as string) ?? (payload.target as string) ?? "?";
      const msg = (dpMeta.githubCommitMessage as string)?.split("\n")[0]
        ?? (r.reasoning as string)
        ?? (r.action ?? "");

      const action = r.action ?? "";
      const isReady = action === "deploy_succeeded" || action === "deploy_ready";

      return {
        uid: `audit-${r.id}`,
        state: isReady ? "READY" : "BUILDING",
        created_at: r.created_at,
        sha,
        ref,
        message: msg,
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
      const fb = await listDeploysFromAuditLog(slug, 20);
      result[slug] = {
        deploys: fb.deploys,
        source: "audit_log",
        vercel_note: viaVercel?.error ?? (token ? "no rows from vercel" : "VERCEL_TOKEN missing — using audit_log fallback"),
      };
    }
  }

  return NextResponse.json({ ...result, fetched_at: new Date().toISOString() });
}
