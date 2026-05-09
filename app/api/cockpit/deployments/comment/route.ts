// app/api/cockpit/deployments/comment/route.ts
// PBS leaves a comment on a staging PR via the ND dropdown.
// 1. Posts comment to GitHub PR (visible to anyone reviewing).
// 2. Creates a follow-up cockpit ticket addressed to code_writer so the
//    comment becomes work the agent picks up next cron tick.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

const REPO = "TBC-HM/namkhan-bi";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const prNumber = Number(body.pr_number);
  const text = String(body.comment ?? "").trim();
  const liveUrl = String(body.url ?? "").trim();
  const notificationId = Number(body.notification_id);
  const titleHint = String(body.title ?? "").trim();
  if (!text) {
    return NextResponse.json({ ok: false, error: "comment required" }, { status: 400 });
  }

  const hasPr = Number.isFinite(prNumber);
  const token = process.env.GITHUB_TOKEN;

  let ghOk = false;
  let ghPayload: Record<string, unknown> | null = null;

  // 1. If a PR is attached, post the comment on the PR.
  if (hasPr && token) {
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    };
    const ghRes = await fetch(`https://api.github.com/repos/${REPO}/issues/${prNumber}/comments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ body: `**PBS via ND dropdown:** ${text}` }),
    });
    ghOk = ghRes.ok;
    ghPayload = ghOk ? await ghRes.json() : null;
  }

  // 2. Always create a follow-up cockpit ticket so the agent acts on it.
  //    Two flavors: PR-attached comment (push to same branch) vs free-form
  //    feedback on a live page (open new PR for the fix).
  const { data: ticketRow } = await supabase
    .from("cockpit_tickets")
    .insert({
      source: hasPr ? "pbs-pr-comment" : "pbs-live-feedback",
      arm: "dev",
      intent: "fix",
      status: "triaged",
      parsed_summary: hasPr
        ? `**PBS comment on PR #${prNumber}**\n\n${text}\n\nPush the change to the SAME branch (do NOT open a new PR — the existing one will re-run CI and auto-merge if green).`
        : `**PBS feedback on live page** ${liveUrl ? `\`${liveUrl}\`` : ""}\n\n${text}\n\nFix the live page. Open a NEW PR with the change.${titleHint ? `\n\nContext: ${titleHint}` : ""}`,
      notes: JSON.stringify({
        arm: "dev",
        intent: "fix",
        urgency: "high",
        summary: hasPr ? `PBS comment on PR #${prNumber}` : `PBS feedback on ${liveUrl || "live page"}`,
        plan: hasPr ? [
          `read PR #${prNumber} (gh pr view) for current diff`,
          "compose the requested change",
          `github_commit_file branch=<existing branch> — same branch, NOT a new one`,
          "PR auto-re-runs CI; auto-merges if green",
        ] : [
          "identify the page from the URL",
          "compose the fix",
          "github_commit_file to a new feature branch",
          "github_open_pr base=main label=agent-shipped (auto-merge enabled)",
        ],
        recommended_role: "code_writer",
        recommended_agent: "code_writer",
        blockers: [],
        estimated_minutes: 15,
      }),
      metadata: {
        ...(hasPr ? { comment_for_pr: prNumber } : { feedback_for_url: liveUrl }),
        pbs_comment_text: text,
        next_specialist: "code_writer",
        autonomy_rule_applied: "autonomy_default_mandate_v1",
      },
    })
    .select("id")
    .single();

  // 3. Mark the source notification as seen.
  if (Number.isFinite(notificationId)) {
    await supabase
      .from("cockpit_pbs_notifications")
      .update({ seen_at: new Date().toISOString(), seen_by: "PBS" })
      .eq("id", notificationId);
  }

  await supabase.from("cockpit_audit_log").insert({
    agent: "pbs",
    action: hasPr ? "pr_comment" : "live_feedback",
    target: hasPr ? `${REPO}#${prNumber}` : (liveUrl || "live"),
    success: hasPr ? ghOk : true,
    metadata: {
      pr_number: hasPr ? prNumber : null,
      live_url: liveUrl || null,
      comment: text.slice(0, 500),
      github_comment_id: (ghPayload as { id?: number } | null)?.id ?? null,
      followup_ticket_id: ticketRow?.id ?? null,
    },
    reasoning: text.slice(0, 200),
  });

  return NextResponse.json({
    ok: hasPr ? ghOk : true,
    mode: hasPr ? "pr_comment" : "live_feedback",
    pr_number: hasPr ? prNumber : null,
    github_comment_id: (ghPayload as { id?: number } | null)?.id ?? null,
    followup_ticket_id: ticketRow?.id ?? null,
  });
}
