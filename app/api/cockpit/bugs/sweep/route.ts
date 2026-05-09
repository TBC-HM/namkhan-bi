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
//   1. STEP A — for every cockpit_bugs row with status='new':
//        • create a cockpit_tickets row (source='cockpit_bugs',
//          intent='triage', metadata.cockpit_bug_id = bug.id)
//        • flip bug status='new' → 'acked' (sets acked_at)
//      The existing chat/triage pipeline (pg_cron + agent/run loop) then
//      processes that ticket via the standard Kit flow.
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
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

const SWEEP_LIMIT = 10;

type SweepResult = {
  ok: true;
  acked: Array<{ bug_id: number; ticket_id: number | null; error?: string }>;
  promoted: Array<{ bug_id: number; ticket_id: number; from: string; to: string; fix_link?: string | null }>;
  scanned: { new: number; acked: number };
};

async function runSweep(): Promise<SweepResult> {
  // ── STEP A ────────────────────────────────────────────────────────────
  // Pull the oldest 'new' bugs, create a triage ticket per bug, then ack.
  const { data: newBugs, error: newErr } = await supabase
    .from("cockpit_bugs")
    .select("id, dept_slug, body, created_at")
    .eq("status", "new")
    .order("created_at", { ascending: true })
    .limit(SWEEP_LIMIT);

  if (newErr) throw new Error(`scan new bugs failed: ${newErr.message}`);

  const acked: SweepResult["acked"] = [];

  for (const bug of newBugs ?? []) {
    // Insert a ticket exactly like the chat-route triage flow does
    // (source/arm/intent/status/parsed_summary/iterations) plus
    // metadata.cockpit_bug_id so STEP B can later cross-reference.
    const summary = `[bug #${bug.id} · ${bug.dept_slug}] ${String(bug.body ?? "").slice(0, 460)}`;
    const { data: ticket, error: tErr } = await supabase
      .from("cockpit_tickets")
      .insert({
        source: "cockpit_bugs",
        arm: bug.dept_slug ?? "ops",
        intent: "triage",
        status: "triaging",
        parsed_summary: summary,
        email_subject: summary.slice(0, 140),
        email_body: bug.body ?? "",
        iterations: 0,
        metadata: { cockpit_bug_id: bug.id, dept_slug: bug.dept_slug, source_kind: "dept_bugs_box" },
      })
      .select("id")
      .single();

    if (tErr) {
      acked.push({ bug_id: bug.id, ticket_id: null, error: tErr.message });
      continue;
    }

    const nowIso = new Date().toISOString();
    const { error: bErr } = await supabase
      .from("cockpit_bugs")
      .update({ status: "acked", acked_at: nowIso, updated_at: nowIso })
      .eq("id", bug.id)
      .eq("status", "new"); // race-safe: only flip if still 'new'

    if (bErr) {
      acked.push({ bug_id: bug.id, ticket_id: ticket?.id ?? null, error: bErr.message });
      continue;
    }

    // Audit-log so the sweep is visible alongside Kit's other actions.
    await supabase.from("cockpit_audit_log").insert({
      ticket_id: ticket?.id ?? null,
      agent: "bugs_sweep",
      action: "ack_and_route",
      target: `bug:${bug.id}`,
      success: true,
      metadata: { bug_id: bug.id, dept_slug: bug.dept_slug },
      reasoning: `cockpit_bugs id=${bug.id} flipped new→acked; ticket #${ticket?.id} created for Kit triage`,
    });

    // Fire-and-forget kick to /api/cockpit/agent/run so the role-specific
    // worker starts inside seconds rather than waiting for pg_cron. Same
    // pattern as the chat route. Safe to ignore failure — the agent loop
    // and the next sweep both pick the ticket up.
    const agentToken = process.env.COCKPIT_AGENT_TOKEN;
    if (agentToken && ticket?.id) {
      void fetch(
        `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://namkhan-bi.vercel.app"}/api/cockpit/agent/run?id=${ticket.id}`,
        { method: "POST", headers: { Authorization: `Bearer ${agentToken}` } },
      ).catch(() => {
        /* swallow — pg_cron is the safety net */
      });
    }

    acked.push({ bug_id: bug.id, ticket_id: ticket?.id ?? null });
  }

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
    } else if (WORKING_TICKET_STATUSES.has(tStatus) && bug.status === "acked") {
      const { error: upErr } = await supabase
        .from("cockpit_bugs")
        .update({ status: "processing", started_at: nowIso, updated_at: nowIso })
        .eq("id", bug.id)
        .eq("status", "acked");
      if (!upErr) {
        promoted.push({ bug_id: bug.id, ticket_id: ticket.id as number, from: "acked", to: "processing" });
        await supabase.from("cockpit_audit_log").insert({
          ticket_id: ticket.id as number,
          agent: "bugs_sweep",
          action: "promote_processing",
          target: `bug:${bug.id}`,
          success: true,
          metadata: { bug_id: bug.id, ticket_status: tStatus },
          reasoning: `ticket #${ticket.id} status=${tStatus}; bug #${bug.id} flipped acked→processing`,
        });
      }
    } else if (FAILED_TICKET_STATUSES.has(tStatus)) {
      // PBS 2026-05-09: Kit triage failed — flip the bug BACK to 'new'
      // (red dot) so the green-processing isn't fake. Clear acked_at +
      // started_at so it looks fresh; record why in fix_label so the row
      // surfaces the failure mode at a glance.
      const reasonText = `triage failed (ticket #${ticket.id})`;
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
          metadata: { bug_id: bug.id, ticket_status: tStatus },
          reasoning: `ticket #${ticket.id} status=${tStatus}; bug #${bug.id} flipped back to new (red dot) — fake-green guard`,
        });
      }
    }
  }

  return {
    ok: true,
    acked,
    promoted,
    scanned: { new: newBugs?.length ?? 0, acked: liveBugs?.length ?? 0 },
  };
}

export async function GET() {
  noStore();
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
