// app/api/cockpit/deployments-feed/route.ts
// Feed for the ND dropdown. Sources:
//  1. cockpit_pbs_notifications (PR opened, deploy ready, deploy failed)
//  2. cockpit_tickets (status=completed with a PR — so PBS sees finished work)
// Deduped by pr_number — latest event per PR wins. So when a comment
// triggers a rework that re-ships, the single row updates rather than stacks.
//
// 2026-05-07 PBS directive:
//  "a comment becomes auto a task — and when reworked overwrite the link"
//  "why do they not appear i finishe no big text only see link"

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

type FeedItem = {
  id: number | string;
  kind: "prod" | "staging" | "pr" | "completed" | "failed";
  icon: string;
  title: string;
  url: string;
  branch: string | null;
  pr_number: number | null;
  ticket_id: number | null;
  created_at: string;
  seen_at: string | null;
  can_approve: boolean;
  can_comment: boolean;
  is_new: boolean;          // rework — same branch had an older row that was already seen/deleted
};

export async function GET() {
  noStore();

  // Pull all recent (incl. seen — for replacement detection) but only show
  // unseen + last-30min seen so PBS sees fresh approves linger briefly.
  const { data: notifs } = await supabase
    .from("cockpit_pbs_notifications")
    .select("id, created_at, kind, title, url, pr_number, branch, ticket_id, metadata, seen_at")
    .order("created_at", { ascending: false })
    .limit(120);

  // Track every branch that had a previously-seen entry → so the next
  // unseen entry on the same branch is flagged is_new=true.
  const branchHadSeen = new Set<string>();
  const branchHadAnyEntry = new Set<string>();
  for (const n of (notifs ?? [])) {
    if (!n.branch) continue;
    if (n.seen_at) branchHadSeen.add(n.branch);
    branchHadAnyEntry.add(n.branch);
  }

  const { data: doneTickets } = await supabase
    .from("cockpit_tickets")
    .select("id, status, parsed_summary, metadata, updated_at")
    .eq("status", "completed")
    .gt("updated_at", new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString())
    .order("updated_at", { ascending: false })
    .limit(50);

  const byPr = new Map<number, FeedItem>();
  const byTicketWithoutPr: FeedItem[] = [];

  // 1. Notifications. Skip rows seen >30min ago (they vanish from the feed).
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const n of (notifs ?? [])) {
    if (n.seen_at && new Date(n.seen_at).getTime() < cutoff) continue;

    const meta = (n.metadata ?? {}) as Record<string, unknown>;
    const target = (meta.target ?? "") as string;
    let kind: FeedItem["kind"] = "pr";
    let icon = "📝";

    if (n.kind === "deploy_ready") {
      const isProd = target === "production" && (n.url ?? "").includes("namkhan-bi.vercel.app");
      kind = isProd ? "prod" : "staging";
      icon = "🚀";
    } else if (n.kind === "deploy_failed") {
      kind = "failed";
      icon = "🔥";
    } else if (n.kind === "pr_opened") {
      kind = "pr";
      icon = "📝";
    } else if (n.kind === "pr_merged") {
      kind = "completed";
      icon = "✅";
    }

    // 2026-05-08 PBS directive: flicker NEW for ALL unseen rows (reworks
    // AND fresh first-time entries). NEW = anything PBS hasn't acked yet.
    const isNew = !n.seen_at;

    const item: FeedItem = {
      id: `n-${n.id}`,
      kind,
      icon,
      title: n.title,
      url: n.url ?? "",
      branch: n.branch,
      pr_number: n.pr_number,
      ticket_id: n.ticket_id,
      created_at: n.created_at,
      seen_at: n.seen_at,
      can_approve: true,
      can_comment: true,
      is_new: isNew,
    };

    if (n.pr_number) {
      const existing = byPr.get(n.pr_number);
      if (!existing || new Date(item.created_at).getTime() > new Date(existing.created_at).getTime()) {
        byPr.set(n.pr_number, item);
      }
    } else {
      byTicketWithoutPr.push(item);
    }
  }

  // 2. Completed tickets (with PR evidence) — overlay onto the same per-PR row,
  //    upgrading kind=pr → kind=completed and the title to "Shipped: ...".
  for (const t of (doneTickets ?? [])) {
    const meta = (t.metadata ?? {}) as Record<string, unknown>;
    const ev = ((meta.evidence ?? meta) as Record<string, unknown>);
    const prUrl = (ev.pr_url ?? ev.html_url ?? "") as string;
    const sha = (ev.github_sha ?? ev.sha ?? "") as string;
    const prMatch = prUrl.match(/\/pull\/(\d+)/);
    const prNumber = prMatch ? Number(prMatch[1]) : null;

    if (!prNumber && !sha) continue; // not a code ticket

    const firstLine = (t.parsed_summary ?? "").split("\n").filter(Boolean)[0] ?? `Ticket #${t.id} completed`;
    const title = firstLine.replace(/^\*+\s*/, "").slice(0, 140);

    if (prNumber) {
      const existing = byPr.get(prNumber);
      if (existing) {
        // upgrade existing row to "completed" with the freshest title + url
        existing.kind = existing.kind === "prod" ? "prod" : "completed";
        existing.icon = existing.kind === "prod" ? "🚀" : "✅";
        existing.title = `Shipped: ${title}`;
        existing.ticket_id = t.id;
        existing.url = prUrl || existing.url;
      } else {
        byPr.set(prNumber, {
          id: `t-${t.id}`,
          kind: "completed",
          icon: "✅",
          title: `Shipped: ${title}`,
          url: prUrl,
          branch: null,
          pr_number: prNumber,
          ticket_id: t.id,
          created_at: t.updated_at,
          seen_at: null,
          can_approve: true,
          can_comment: true,
          is_new: false,
        });
      }
    } else if (sha) {
      byTicketWithoutPr.push({
        id: `t-${t.id}`,
        kind: "completed",
        icon: "✅",
        title: `Shipped: ${title}`,
        url: `https://github.com/TBC-HM/namkhan-bi/commit/${sha}`,
        branch: null,
        pr_number: null,
        ticket_id: t.id,
        created_at: t.updated_at,
        seen_at: null,
        can_approve: true,
        can_comment: true,
        is_new: false,
      });
    }
  }

  const feed = [...byPr.values(), ...byTicketWithoutPr].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ).slice(0, 50);
  const unseen = feed.filter(f => !f.seen_at && f.kind !== "completed").length;

  return NextResponse.json({ feed, unseen });
}
