// app/api/cockpit/deployments/approve/route.ts
// PBS clicks "Approve" on a staging deployment in the ND dropdown.
// We submit an APPROVE review on the PR + enable auto-merge so it lands on
// main as soon as CI finishes (or immediately if already green).

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
// 2026-05-08 — bumped from default to 60s. PR approve does (1) GH review,
// (2) GH PR fetch, (3) GraphQL auto-merge enable. Sequential GH calls
// regularly take 5–15s wall clock; the default cap was OK but with
// upstream slowdowns it occasionally 504-ed.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REPO = "TBC-HM/namkhan-bi";

// 2026-05-08 — frontend feed ids are prefixed strings ("n-123" / "t-456").
// Older callers also sent them as `body.id`. Parse defensively so a
// notification gets marked seen regardless of which field carries it.
function parseFeedId(raw: unknown): { source: "notification" | "ticket" | null; num: number | null } {
  if (raw == null) return { source: null, num: null };
  const s = String(raw);
  const m = s.match(/^([nt])-(\d+)$/);
  if (m) return { source: m[1] === "n" ? "notification" : "ticket", num: Number(m[2]) };
  // Bare number: caller sent it via `id` without a prefix. Treat as notification id.
  if (/^\d+$/.test(s)) return { source: "notification", num: Number(s) };
  return { source: null, num: null };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const prNumber = Number(body.pr_number);
  const notificationIdRaw = body.notification_id;
  const ticketIdRaw = body.ticket_id;
  const idFallback = parseFeedId(body.id);
  const notificationId = Number.isFinite(Number(notificationIdRaw))
    ? Number(notificationIdRaw)
    : (idFallback.source === "notification" ? idFallback.num : null);
  const ticketId = Number.isFinite(Number(ticketIdRaw))
    ? Number(ticketIdRaw)
    : (idFallback.source === "ticket" ? idFallback.num : null);

  // Always try to mark the notification seen FIRST. The previous code only
  // did this in the no-PR branch, so PR-bearing approvals fell through and
  // the row reappeared on the next 30s feed refresh.
  if (notificationId != null) {
    await supabase
      .from("cockpit_pbs_notifications")
      .update({ seen_at: new Date().toISOString(), seen_by: "PBS" })
      .eq("id", notificationId);
  }

  // Mark-seen-only mode: no PR to approve, just an ack.
  if (!Number.isFinite(prNumber)) {
    if (notificationId == null && ticketId == null) {
      return NextResponse.json({ ok: false, error: "notification_id, ticket_id, or pr_number required" }, { status: 400 });
    }
    await supabase.from("cockpit_audit_log").insert({
      agent: "pbs",
      action: "notification_acked",
      target: notificationId != null ? `notification:${notificationId}` : `ticket:${ticketId}`,
      success: true,
      reasoning: "PBS marked row as seen via ND dropdown.",
    });
    return NextResponse.json({
      ok: true,
      mode: "mark_seen",
      notification_id: notificationId,
      ticket_id: ticketId,
    });
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

  // Notification was marked seen at the top of the handler (regardless of
  // pr_number). For approvals that came in only with a pr_number — e.g.
  // legacy callers — also mark the matching unseen row by pr_number.
  if (notificationId == null) {
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
