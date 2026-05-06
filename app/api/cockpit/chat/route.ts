// app/api/cockpit/chat/route.ts
// POST a chat message → creates a cockpit_ticket, then synchronously triages
// it via Anthropic (IT Manager role). Updates ticket with triage result so
// the realtime subscription in /cockpit shows it as soon as it lands.
//
// Flow: insert (status=triaging) → POST returns → Anthropic call (5-10s)
// → UPDATE ticket with arm/intent/summary/plan (status=triaged).

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { loadSkillsForRole, dispatchSkill } from "@/lib/cockpit-tools";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// IT Manager prompt now lives in DB (cockpit_agent_prompts where role='it_manager').
// Falls back to this hardcoded copy only if DB lookup fails.
const IT_MANAGER_FALLBACK_PROMPT = `You are the IT Manager for Namkhan BI. Triage incoming requests. Output ONLY a JSON object: {"arm":"health|dev|control|design|research|ops","intent":"build|fix|investigate|decide|monitor|document","urgency":"low|medium|high|critical","summary":"1-2 sentences","plan":["step 1","step 2"],"recommended_agent":"designer|documentarian|researcher|reviewer|tester|ops_lead|none","blockers":[],"estimated_minutes":15}`;

// Meta-mode: when the user is giving an instruction ABOUT the agents
// themselves (refining a prompt, changing routing rules, adding a new role),
// the IT Manager switches to this prompt and proposes a structured patch
// the user can approve.
const META_MODE_PROMPT = `You are the IT Manager for Namkhan BI in PROMPT REFINEMENT MODE. The user just said something that refines how YOU or one of your worker agents should behave. Your job: identify which agent's prompt should change, propose the exact patch, and stop.

Available roles to refine: it_manager, researcher, designer, documentarian, reviewer, tester, ops_lead, none.

Output ONLY a JSON object:
{
  "is_meta": true,
  "target_role": "<role being refined>",
  "change_type": "append|replace|insert_before",
  "patch_text": "the exact text to add or replace",
  "human_summary": "1-sentence plain-English description of the change",
  "rationale": "why this change makes sense given the user's request",
  "needs_user_approval": true
}

If the user message is NOT a meta-instruction (i.e., it's a normal work request), output:
{ "is_meta": false }

Examples that ARE meta:
- "make the researcher also check GitHub before answering"
- "the designer should always ask about mobile responsiveness"
- "add a security_reviewer role that checks RLS on every change"
- "stop using sonnet, use opus for the researcher"
- "the IT Manager keeps over-classifying things as urgent"

Examples that are NOT meta:
- "fix the parity page"
- "investigate why pickup is down"
- "build a new KPI tile"`;

async function loadPrompt(role: string): Promise<string> {
  const { data } = await supabase
    .from("cockpit_agent_prompts")
    .select("prompt")
    .eq("role", role)
    .eq("active", true)
    .single();
  return data?.prompt ?? IT_MANAGER_FALLBACK_PROMPT;
}

async function approveWorkTicket(): Promise<{ ticket: Record<string, unknown>; spec: string; issue: Record<string, unknown> } | null> {
  // Find most recent awaits_user work ticket (NOT a prompt_refinement one).
  const { data: pending } = await supabase
    .from("cockpit_tickets")
    .select("*")
    .eq("status", "awaits_user")
    .order("created_at", { ascending: false })
    .limit(5);
  if (!pending) return null;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const ghToken = process.env.GITHUB_TOKEN;

  for (const ticket of pending) {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(ticket.notes ?? "{}");
    } catch {
      continue;
    }
    if (payload.kind === "prompt_refinement") continue; // handled by meta path
    const triage = payload.triage as Record<string, unknown> | undefined;
    if (!triage) continue;

    // Load code_spec_writer prompt.
    const { data: specPrompt } = await supabase
      .from("cockpit_agent_prompts")
      .select("prompt")
      .eq("role", "code_spec_writer")
      .eq("active", true)
      .single();

    if (!apiKey || !specPrompt) {
      // Mark approved without spec.
      await supabase
        .from("cockpit_tickets")
        .update({ status: "completed", parsed_summary: (ticket.parsed_summary ?? "") + "\n\n✅ **Approved** — no code spec generated (ANTHROPIC_API_KEY missing)." })
        .eq("id", ticket.id);
      return { ticket, spec: "", issue: { opened: false, reason: "anthropic missing" } };
    }

    // Generate spec.
    const userMsg = `Original request:\n${(ticket.parsed_summary ?? "").split("---")[0]}\n\nFull pipeline output:\n${JSON.stringify(payload, null, 2)}`;
    let spec = "";
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 2000,
          system: specPrompt.prompt,
          messages: [{ role: "user", content: userMsg }],
        }),
      });
      if (res.ok) {
        const j = await res.json();
        spec = j?.content?.[0]?.text ?? "";
      }
    } catch (e) {
      spec = `(spec generation failed: ${e instanceof Error ? e.message : "unknown"})`;
    }

    // Open GH issue.
    let issue: Record<string, unknown> = { opened: false };
    if (ghToken && spec) {
      try {
        const r = await fetch("https://api.github.com/repos/TBC-HM/namkhan-bi/issues", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ghToken}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: `🤖 [cockpit:${ticket.arm}] ${(triage.summary as string ?? "").slice(0, 80)}`,
            body: `Auto-generated from cockpit ticket #${ticket.id}.\n\n${spec}\n\n---\n_Source: cockpit-${ticket.arm}-pipeline · model: claude-sonnet-4-6_`,
            labels: ["auto-spec", "cockpit", `arm-${ticket.arm}`],
          }),
        });
        if (r.ok) {
          const j = await r.json();
          issue = { opened: true, url: j.html_url, number: j.number };
        } else {
          issue = { opened: false, reason: `github ${r.status}` };
        }
      } catch (e) {
        issue = { opened: false, reason: e instanceof Error ? e.message : "unknown" };
      }
    }

    const completion = `\n\n---\n✅ **Approved & spec written**\n\n${spec}${
      issue.opened ? `\n\n🔗 GitHub issue: ${issue.url}` : ""
    }`;

    await supabase
      .from("cockpit_tickets")
      .update({
        status: "completed",
        parsed_summary: ((ticket.parsed_summary ?? "") + completion).slice(0, 8000),
        github_issue_url: typeof issue.url === "string" ? issue.url : null,
      })
      .eq("id", ticket.id);

    await supabase.from("cockpit_audit_log").insert({
      ticket_id: ticket.id,
      agent: "code_spec_writer",
      action: "approve_and_spec",
      target: typeof issue.url === "string" ? issue.url : `ticket:${ticket.id}`,
      success: !!issue.opened,
      metadata: { issue, has_spec: !!spec },
      reasoning: `approved by user; spec written; GH issue ${issue.opened ? "opened" : "not opened"}`,
    });

    return { ticket, spec, issue };
  }
  return null;
}

async function applyPendingMetaPatch(): Promise<{ ticket: Record<string, unknown>; patch: Record<string, unknown> } | null> {
  // Find the most recent awaits_user ticket with a prompt_refinement payload.
  const { data: pending } = await supabase
    .from("cockpit_tickets")
    .select("*")
    .eq("status", "awaits_user")
    .order("created_at", { ascending: false })
    .limit(5);

  if (!pending) return null;

  for (const ticket of pending) {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(ticket.notes ?? "{}");
    } catch {
      continue;
    }
    if (payload.kind !== "prompt_refinement") continue;
    const patch = payload.patch as {
      target_role: string;
      change_type: "append" | "replace" | "insert_before";
      patch_text: string;
    };
    if (!patch?.target_role || !patch?.patch_text) continue;

    // Load current active prompt for that role.
    const { data: current } = await supabase
      .from("cockpit_agent_prompts")
      .select("id, prompt, version")
      .eq("role", patch.target_role)
      .eq("active", true)
      .single();

    if (!current) {
      await supabase
        .from("cockpit_tickets")
        .update({
          status: "triage_failed",
          parsed_summary: (ticket.parsed_summary ?? "") + "\n\n❌ Could not apply: target role has no active prompt.",
        })
        .eq("id", ticket.id);
      continue;
    }

    // Build new prompt body.
    let newBody = current.prompt;
    if (patch.change_type === "append") {
      newBody = current.prompt + "\n\n" + patch.patch_text;
    } else if (patch.change_type === "replace") {
      newBody = patch.patch_text;
    } else if (patch.change_type === "insert_before") {
      newBody = patch.patch_text + "\n\n" + current.prompt;
    }

    // Deactivate old, insert new.
    await supabase.from("cockpit_agent_prompts").update({ active: false }).eq("id", current.id);
    await supabase.from("cockpit_agent_prompts").insert({
      role: patch.target_role,
      prompt: newBody,
      version: (current.version ?? 1) + 1,
      active: true,
      source: "meta_update",
      ticket_id: ticket.id,
      notes: String((payload.patch as Record<string, unknown>).human_summary ?? ""),
    });

    // Mark ticket completed.
    const completionNote =
      "\n\n---\n✅ **Patch applied** — `" +
      patch.target_role +
      "` prompt is now version " +
      ((current.version ?? 1) + 1) +
      ".";
    await supabase
      .from("cockpit_tickets")
      .update({
        status: "completed",
        parsed_summary: (ticket.parsed_summary ?? "") + completionNote,
      })
      .eq("id", ticket.id);

    await supabase.from("cockpit_audit_log").insert({
      ticket_id: ticket.id,
      agent: "it_manager",
      action: "meta_apply",
      target: `role:${patch.target_role}`,
      success: true,
      metadata: { patch, prior_version: current.version, new_version: (current.version ?? 1) + 1 },
      reasoning: `prompt for ${patch.target_role} updated to v${(current.version ?? 1) + 1}`,
    });

    return { ticket, patch };
  }
  return null;
}

async function detectMeta(message: string): Promise<{ is_meta: boolean; patch?: Record<string, unknown> }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { is_meta: false };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system: META_MODE_PROMPT,
      messages: [{ role: "user", content: message }],
    }),
  });

  if (!res.ok) return { is_meta: false };
  const json = await res.json();
  const text = json?.content?.[0]?.text ?? "";
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.is_meta === true) return { is_meta: true, patch: parsed };
    return { is_meta: false };
  } catch {
    return { is_meta: false };
  }
}

type Triage = {
  arm: string;
  intent: string;
  urgency: string;
  summary: string;
  plan: string[];
  recommended_agent: string;
  blockers: string[];
  estimated_minutes: number;
};

async function triageMessage(message: string, debug: { iterations: number; lastError: string | null; lastText: string | null; tokens_in: number; tokens_out: number; duration_ms: number } = { iterations: 0, lastError: null, lastText: null, tokens_in: 0, tokens_out: 0, duration_ms: 0 }): Promise<Triage | null> {
  const t0 = Date.now();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const systemPrompt = await loadPrompt("it_manager");
  const skills = await loadSkillsForRole("it_manager");
  const tools = skills.map((s) => ({
    name: s.name,
    description: s.description,
    input_schema: s.input_schema,
  }));
  const handlerByName = new Map(skills.map((s) => [s.name, s.handler] as [string, string]));

  type Msg = { role: "user" | "assistant"; content: unknown };
  const messages: Msg[] = [{ role: "user", content: message }];

  // Tool-use loop. Up to 10 iterations: IT Manager v5 may want to call
  // read_knowledge_base + list_recent_tickets + search_repo + ... so be generous.
  for (let iter = 0; iter < 10; iter++) {
    const body: Record<string, unknown> = {
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    };
    if (tools.length > 0) body.tools = tools;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    debug.iterations = iter + 1;

    if (!res.ok) {
      const errText = await res.text();
      debug.lastError = `anthropic ${res.status}: ${errText.slice(0, 300)}`;
      console.error(debug.lastError);
      return null;
    }

    const json = await res.json();
    const stopReason = json?.stop_reason as string | undefined;
    const blocks = (json?.content ?? []) as Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
    debug.tokens_in += json?.usage?.input_tokens ?? 0;
    debug.tokens_out += json?.usage?.output_tokens ?? 0;

    const toolUses = blocks.filter((b) => b.type === "tool_use");
    if (toolUses.length > 0 && stopReason === "tool_use") {
      messages.push({ role: "assistant", content: blocks });
      const results: Array<{ type: string; tool_use_id: string; content: string }> = [];
      for (const tu of toolUses) {
        const handler = handlerByName.get(tu.name ?? "");
        let resultText: string;
        if (!handler) {
          resultText = JSON.stringify({ ok: false, error: `unknown skill: ${tu.name}` });
        } else {
          const r = await dispatchSkill(handler, tu.input ?? {});
          resultText = JSON.stringify(r).slice(0, 4000);
        }
        results.push({ type: "tool_result", tool_use_id: tu.id ?? "", content: resultText });
      }
      messages.push({ role: "user", content: results });
      continue;
    }

    const textBlock = blocks.find((b) => b.type === "text");
    const text = textBlock?.text ?? "";
    debug.lastText = text;
    // Strip code fences AND any leading prose before the first {.
    let cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }
    try {
      debug.duration_ms = Date.now() - t0;
      return JSON.parse(cleaned) as Triage;
    } catch (e) {
      debug.lastError = `parse err: ${e instanceof Error ? e.message : "unknown"} | text: ${text.slice(0, 300)}`;
      console.error(debug.lastError);
      return null;
    }
  }
  debug.lastError = "triage hit iteration cap";
  debug.duration_ms = Date.now() - t0;
  console.error(debug.lastError);
  return null;
}

function renderTriageMarkdown(t: Triage, originalMessage: string): string {
  const planLines = t.plan.map((s, i) => `${i + 1}. ${s}`).join("\n");
  const blockerLines = (t.blockers ?? []).filter(Boolean).map((s) => `- ${s}`).join("\n");
  return [
    `**Request**: ${originalMessage}`,
    "",
    `**Triage** — ${t.arm} · ${t.intent} · urgency ${t.urgency} · ~${t.estimated_minutes} min`,
    "",
    t.summary,
    "",
    "**Plan**",
    planLines || "_(no concrete steps)_",
    blockerLines ? `\n**Blockers / questions**\n${blockerLines}` : "",
    `\n_Recommended agent: ${t.recommended_agent}_`,
  ].join("\n");
}

function isAuthorized(req: Request): boolean {
  // Either valid workspace_session cookie OR Bearer COCKPIT_AGENT_TOKEN.
  const cookie = req.headers.get("cookie") ?? "";
  if (/workspace_session=/.test(cookie)) return true; // middleware would already enforce, but allow self-pass for tests
  const auth = req.headers.get("authorization") ?? "";
  const expected = process.env.COCKPIT_AGENT_TOKEN;
  if (expected && auth === `Bearer ${expected}`) return true;
  return false;
}

export async function POST(req: Request) {
  noStore();
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }
    const { message } = await req.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }

    // 0a. Standing-task activation: "run <slug>" or "activate <slug>" or
    //     "fire site_design_sweep" — fires a pre-defined task ticket.
    const lower0 = message.toLowerCase().trim();
    const runMatch = lower0.match(/^(?:run|activate|fire|start)\s+(?:the\s+)?(?:standing\s+task\s+)?["']?([a-z][a-z0-9_]+)["']?(?:\s+task)?$/);
    if (runMatch) {
      const candidateSlug = runMatch[1];
      const { data: task } = await supabase
        .from("cockpit_standing_tasks")
        .select("*")
        .eq("active", true)
        .or(`slug.eq.${candidateSlug},slug.ilike.%${candidateSlug}%`)
        .limit(1)
        .single();
      if (task) {
        const tpl = task.ticket_template as { arm?: string; intent?: string; parsed_summary?: string };
        const { data: t } = await supabase
          .from("cockpit_tickets")
          .insert({
            source: `standing_task:${task.slug}`,
            arm: tpl.arm ?? "ops",
            intent: tpl.intent ?? "investigate",
            status: "new",
            parsed_summary: tpl.parsed_summary ?? task.description,
            iterations: 0,
          })
          .select()
          .single();
        if (t) {
          await supabase
            .from("cockpit_standing_tasks")
            .update({ last_run_at: new Date().toISOString(), run_count: (task.run_count ?? 0) + 1 })
            .eq("id", task.id);
          await supabase.from("cockpit_audit_log").insert({
            agent: "standing_task_runner",
            action: "run_via_chat",
            target: `task:${task.slug}`,
            success: true,
            ticket_id: t.id,
            metadata: { trigger_message: message },
            reasoning: `user activated standing task ${task.slug}`,
          });
          return NextResponse.json({
            ticket: t,
            standing_task: { slug: task.slug, name: task.name, ran: true },
          });
        }
      }
    }

    // 0. Detect meta-mode: is the user refining an agent prompt rather than
    //    asking for work? If so, propose a patch and route to a different status.
    const meta = await detectMeta(message);

    if (meta.is_meta && meta.patch) {
      const patch = meta.patch;
      const summary = [
        `**🛠 Prompt refinement requested**`,
        ``,
        `**Target role**: \`${patch.target_role}\``,
        `**Change type**: ${patch.change_type}`,
        ``,
        `**Summary**: ${patch.human_summary}`,
        ``,
        `**Rationale**: ${patch.rationale}`,
        ``,
        `**Patch text**:`,
        "```",
        String(patch.patch_text ?? ""),
        "```",
        ``,
        `_Reply with **approve** or **yes** to apply this patch. Reply with **reject** or anything else to cancel._`,
      ].join("\n");

      const { data: metaTicket, error: metaErr } = await supabase
        .from("cockpit_tickets")
        .insert({
          source: "cockpit_chat",
          arm: "ops",
          intent: "decide",
          status: "awaits_user",
          parsed_summary: summary,
          notes: JSON.stringify({ kind: "prompt_refinement", patch, original_message: message }),
          iterations: 0,
        })
        .select()
        .single();

      if (metaErr) return NextResponse.json({ error: metaErr.message }, { status: 500 });

      await supabase.from("cockpit_audit_log").insert({
        ticket_id: metaTicket.id,
        agent: "it_manager",
        action: "meta_propose",
        target: `role:${patch.target_role}`,
        success: true,
        metadata: { patch, model: "claude-sonnet-4-6" },
        reasoning: String(patch.human_summary ?? ""),
      });

      return NextResponse.json({ ticket: metaTicket, meta: patch });
    }

    // 0b. Approval reply for a previous meta proposal OR a work ticket
    //     whose specialist agent flagged approve_to_proceed=true.
    const lowerMsg = message.toLowerCase().trim();
    const isApproval =
      lowerMsg === "approve" ||
      lowerMsg === "yes" ||
      lowerMsg === "apply" ||
      lowerMsg === "ok approve" ||
      lowerMsg === "ship it";

    if (isApproval) {
      // Try meta-patch first.
      const metaResult = await applyPendingMetaPatch();
      if (metaResult) {
        return NextResponse.json({ ticket: metaResult.ticket, applied: metaResult.patch });
      }
      // Then try work-ticket approval → open GH issue with spec.
      const workResult = await approveWorkTicket();
      if (workResult) {
        return NextResponse.json(workResult);
      }
      // No pending → fall through to normal triage.
    }

    // 1. Insert immediately so the chat UI shows the ticket right away.
    const { data: inserted, error: insErr } = await supabase
      .from("cockpit_tickets")
      .insert({
        source: "cockpit_chat",
        arm: "triaging",
        intent: "triage",
        status: "triaging",
        parsed_summary: message.slice(0, 500),
        iterations: 0,
      })
      .select()
      .single();

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    // 2. Triage via Anthropic (IT Manager role).
    const debug = { iterations: 0, lastError: null as string | null, lastText: null as string | null, tokens_in: 0, tokens_out: 0, duration_ms: 0 };
    const triage = await triageMessage(message, debug);

    // 3. UPDATE — realtime subscriber on /cockpit will pick this up.
    if (triage) {
      const summary = renderTriageMarkdown(triage, message);
      await supabase
        .from("cockpit_tickets")
        .update({
          arm: triage.arm,
          intent: triage.intent,
          status: "triaged",
          parsed_summary: summary,
          notes: JSON.stringify(triage),
        })
        .eq("id", inserted.id);

      // Audit trail with cost.
      const milliCost = Math.round((debug.tokens_in * 3 + debug.tokens_out * 15) / 1000);
      await supabase.from("cockpit_audit_log").insert({
        ticket_id: inserted.id,
        agent: "it_manager",
        action: "triage",
        target: `ticket:${inserted.id}`,
        success: true,
        metadata: { triage, model: "claude-sonnet-4-6", debug },
        reasoning: triage.summary,
        input_tokens: debug.tokens_in,
        output_tokens: debug.tokens_out,
        cost_usd_milli: milliCost,
        duration_ms: debug.duration_ms,
      });

      // Fire-and-forget: kick the agent worker so the role-specific work
      // happens within seconds. If this call doesn't complete (Vercel
      // function lifetime), pg_cron picks the ticket up within 60s.
      const agentToken = process.env.COCKPIT_AGENT_TOKEN;
      if (agentToken) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        fetch(
          `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://namkhan-bi.vercel.app"}/api/cockpit/agent/run?id=${inserted.id}`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${agentToken}` },
          },
        ).catch(() => {
          /* swallow — cron is the safety net */
        });
      }

      return NextResponse.json({
        ticket: { ...inserted, ...triage, status: "triaged" },
        triage,
      });
    } else {
      // Anthropic failed → mark ticket and surface error.
      await supabase
        .from("cockpit_tickets")
        .update({
          status: "triage_failed",
          arm: "ops",
          notes: JSON.stringify({ kind: "triage_failure", debug }),
        })
        .eq("id", inserted.id);

      return NextResponse.json(
        { ticket: inserted, error: "triage_failed", debug },
        { status: 502 },
      );
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}
