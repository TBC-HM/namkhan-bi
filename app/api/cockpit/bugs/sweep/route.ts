// app/api/cockpit/bugs/sweep/route.ts
// Polling loop that wakes Kit's pipeline when a new dept-entry bug arrives.
// Filed 2026-05-09 — Architect Bug #3 ("the red button never changes meaning
// none of Kits team is actually picking this up"). Without this loop the
// Bugs box on dept-entry pages was a write-only inbox.
//
// Triggered by Vercel cron every 5 min (see vercel.json) and also exposed as
// GET + POST so it can be invoked manually for smoke tests. Idempotent: the
// query filters on status='new' / status='acked' so re-runs are safe.
//
// What it does, in order:
//   1. STEP A — RETIRED 2026-07-27 (brief autospec-bug_agent_module-20260725,
//      decision D3). Evidence: in ~11 weeks of 5-min crons, ZERO
//      cockpit_tickets rows with source='cockpit_bugs' were ever created,
//      while 36 bugs sat status='new' — the bridge never worked and competed
//      with the live pipeline for the same bugs. The single bug pipeline of
//      record is lib/bugAgent.ts (plan→review→ship→verify on cockpit_bugs +
//      cockpit.bug_agent_runs), triggered by the ▶ Agent button on
//      /holding/bugs (PBS ruling bug #84: the button is the ONLY trigger).
//      status='new' bugs now stay 'new' until an agent run picks them up.
//      REUSE-FIRST (memory 539): retired, not fixed.
//
//   2. STEP B — for every cockpit_bugs row with status='acked' that has a
//      linked ticket via metadata.cockpit_bug_id:
//        • working ticket statuses → bug 'acked' → 'processing'
//        • completed ticket statuses → bug 'acked|processing' → 'done',
//          and copy ticket.preview_url || ticket.pr_url ||
//          ticket.github_issue_url onto bug.fix_link.
//
// PATCH-equivalent updates use the same column conventions as
// app/api/cockpit/bugs/route.ts (acked_at / started_at / done_at / updated_at).

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { automationGuard } from "@/lib/cron/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key",
);

// Ticket statuses that mean "Kit's pipeline is actively working on it".
const WORKING_TICKET_STATUSES = new Set<string>([
  "triaging",
  "triaged",
  "new",
  "in_progress",
  "working",
  "awaits_user",
  "blocked",
]);

// Ticket statuses that mean "done — surface the fix link on the bug".
const TERMINAL_TICKET_STATUSES = new Set<string>([
  "completed",
  "archived",
  "closed",
  "done",
]);

// PBS 2026-05-09: ticket statuses that mean "Kit choked" — sweep flips the
// bug back to status='new' so the dot turns red again and a human (or a
// retry sweep) can pick it up. Without this the bug sits at 'processing'
// (light green) forever even though nothing is actually happening.
const FAILED_TICKET_STATUSES = new Set<string>([
  "triage_failed",
  "failed",
  "rolled_back",
]);

// SWEEP_LIMIT removed 2026-07-27 with STEP A (D3) — STEP B has its own limit(50).

type SweepResult = {
  ok: true;
  acked: Array<{ bug_id: number; ticket_id: number | null; error?: string }>;
  promoted: Array<{ bug_id: number; ticket_id: number; from: string; to: string; fix_link?: string | null }>;
  scanned: { new: number; acked: number };
};

async function runSweep(): Promise<SweepResult> {
  // ── STEP A — RETIRED (D3, 2026-07-27) ─────────────────────────────────
  // The bug→ticket bridge is dead code by evidence (0 tickets ever created,
  // 36 bugs stuck 'new'). lib/bugAgent.ts is the single pipeline of record;
  // it picks status='new' bugs directly via v_bugs_ready_for_agent when PBS
  // presses ▶ on /holding/bugs. The sweep only counts 'new' bugs now
  // (informational, keeps the response shape UI-stable) and never acks,
  // never creates tickets, never kicks the old agent loop.
  const { count: newCount, error: newErr } = await supabase
    .from("cockpit_bugs")
    .select("id", { count: "exact", head: true })
    .eq("status", "new");

  if (newErr) throw new Error(`scan new bugs failed: ${newErr.message}`);

  const acked: SweepResult["acked"] = [];

  // ── STEP B ────────────────────────────────────────────────────────────
  // For 'acked' or 'processing' bugs whose linked ticket has progressed,
  // promote bug status to mirror the ticket. Uses metadata.cockpit_bug_id
  // as the join key so we don't need a schema migration.
  const promoted: SweepResult["promoted"] = [];

  // PBS 2026-05-09 hard rule: explicitly exclude 'done' so the sweep can
  // never re-pick up a finished bug, even if its linked ticket later flips
  // status. The DB-side trigger blocks status reverts from done, so this is
  // belt-and-braces.
  const { data: liveBugs, error: liveErr } = await supabase
    .from("cockpit_bugs")
    .select("id, status")
    .in("status", ["acked", "processing"])
    .neq("status", "done")
    .order("id", { ascending: true })
    .limit(50);

  if (liveErr) throw new Error(`scan acked bugs failed: ${liveErr.message}`);

  for (const bug of liveBugs ?? []) {
    // Find the most recent ticket linked to this bug via metadata.
    const { data: linked } = await supabase
      .from("cockpit_tickets")
      .select("id, status, preview_url, pr_url, github_issue_url, updated_at")
      .eq("metadata->>cockpit_bug_id", String(bug.id))
      .order("updated_at", { ascending: false })
      .limit(1);

    const ticket = linked?.[0];
    if (!ticket) continue;

    const tStatus = String(ticket.status ?? "");
    const nowIso = new Date().toISOString();

    if (TERMINAL_TICKET_STATUSES.has(tStatus) && bug.status !== "done") {
      const fixLink: string | null =
        (ticket.preview_url as string | null) ||
        (ticket.pr_url as string | null) ||
        (ticket.github_issue_url as string | null) ||
        null;

      const { error: upErr } = await supabase
        .from("cockpit_bugs")
        .update({
          status: "done",
          done_at: nowIso,
          updated_at: nowIso,
          fix_link: fixLink,
          fix_label: fixLink ? (ticket.preview_url ? "preview" : ticket.pr_url ? "PR" : "issue") : null,
        })
        .eq("id", bug.id)
        .in("status", ["acked", "processing"]);
      if (!upErr) {
        promoted.push({ bug_id: bug.id, ticket_id: ticket.id as number, from: bug.status, to: "done", fix_link: fixLink });
        await supabase.from("cockpit_audit_log").insert({
          ticket_id: ticket.id as number,
          agent: "bugs_sweep",
          action: "promote_done",
          target: `bug:${bug.id}`,
          success: true,
          metadata: { bug_id: bug.id, ticket_status: tStatus, fix_link: fixLink },
          reasoning: `ticket #${ticket.id} reached ${tStatus}; bug #${bug.id} flipped to done`,
        });
      }
    } else if (WORKING_TICKET_STATUSES.has(tStatus)) {
      // PBS 2026-05-09: when ticket reaches awaits_user (or any working state)
      // and a preview_url exists, copy it onto the bug NOW so the dept-entry
      // bug box can render the "✓ approve · deploy" button. Previously fix_link
      // only got copied at TERMINAL — meaning approval was invisible to PBS.
      const previewLink = (ticket.preview_url as string | null) || null;
      const isAwaitsUser = tStatus === "awaits_user";
      const wantsLink = isAwaitsUser && previewLink && previewLink.startsWith("https://");

      const patch: Record<string, unknown> = { updated_at: nowIso };
      let didFlip = false;
      if (bug.status === "acked") {
        patch.status = "processing";
        patch.started_at = nowIso;
        didFlip = true;
      }
      if (wantsLink) {
        patch.fix_link = previewLink;
        patch.fix_label = "preview · approve to promote";
      }

      // Only update if there's something to write
      if (didFlip || wantsLink) {
        const q = supabase.from("cockpit_bugs").update(patch).eq("id", bug.id);
        const { error: upErr } = bug.status === "acked"
          ? await q.eq("status", "acked")
          : await q.in("status", ["acked", "processing"]);
        if (!upErr && didFlip) {
          promoted.push({ bug_id: bug.id, ticket_id: ticket.id as number, from: "acked", to: "processing" });
          await supabase.from("cockpit_audit_log").insert({
            ticket_id: ticket.id as number,
            agent: "bugs_sweep",
            action: "promote_processing",
            target: `bug:${bug.id}`,
            success: true,
            metadata: { bug_id: bug.id, ticket_status: tStatus, preview_url: previewLink },
            reasoning: `ticket #${ticket.id} status=${tStatus}; bug #${bug.id} flipped acked→processing${wantsLink ? ` + fix_link copied for approve` : ``}`,
          });
        }
      }
    } else if (FAILED_TICKET_STATUSES.has(tStatus)) {
      // PBS 2026-05-10 v5: cap the retry loop at 3 attempts.
      // Previously: failure → bug back to 'new' → sweep creates duplicate ticket
      // → if that also fails → another duplicate → infinite loop.
      // Now: count linked failed tickets via metadata.cockpit_bug_id. If >=3,
      // mark bug 'wont_fix' so sweep stops re-spawning. PBS can manually
      // re-open by setting bug.status='new' if they want another try.
      const { count: failedCount } = await supabase
        .from("cockpit_tickets")
        .select("id", { count: "exact", head: true })
        .eq("metadata->>cockpit_bug_id", String(bug.id))
        .in("status", Array.from(FAILED_TICKET_STATUSES));

      const totalFailures = failedCount ?? 1;
      const reasonText = `triage failed (ticket #${ticket.id}) — attempt ${totalFailures}/3`;

      if (totalFailures >= 3) {
        // Stop the loop. Bug stays visible but sweep will not pick it up again.
        const { error: upErr } = await supabase
          .from("cockpit_bugs")
          .update({
            status: "wont_fix",
            updated_at: nowIso,
            fix_label: `auto-paused after ${totalFailures} failed attempts — PBS to review`,
          })
          .eq("id", bug.id)
          .in("status", ["acked", "processing"]);
        if (!upErr) {
          promoted.push({ bug_id: bug.id, ticket_id: ticket.id as number, from: bug.status, to: "wont_fix" });
          await supabase.from("cockpit_audit_log").insert({
            ticket_id: ticket.id as number,
            agent: "bugs_sweep",
            action: "auto_pause_failed_loop",
            target: `bug:${bug.id}`,
            success: true,
            metadata: { bug_id: bug.id, ticket_status: tStatus, failure_count: totalFailures },
            reasoning: `bug #${bug.id} hit ${totalFailures} failed attempts; auto-paused to break runner loop. PBS can flip bug.status='new' to retry.`,
          });
        }
      } else {
        // Normal failure flip: bug back to 'new' so the loop can try again.
        const { error: upErr } = await supabase
          .from("cockpit_bugs")
          .update({
            status: "new",
            acked_at: null,
            started_at: null,
            done_at: null,
            fix_link: null,
            fix_label: reasonText,
            updated_at: nowIso,
          })
          .eq("id", bug.id)
          .in("status", ["acked", "processing"]);
        if (!upErr) {
          promoted.push({ bug_id: bug.id, ticket_id: ticket.id as number, from: bug.status, to: "new" });
          await supabase.from("cockpit_audit_log").insert({
            ticket_id: ticket.id as number,
            agent: "bugs_sweep",
            action: "demote_failed",
            target: `bug:${bug.id}`,
            success: true,
            metadata: { bug_id: bug.id, ticket_status: tStatus, failure_count: totalFailures },
            reasoning: `ticket #${ticket.id} status=${tStatus}; bug #${bug.id} flipped back to new (attempt ${totalFailures}/3) — fake-green guard`,
          });
        }
      }
    }
  }

  return {
    ok: true,
    acked,
    promoted,
    scanned: { new: newCount ?? 0, acked: liveBugs?.length ?? 0 },
  };
}

export async function GET() {
  noStore();
  // GLOBAL KILL SWITCH (brief ops-scheduler-console-v1 A3)
  const blocked = await automationGuard("/api/cockpit/bugs/sweep");
  if (blocked) return blocked;
  try {
    const result = await runSweep();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function POST() {
  noStore();
  const blocked = await automationGuard("/api/cockpit/bugs/sweep");
  if (blocked) return blocked;
  try {
    const result = await runSweep();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
