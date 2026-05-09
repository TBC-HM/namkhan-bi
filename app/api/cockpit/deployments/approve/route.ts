// app/api/cockpit/deployments/approve/route.ts
// PBS clicks "Approve" on a staging deployment in the ND dropdown.
// We submit an APPROVE review on the PR + enable auto-merge so it lands on
// main as soon as CI finishes (or immediately if already green).

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key"
);

const REPO = "TBC-HM/namkhan-bi";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const prNumber = Number(body.pr_number);
  const notificationId = Number(body.notification_id);

  // Mark-seen mode: no PR number, just an ack on a live/failed row.
  if (!Number.isFinite(prNumber) && Number.isFinite(notificationId)) {
    const { error } = await supabase
      .from("cockpit_pbs_notifications")
      .update({ seen_at: new Date().toISOString(), seen_by: "PBS" })
      .eq("id", notificationId);
    await supabase.from("cockpit_audit_log").insert({
      agent: "pbs",
      action: "notification_acked",
      target: `notification:${notificationId}`,
      success: !error,
      reasoning: "PBS marked notification as seen via ND dropdown.",
    });
    return NextResponse.json({ ok: !error, mode: "mark_seen", notification_id: notificationId });
  }

  if (!Number.isFinite(prNumber)) {
    return NextResponse.json({ ok: false, error: "pr_number or notification_id required" }, { status: 400 });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) return NextResponse.json({ ok: false, error: "GITHUB_TOKEN missing" }, { status: 500 });

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };

  // Submit approving review.
  const reviewRes = await fetch(`https://api.github.com/repos/${REPO}/pulls/${prNumber}/reviews`, {
    method: "POST",
    headers,
    body: JSON.stringify({ event: "APPROVE", body: "Approved by PBS via ND dropdown." }),
  });
  const reviewOk = reviewRes.ok;

  // Get node_id to enable auto-merge in case it isn't already.
  const prRes = await fetch(`https://api.github.com/repos/${REPO}/pulls/${prNumber}`, { headers });
  let autoMergeOk = false;
  if (prRes.ok) {
    const pr = await prRes.json();
    const nodeId = pr.node_id;
    if (nodeId) {
      const gq = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `mutation Auto($id: ID!) {
            enablePullRequestAutoMerge(input: { pullRequestId: $id, mergeMethod: SQUASH }) {
              pullRequest { number autoMergeRequest { enabledAt } }
            }
          }`,
          variables: { id: nodeId },
        }),
      });
      if (gq.ok) {
        const j = await gq.json();
        if (j?.data?.enablePullRequestAutoMerge?.pullRequest?.autoMergeRequest?.enabledAt) {
          autoMergeOk = true;
        }
      }
    }
  }

  // Mark the source notification as seen so it disappears from the feed
  if (Number.isFinite(notificationId)) {
    await supabase
      .from("cockpit_pbs_notifications")
      .update({ seen_at: new Date().toISOString(), seen_by: "PBS" })
      .eq("id", notificationId);
  } else {
    // Try to mark by pr_number as fallback
    await supabase
      .from("cockpit_pbs_notifications")
      .update({ seen_at: new Date().toISOString(), seen_by: "PBS" })
      .eq("pr_number", prNumber)
      .is("seen_at", null);
  }

  await supabase.from("cockpit_audit_log").insert({
    agent: "pbs",
    action: "pr_approved",
    target: `${REPO}#${prNumber}`,
    success: reviewOk,
    metadata: { pr_number: prNumber, review_ok: reviewOk, auto_merge_ok: autoMergeOk },
    reasoning: "PBS approved staging deployment via ND dropdown.",
  });

  return NextResponse.json({
    ok: reviewOk,
    pr_number: prNumber,
    review_submitted: reviewOk,
    auto_merge_enabled: autoMergeOk,
  });
}
