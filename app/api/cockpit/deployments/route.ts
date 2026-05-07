// app/api/cockpit/deployments/route.ts
// GET — list recent Vercel deploys for prod + staging projects.
// Lets the cockpit Deployments view show ground truth on what is shipped.
//
// Author: PBS via Claude (Cowork) · 2026-05-07.

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";

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

async function listDeploys(project: string, token: string, limit: number) {
  const res = await fetch(`https://api.vercel.com/v6/deployments?projectId=${project}&teamId=${VERCEL_TEAM}&limit=${limit}&state=READY&target=production`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return { error: `vercel api ${res.status}: ${await res.text().then(t => t.slice(0,200))}` };
  const j = await res.json();
  return {
    deploys: ((j.deployments ?? []) as RawDeploy[]).map((d) => ({
      uid: d.uid,
      state: d.state,
      created_at: new Date(d.created).toISOString(),
      sha: (d.meta?.githubCommitSha ?? "").slice(0, 7),
      ref: d.meta?.githubCommitRef ?? "?",
      message: d.meta?.githubCommitMessage ?? "",
      url: d.url ? `https://${d.url}` : null,
    })),
  };
}

export async function GET() {
  noStore();
  const token = process.env.VERCEL_TOKEN;
  if (!token) return NextResponse.json({ error: "VERCEL_TOKEN missing" }, { status: 500 });

  // Resolve project IDs by slug.
  const slugs = ["namkhan-bi", "namkhan-bi-staging"];
  const projectIds: Record<string, string> = {};
  for (const slug of slugs) {
    const res = await fetch(`https://api.vercel.com/v9/projects/${slug}?teamId=${VERCEL_TEAM}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.ok) {
      const j = await res.json();
      projectIds[slug] = j.id;
    }
  }

  const result: Record<string, unknown> = {};
  for (const slug of slugs) {
    const pid = projectIds[slug];
    if (!pid) { result[slug] = { error: "project not found" }; continue; }
    result[slug] = await listDeploys(pid, token, 20);
  }
  return NextResponse.json({ ...result, fetched_at: new Date().toISOString() });
}
