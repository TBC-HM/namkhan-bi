// app/api/cockpit/deployments/delete/route.ts
// PBS hits the ✕ on a row in the ND dropdown.
// 1. Hard-delete the cockpit_pbs_notifications row so it stops appearing.
// 2. If the row references a still-OPEN PR and `also_close_pr=true`, close it on GitHub.
//
// 2026-05-08 PBS directive: "put delete since of many there are 3 versions"

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REPO = "TBC-HM/namkhan-bi";

// Feed ids are prefixed strings ("n-123" / "t-456"). Older callers also
// passed them via `body.id`. Parse defensively.
function parseFeedId(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw);
  const m = s.match(/^n-(\d+)$/);
  if (m) return Number(m[1]);
  if (/^\d+$/.test(s)) return Number(s);
  return null;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const notificationIdRaw = body.notification_id;
  const notificationId = Number.isFinite(Number(notificationIdRaw))
    ? Number(notificationIdRaw)
    : parseFeedId(body.id);
  const prNumber = Number(body.pr_number);
  const closePr = body.also_close_pr === true;

  // Hard-delete the notification row
  if (notificationId != null) {
    await supabase
      .from("cockpit_pbs_notifications")
      .delete()
      .eq("id", notificationId);
  }

  // Optionally close the GitHub PR
  let prClosed = false;
  if (closePr && Number.isFinite(prNumber) && process.env.GITHUB_TOKEN) {
    const headers = {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    };
    const res = await fetch(`https://api.github.com/repos/${REPO}/pulls/${prNumber}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ state: "closed" }),
    });
    prClosed = res.ok;
  }

  await supabase.from("cockpit_audit_log").insert({
    agent: "pbs",
    action: "notification_deleted",
    target: notificationId != null ? `notification:${notificationId}` : (Number.isFinite(prNumber) ? `${REPO}#${prNumber}` : "unknown"),
    success: true,
    metadata: {
      notification_id: notificationId,
      pr_number: Number.isFinite(prNumber) ? prNumber : null,
      also_close_pr: closePr,
      pr_closed: prClosed,
    },
    reasoning: "PBS deleted ND-feed row.",
  });

  return NextResponse.json({
    ok: true,
    deleted_notification: notificationId,
    pr_closed: prClosed,
  });
}
