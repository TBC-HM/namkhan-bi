// app/api/cockpit/webhooks/post-deploy/route.ts
// POST — fires after deploy-prod.yml completes.
// Records the deploy outcome to cockpit_audit_log.
// Future: trigger Sentinel Sergei to run SHA + smoke verification.
//
// Auth: Bearer COCKPIT_AGENT_TOKEN.
//
// Body: { deploy_url, sha, actor, trigger, upstream_run, job_status }
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
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

export async function POST(req: Request) {
  noStore();
  if (!ok(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const success = body?.job_status === "success";

  await supabase.from("cockpit_audit_log").insert({
    agent: "deploy-prod-workflow",
    action: success ? "prod_deploy_succeeded" : "prod_deploy_failed",
    target: "vercel-prod",
    success,
    metadata: {
      deploy_url: body?.deploy_url ?? null,
      sha: body?.sha ?? null,
      actor: body?.actor ?? null,
      trigger: body?.trigger ?? null,
      upstream_run: body?.upstream_run ?? null,
    },
    reasoning: `Post-deploy webhook from deploy-prod.yml. status=${body?.job_status}.`,
  });

  return NextResponse.json({ ok: true, recorded: true });
}
