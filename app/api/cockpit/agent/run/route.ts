// app/api/cockpit/agent/run/route.ts
// Agent Worker — picks up triaged tickets and runs role-specific work.
//
// Two ways to invoke:
//   POST /api/cockpit/agent/run            (with bearer)  → process all queued
//   POST /api/cockpit/agent/run?id=<n>     (with bearer)  → process single ticket
//
// Auth: Bearer token in `Authorization: Bearer <COCKPIT_AGENT_TOKEN>`.
//       This is set by pg_cron (server-side) and by the chat route's
//       `waitUntil` follow-up call. Never exposed to the browser.
//
// Status flow on cockpit_tickets:
//   new → triaging → triaged → working → awaits_user | completed | blocked
//
// Each agent role reads the IT Manager's triage and produces deliverable
// output (research, design notes, test plan, doc draft, code spec). The
// worker does NOT write code, open PRs, or run migrations — that's the
// next-tier Dev Arm and explicitly out of scope for this v1.

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { loadSkillsForRole, dispatchSkill, dispatchSkillGated, type AgentToolDef } from "@/lib/cockpit-tools";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Triage = {
  arm: string;
  intent: string;
  urgency: string;
  summary: string;
  plan: string[];
  recommended_agent?: string;     // Kit ≤v11
  recommended_role?: string;       // Kit v12+ JSON contract
  blockers: string[];
  estimated_minutes?: number;
};

type AgentRole =
  | "researcher"
  | "designer"
  | "documentarian"
  | "reviewer"
  | "tester"
  | "ops_lead"
  | "lead"
  | "frontend"
  | "backend"
  | "architect"
  | "none";

const ROLE_PROMPTS: Record<AgentRole, string> = {
  researcher: `You are the Research Agent for Namkhan BI. Your job: read the IT Manager's triage, dig into the question, and return concrete findings.

The codebase is Next.js + Supabase (project ref kpenyneooigsyuuomgct). You don't have direct DB access in this turn — work from what's in the triage and ask sharp follow-up questions.

Output ONLY valid JSON, no markdown fence:
{
  "findings": ["fact 1 with reasoning", "fact 2"],
  "open_questions": ["specific question 1"],
  "recommended_next_step": "1-sentence concrete action",
  "data_sources_to_check": ["table.view or url"],
  "confidence": "low|medium|high"
}`,

  designer: `You are the Design Agent for Namkhan BI. The design system is locked (DESIGN_NAMKHAN_BI.md): Fraunces serif italic for KPI values, mono uppercase brass for headers, '$' for USD, '₭' for LAK, ISO dates, em-dash for empty cells. Canonical components: KpiBox, DataTable, StatusPill, PageHeader.

Read the IT Manager's triage, check the request against the locked design rules, and return:

Output ONLY valid JSON:
{
  "design_notes": ["1-line note"],
  "rule_violations_if_built_naively": ["specific risk"],
  "components_to_use": ["KpiBox|DataTable|..."],
  "components_to_avoid_creating": ["reason"],
  "approve_to_proceed": true|false,
  "blocking_questions": ["if any"]
}`,

  documentarian: `You are the Documentarian for Namkhan BI. The repo has DESIGN_NAMKHAN_BI.md, CLAUDE.md, cockpit/decisions/, and per-feature docs.

Read the triage and decide what doc(s) need to be written or updated. Be terse.

Output ONLY valid JSON:
{
  "docs_to_write": [{"path": "cockpit/decisions/00X-slug.md", "purpose": "why"}],
  "docs_to_update": [{"path": "DESIGN_NAMKHAN_BI.md", "section": "name"}],
  "draft_outline": ["section 1", "section 2"],
  "blocking_questions": []
}`,

  reviewer: `You are the Code Reviewer for Namkhan BI. Hard rules: no \`USD \` prefix (use \`$\`), no hardcoded fontSize, ISO dates, '−' for negatives, never delete files without ADR, RLS on all new tables, no secrets in commits.

Read the triage and flag risks BEFORE work starts.

Output ONLY valid JSON:
{
  "risks": [{"area": "name", "severity": "low|med|high", "note": "..."}],
  "blocking_concerns": ["if any"],
  "must_have_tests": ["test scenario"],
  "approve_to_proceed": true|false
}`,

  tester: `You are the Test Agent. Read the triage and produce a concrete test plan.

Output ONLY valid JSON:
{
  "unit_tests": ["test name + what it asserts"],
  "integration_tests": ["..."],
  "e2e_tests": ["..."],
  "regression_risks": ["areas to retest"],
  "tools_needed": ["jest|playwright|..."]
}`,

  ops_lead: `You are the Ops Lead. The request fell outside dev/design/research scope — it's operational (Cloudbeds config, Make.com, accounts, scheduling, accounting).

Read the triage and propose the operational handoff.

Output ONLY valid JSON:
{
  "owner": "PBS|external_partner|automation",
  "next_action": "1 sentence",
  "deps": ["external systems involved"],
  "estimated_minutes": 15,
  "blocking_questions": []
}`,

  none: `You are a generic dispatcher. The IT Manager flagged this ticket as having no specific agent owner.

Output ONLY valid JSON:
{
  "summary": "what should happen",
  "needs_human_decision": true|false,
  "open_questions": []
}`,

  lead: `You are the Lead Agent — decompose features into specialist tasks. Output ONLY JSON: {"tasks":[{"order":1,"owner":"frontend|backend|designer|tester|reviewer","title":"...","description":"...","estimated_minutes":15,"blockers":[]}],"critical_path":[1,2],"parallel_safe":[],"rollout_plan":"1 sentence","blocking_questions":[]}`,

  frontend: `You are the Frontend Agent. Output ONLY JSON: {"files_to_create":[],"files_to_edit":[],"components_to_use":[],"components_to_create":[],"data_sources":[],"design_system_compliance":[],"blocking_questions":[]}`,

  backend: `You are the Backend Agent. Output ONLY JSON: {"schema_changes":[],"api_routes_to_create":[],"edge_functions":[],"cron_jobs":[],"data_sources_consumed":[],"performance_notes":[],"blocking_questions":[]}`,

  architect: `Fallback Architect prompt — DB lookup should override this. Output JSON: {"summary_markdown":"...","triage":{"arm":"dev","intent":"decide","urgency":"low","recommended_role":"architect"},"needs_human_decision":false,"blocking_questions":[]}`,
};

function pickRole(triage: Triage): AgentRole {
  const candidate = (triage.recommended_role || triage.recommended_agent || "").toLowerCase();
  if ((Object.keys(ROLE_PROMPTS) as AgentRole[]).includes(candidate as AgentRole)) {
    return candidate as AgentRole;
  }
  if (candidate === "architect") return "architect";
  if (candidate === "it_manager") return "none"; // Kit answered directly
  // Fallback by arm.
  if (triage.arm === "research") return "researcher";
  if (triage.arm === "design") return "designer";
  if (triage.arm === "control") return "reviewer";
  if (triage.arm === "ops") return "ops_lead";
  if (triage.arm === "dev") return "lead";
  return "none";
}

async function loadRolePrompt(role: AgentRole): Promise<string> {
  const { data } = await supabase
    .from("cockpit_agent_prompts")
    .select("prompt")
    .eq("role", role)
    .eq("active", true)
    .single();
  return data?.prompt ?? ROLE_PROMPTS[role];
}

// Sonnet pricing as of 2026-05: $3/M input, $15/M output. Cost in milli-USD = ((in*3 + out*15) / 1000).
function calcMilliCost(inTok: number, outTok: number): number {
  return Math.round((inTok * 3 + outTok * 15) / 1000);
}

async function callRoleAgent(role: AgentRole, triage: Triage, originalMessage: string, ticketId: number | null = null): Promise<{
  result: Record<string, unknown>;
  trace: Array<{ tool: string; input: Record<string, unknown>; ok: boolean }>;
  tokens_in: number;
  tokens_out: number;
  cost_milli: number;
  duration_ms: number;
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");
  const t0 = Date.now();

  const userMsg = `IT Manager triage:
${JSON.stringify(triage, null, 2)}

Original request:
${originalMessage}`;

  const systemPrompt = await loadRolePrompt(role);
  const skills = await loadSkillsForRole(role);
  let totalIn = 0;
  let totalOut = 0;
  const trace: Array<{ tool: string; input: Record<string, unknown>; ok: boolean }> = [];

  // Build the Anthropic tools array. If no skills, falls back to a single
  // text-only call (same as before).
  const tools = skills.map((s) => ({
    name: s.name,
    description: s.description,
    input_schema: s.input_schema,
  }));

  // Tool-use loop. Up to 8 iterations — most agents need 4-6 tool calls
  // before producing the final structured output.
  type Msg = { role: "user" | "assistant"; content: unknown };
  const messages: Msg[] = [{ role: "user", content: userMsg }];
  let lastTextSeen = "";

  for (let iter = 0; iter < 8; iter++) {
    const body: Record<string, unknown> = {
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
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

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`anthropic ${res.status}: ${errText.slice(0, 200)}`);
    }

    const json = await res.json();
    const stopReason = json?.stop_reason as string | undefined;
    const blocks = (json?.content ?? []) as Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
    totalIn += json?.usage?.input_tokens ?? 0;
    totalOut += json?.usage?.output_tokens ?? 0;

    // If we hit any tool_use blocks, run them and feed results back.
    const toolUses = blocks.filter((b) => b.type === "tool_use");
    if (toolUses.length > 0 && stopReason === "tool_use") {
      // Append assistant's tool_use blocks to history.
      messages.push({ role: "assistant", content: blocks });
      // Dispatch each tool, build tool_result blocks.
      const handlerByName = new Map(skills.map((s) => [s.name, s.handler] as [string, string]));
      const toolResults: Array<{ type: string; tool_use_id: string; content: string }> = [];
      for (const tu of toolUses) {
        const handler = handlerByName.get(tu.name ?? "");
        let resultText: string;
        let ok = false;
        if (!handler) {
          resultText = JSON.stringify({ ok: false, error: `unknown skill: ${tu.name}` });
        } else {
          // Phase 1.2: gate every skill call through call_skill / complete_skill_call.
          const r = await dispatchSkillGated(role, tu.name ?? "", handler, tu.input ?? {}, ticketId);
          ok = r.ok;
          resultText = JSON.stringify(r).slice(0, 6000);
        }
        trace.push({ tool: tu.name ?? "?", input: tu.input ?? {}, ok });
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id ?? "",
          content: resultText,
        });
      }
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // No more tool_use → final text block.
    const textBlock = blocks.find((b) => b.type === "text");
    const text = textBlock?.text ?? "";
    if (text) lastTextSeen = text;
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    try {
      const parsed = JSON.parse(cleaned);
      if (typeof parsed === "object" && parsed !== null) {
        (parsed as Record<string, unknown>).__skill_calls = trace.length;
      }
      return {
        result: parsed,
        trace,
        tokens_in: totalIn,
        tokens_out: totalOut,
        cost_milli: calcMilliCost(totalIn, totalOut),
        duration_ms: Date.now() - t0,
      };
    } catch {
      return {
        result: { raw: text, parse_error: true },
        trace,
        tokens_in: totalIn,
        tokens_out: totalOut,
        cost_milli: calcMilliCost(totalIn, totalOut),
        duration_ms: Date.now() - t0,
      };
    }
  }

  // Hit iteration cap — return what we have rather than empty.
  return {
    result: {
      error: "tool_use loop hit iteration limit (8) — agent may need more tools or a tighter prompt",
      parse_error: true,
      raw: lastTextSeen.slice(0, 4000),
    },
    trace,
    tokens_in: totalIn,
    tokens_out: totalOut,
    cost_milli: calcMilliCost(totalIn, totalOut),
    duration_ms: Date.now() - t0,
  };
}

// Type-only: avoid TS complaint about unused import.
const _unused: AgentToolDef[] = [];
void _unused;

function renderResultMarkdown(role: AgentRole, result: Record<string, unknown>): string {
  const header = `**🤖 ${role.replace("_", " ")} agent**\n\n`;
  if (result.parse_error) {
    return header + "Agent returned non-JSON output:\n\n" + (result.raw as string);
  }
  return header + "```json\n" + JSON.stringify(result, null, 2) + "\n```";
}

function decideStatus(role: AgentRole, result: Record<string, unknown>): string {
  // If the agent flagged blocking questions or needs human decision, await user.
  const blocking = (result.blocking_questions ||
    result.blocking_concerns ||
    result.open_questions ||
    []) as unknown[];
  if (Array.isArray(blocking) && blocking.length > 0) return "awaits_user";
  if (result.needs_human_decision === true) return "awaits_user";
  if (result.approve_to_proceed === false) return "blocked";
  // Most agents produce advisory output → completed (the *advisory* part is done).
  return "completed";
}

const IT_MANAGER_SYSTEM_PROMPT = `You are the IT Manager for Namkhan BI — Next.js + Supabase business-intelligence app. Owner: PBS, hospitality data analyst.

Triage the request. Output ONLY a JSON object:
{
  "arm": "health|dev|control|design|research|ops",
  "intent": "build|fix|investigate|decide|monitor|document",
  "urgency": "low|medium|high|critical",
  "summary": "1-2 sentences",
  "plan": ["step 1", "step 2"],
  "recommended_agent": "designer|documentarian|researcher|reviewer|tester|ops_lead|none",
  "blockers": ["any open question"],
  "estimated_minutes": 15
}`;

async function triageMessageInline(message: string): Promise<Triage | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const { data: itPrompt } = await supabase
    .from("cockpit_agent_prompts")
    .select("prompt")
    .eq("role", "it_manager")
    .eq("active", true)
    .single();
  const systemPrompt = itPrompt?.prompt ?? IT_MANAGER_SYSTEM_PROMPT;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: "user", content: message }],
    }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  const text = json?.content?.[0]?.text ?? "";
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned) as Triage;
  } catch {
    return null;
  }
}

async function triageNewTicket(ticketId: number, ticket: Record<string, unknown>) {
  const message =
    (ticket.email_body as string) ||
    (ticket.parsed_summary as string) ||
    "(no message)";
  const triage = await triageMessageInline(message);
  if (!triage) {
    await supabase
      .from("cockpit_tickets")
      .update({ status: "triage_failed", arm: "ops" })
      .eq("id", ticketId);
    await supabase.from("cockpit_audit_log").insert({
      ticket_id: ticketId,
      agent: "it_manager",
      action: "triage",
      target: `ticket:${ticketId}`,
      success: false,
      reasoning: "Anthropic call failed or returned non-JSON",
    });
    return { ticketId, stage: "triage", error: "anthropic_failed" };
  }

  const summary = [
    `**Source**: ${ticket.source ?? "unknown"}`,
    "",
    `**Triage** — ${triage.arm} · ${triage.intent} · urgency ${triage.urgency} · ~${triage.estimated_minutes} min`,
    "",
    triage.summary,
    "",
    "**Plan**",
    ...triage.plan.map((s, i) => `${i + 1}. ${s}`),
    triage.blockers?.length ? `\n**Blockers**\n${triage.blockers.map((b) => `- ${b}`).join("\n")}` : "",
    `\n_Recommended agent: ${triage.recommended_agent}_`,
  ].join("\n");

  await supabase
    .from("cockpit_tickets")
    .update({
      arm: triage.arm,
      intent: triage.intent,
      status: "triaged",
      parsed_summary: summary,
      notes: JSON.stringify(triage),
    })
    .eq("id", ticketId);

  await supabase.from("cockpit_audit_log").insert({
    ticket_id: ticketId,
    agent: "it_manager",
    action: "triage",
    target: `ticket:${ticketId}`,
    success: true,
    metadata: { triage, model: "claude-sonnet-4-6" },
    reasoning: triage.summary,
  });

  return { ticketId, stage: "triage", arm: triage.arm, status: "triaged" };
}

async function processTicket(ticketId: number) {
  const { data: ticket, error: fetchErr } = await supabase
    .from("cockpit_tickets")
    .select("*")
    .eq("id", ticketId)
    .single();

  if (fetchErr || !ticket) {
    return { ticketId, error: fetchErr?.message ?? "ticket not found" };
  }

  // Stage 1: tickets that haven't been triaged yet (came from email or webhook).
  if (ticket.status === "new" || ticket.status === "triaging") {
    return await triageNewTicket(ticketId, ticket);
  }

  if (ticket.status !== "triaged") {
    return { ticketId, skipped: `status=${ticket.status}` };
  }

  let triage: Triage | null = null;
  try {
    triage = JSON.parse(ticket.notes ?? "{}");
  } catch {
    return { ticketId, error: "could not parse triage from notes" };
  }
  if (!triage || !triage.recommended_agent) {
    return { ticketId, error: "triage missing recommended_agent" };
  }

  // Mark working so duplicate cron runs skip it.
  await supabase
    .from("cockpit_tickets")
    .update({ status: "working", iterations: (ticket.iterations ?? 0) + 1 })
    .eq("id", ticketId);

  const role = pickRole(triage);
  const originalMessage = (ticket.parsed_summary ?? "").split("\n")[0] || ticket.email_body || "";

  let runOutcome: Awaited<ReturnType<typeof callRoleAgent>>;
  try {
    runOutcome = await callRoleAgent(role, triage, originalMessage, ticketId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("cockpit_tickets")
      .update({ status: "triage_failed", notes: JSON.stringify({ ...triage, agent_error: msg }) })
      .eq("id", ticketId);
    await supabase.from("cockpit_audit_log").insert({
      ticket_id: ticketId,
      agent: role,
      action: "agent_run",
      target: `ticket:${ticketId}`,
      success: false,
      reasoning: msg,
    });
    return { ticketId, error: msg };
  }

  const result = runOutcome.result;
  const newStatus = decideStatus(role, result);
  const traceSummary = runOutcome.trace.length > 0
    ? `\n\n_Tools called: ${runOutcome.trace.map((t) => `\`${t.tool}\`${t.ok ? "" : "❌"}`).join(", ")} · ${runOutcome.duration_ms}ms · ${runOutcome.tokens_in}+${runOutcome.tokens_out} tok · $${(runOutcome.cost_milli / 1000).toFixed(4)}_`
    : "";
  const newSummary =
    (ticket.parsed_summary ?? "") +
    "\n\n---\n" +
    renderResultMarkdown(role, result) +
    traceSummary;

  await supabase
    .from("cockpit_tickets")
    .update({
      status: newStatus,
      parsed_summary: newSummary.slice(0, 8000),
      notes: JSON.stringify({ triage, [`${role}_result`]: result, trace: runOutcome.trace }),
    })
    .eq("id", ticketId);

  await supabase.from("cockpit_audit_log").insert({
    ticket_id: ticketId,
    agent: role,
    action: "agent_run",
    target: `ticket:${ticketId}`,
    success: true,
    metadata: { role, result, model: "claude-sonnet-4-6" },
    reasoning: typeof result.recommended_next_step === "string"
      ? result.recommended_next_step
      : `${role} produced advisory output`,
    input_tokens: runOutcome.tokens_in,
    output_tokens: runOutcome.tokens_out,
    cost_usd_milli: runOutcome.cost_milli,
    tool_trace: runOutcome.trace,
    duration_ms: runOutcome.duration_ms,
  });

  return { ticketId, role, status: newStatus };
}

function checkBearer(req: Request): boolean {
  const expected = process.env.COCKPIT_AGENT_TOKEN;
  if (!expected) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${expected}`;
}

export async function POST(req: Request) {
  noStore();
  if (!checkBearer(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const idParam = url.searchParams.get("id");

  // Single-ticket mode.
  if (idParam) {
    const id = Number(idParam);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "invalid id" }, { status: 400 });
    }
    const result = await processTicket(id);
    return NextResponse.json(result);
  }

  // Queue-drain mode — process up to 5 tickets per call.
  // 'new' = needs triage (came from email/webhook).
  // 'triaged' = needs agent work.
  // 'triaging' is the synchronous-chat-route transient state — we skip it
  // here to avoid racing with the chat route's own triage call.
  const { data: queued, error } = await supabase
    .from("cockpit_tickets")
    .select("id")
    .in("status", ["new", "triaged"])
    .order("created_at", { ascending: true })
    .limit(5);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!queued || queued.length === 0) {
    return NextResponse.json({ processed: 0, queued: 0 });
  }

  const results = [];
  for (const row of queued) {
    results.push(await processTicket(row.id));
  }

  return NextResponse.json({
    processed: results.length,
    results,
  });
}

export async function GET(req: Request) {
  if (!checkBearer(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { count } = await supabase
    .from("cockpit_tickets")
    .select("id", { count: "exact", head: true })
    .eq("status", "triaged");
  return NextResponse.json({ queue_depth: count ?? 0 });
}
