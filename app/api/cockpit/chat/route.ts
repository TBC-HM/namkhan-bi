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
import { loadSkillsForRole, dispatchSkill, dispatchSkillGated } from "@/lib/cockpit-tools";

// ─── Unified-chat enrichment (KB #291) — added 2026-05-07 ──────────────────
// Every chat request gets:
//   • KB top-5 (semantic, via existing read_knowledge_base_semantic skill)
//   • Doc top-5 (ILIKE fallback over documentation.documents — no embeddings yet)
//   • Page data (route → view map, queried live)
//   • Active doc (if user passed active_doc_id)
//   • Recent tickets (last 5)
// The block is injected into the user message so the IT Manager prompt sees it.

const NICKNAME_TO_ROLE: Record<string, string> = {
  architect: "architect",
  kit: "it_manager", felix: "lead", olive: "ops_lead", sage: "backend",
  pia: "frontend", bea: "designer", carla: "code_writer", sergei: "security",
  quinn: "tester", scott: "documentarian", anders: "api_specialist",
  astra: "skill_creator", data: "researcher", sigma: "reviewer", quincy: "code_spec_writer",
  vector: "revenue_hod", mercer: "sales_hod", lumen: "marketing_hod",
  forge: "operations_hod", intel: "finance_hod",
};

function parseMention(text: string): string | null {
  const m = text.match(/^@([a-z][a-z0-9_]*)/i);
  if (!m) return null;
  const key = m[1].toLowerCase();
  return NICKNAME_TO_ROLE[key] ?? null;
}

const ROUTE_TO_VIEW: Record<string, string> = {
  "/revenue/pulse": "v_overview_kpis",
  "/revenue/pace": "v_tactical_alerts_top",
  "/revenue/channels": "v_overview_kpis",
  "/revenue/parity": "v_tactical_alerts_top",
  "/revenue/agents": "cockpit_audit_log",
  "/revenue-v2": "v_overview_kpis",
  "/revenue-v2/pulse": "v_overview_kpis",
  "/revenue-v2/parity": "v_tactical_alerts_top",
  "/sales/inquiries": "v_unanswered_threads",
  "/cockpit": "cockpit_tickets",
  "/cockpit/it-digest": "v_it_weekly_digest",
};

async function gatherEnrichment(args: {
  message: string;
  current_page_url?: string;
  active_doc_id?: string;
}): Promise<Record<string, unknown>> {
  const { message, current_page_url, active_doc_id } = args;

  const [kbRes, docs, pageData, activeDoc, recent] = await Promise.all([
    // KB semantic top 5 — uses the existing skill that wraps embed-kb + match
    dispatchSkill("read_knowledge_base_semantic", { query: message, limit: 5 })
      .catch(() => ({ ok: false })),
    // Docs top 5 — try semantic via match_documents RPC first; fall back to ILIKE if no embeddings yet.
    (async () => {
      // 1. Try semantic search using existing embed-kb edge function for the query embedding
      try {
        const embedRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/embed-kb`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ mode: "embed_query", query: message.slice(0, 800) }),
        });
        if (embedRes.ok) {
          const { embedding } = await embedRes.json();
          if (Array.isArray(embedding) && embedding.length === 384) {
            const { data: semantic } = await supabase.rpc("match_documents", {
              p_query_embedding: embedding,
              p_match_count: 5,
              p_min_similarity: 0.4,
            });
            if (semantic && semantic.length > 0) return semantic;
          }
        }
      } catch { /* fall through to ILIKE */ }
      // 2. ILIKE fallback (when embeddings not yet populated)
      const { data } = await supabase
        .schema("documentation")
        .from("documents")
        .select("id, title, doc_type, status, version, last_updated_at")
        .in("status", ["published", "approved"])
        .or(`title.ilike.%${message.slice(0, 80)}%,content_md.ilike.%${message.slice(0, 80)}%`)
        .limit(5);
      return data ?? [];
    })(),
    fetchPageData(current_page_url),
    fetchActiveDoc(active_doc_id),
    supabase
      .from("cockpit_tickets")
      .select("id, status, arm, intent, parsed_summary, updated_at")
      .order("updated_at", { ascending: false })
      .limit(5)
      .then((r) => r.data ?? []),
  ]);

  const kb_top5: unknown[] = (kbRes && typeof kbRes === "object" && "result" in kbRes)
    ? (((kbRes as { result?: { rows?: unknown[]; matches?: unknown[] } }).result?.rows
        ?? (kbRes as { result?: { matches?: unknown[] } }).result?.matches ?? []) as unknown[])
    : [];

  return {
    kb_top5,
    doc_top5: docs,
    page_data: pageData,
    active_doc: activeDoc,
    recent_tickets: recent,
  };
}

async function fetchPageData(currentPageUrl?: string): Promise<{ view: string; rows: unknown[] } | null> {
  if (!currentPageUrl) return null;
  let path = currentPageUrl;
  try { path = new URL(currentPageUrl).pathname; } catch { /* already a path */ }
  const view = ROUTE_TO_VIEW[path];
  if (!view) return null;
  const { data, error } = await supabase.from(view).select("*").limit(20);
  if (error) return null;
  return { view, rows: data ?? [] };
}

async function fetchActiveDoc(docId?: string): Promise<Record<string, unknown> | null> {
  if (!docId) return null;
  const { data } = await supabase
    .schema("documentation")
    .from("documents")
    .select("id, title, doc_type, content_md, version, status, last_updated_at")
    .eq("id", docId)
    .single();
  return data ?? null;
}

function renderEnrichmentBlock(ctx: Record<string, unknown>, currentPageUrl?: string): string {
  const lines: string[] = ["═══════════ ENRICHED CONTEXT (KB #291) ═══════════"];

  if (currentPageUrl) lines.push(`Current page: ${currentPageUrl}`);

  const kb = (ctx.kb_top5 as Array<{ id?: number; topic?: string; key_fact?: string; similarity?: number }>) ?? [];
  if (kb.length > 0) {
    lines.push("\n— KB top 5 (semantic) —");
    for (const e of kb) {
      const sim = typeof e.similarity === "number" ? ` (sim ${e.similarity.toFixed(2)})` : "";
      const fact = (e.key_fact ?? "").slice(0, 240).replace(/\s+/g, " ");
      lines.push(`  • #${e.id} ${e.topic ?? ""}${sim}: ${fact}`);
    }
  }

  const docs = (ctx.doc_top5 as Array<{ id?: string; title?: string; doc_type?: string; version?: number }>) ?? [];
  if (docs.length > 0) {
    lines.push("\n— Doc top 5 (ILIKE) —");
    for (const d of docs) lines.push(`  • [${d.doc_type}] ${d.title} (v${d.version}) — id ${d.id}`);
  }

  const page = ctx.page_data as { view?: string; rows?: unknown[] } | null;
  if (page) lines.push(`\n— Page data — view ${page.view}, ${page.rows?.length ?? 0} rows attached`);

  const active = ctx.active_doc as { title?: string; version?: number } | null;
  if (active) lines.push(`\n— Active doc — "${active.title}" (v${active.version})`);

  const tickets = (ctx.recent_tickets as Array<{ id?: number; status?: string; arm?: string; intent?: string; parsed_summary?: string }>) ?? [];
  if (tickets.length > 0) {
    lines.push("\n— Recent tickets (last 5) —");
    for (const t of tickets) {
      const sum = (t.parsed_summary ?? "").split("\n")[0]?.slice(0, 100) ?? "";
      lines.push(`  • #${t.id} [${t.status}/${t.arm}/${t.intent}] ${sum}`);
    }
  }

  lines.push("════════════════════════════════════════════════════");
  return lines.join("\n");
}

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

async function triageMessage(message: string, debug: { iterations: number; lastError: string | null; lastText: string | null; tokens_in: number; tokens_out: number; duration_ms: number } = { iterations: 0, lastError: null, lastText: null, tokens_in: 0, tokens_out: 0, duration_ms: 0 }, conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>): Promise<Triage | null> {
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
  // Prepend last 20 turns of conversation history if provided (KB #291).
  const history: Msg[] = (conversationHistory ?? []).slice(-20).map((h) => ({ role: h.role, content: h.content }));
  const messages: Msg[] = [...history, { role: "user", content: message }];

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
          // Phase 1.2: gate every skill call through call_skill / complete_skill_call.
          // Triage runs as it_manager; ticket_id not available here yet (chat creates it post-triage).
          const r = await dispatchSkillGated("it_manager", tu.name ?? "", handler, tu.input ?? {}, null);
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
      const parsed = JSON.parse(cleaned) as Record<string, unknown>;

      // v12+ contract: { summary_markdown, triage:{arm,intent,urgency,recommended_role}, needs_human_decision, blocking_questions }
      // Detect by presence of nested triage + summary_markdown.
      if (parsed && typeof parsed === "object" && parsed.triage && typeof parsed.triage === "object" && typeof parsed.summary_markdown === "string") {
        const inner = parsed.triage as Record<string, unknown>;
        const sm = parsed.summary_markdown as string;
        const blocking = Array.isArray(parsed.blocking_questions) ? (parsed.blocking_questions as string[]) : [];
        const t: Triage = {
          arm: typeof inner.arm === "string" ? inner.arm : "ops",
          intent: typeof inner.intent === "string" ? inner.intent : "decide",
          urgency: typeof inner.urgency === "string" ? inner.urgency : "low",
          summary: sm.split("\n").find((l) => l.trim().length > 0)?.slice(0, 240) ?? "Captain Kit answer",
          plan: ["Direct answer rendered in summary_markdown."],
          recommended_agent: typeof inner.recommended_role === "string" ? inner.recommended_role : "none",
          blockers: blocking,
          estimated_minutes: 0,
        };
        // Stash full markdown so renderer surfaces it.
        (t as Triage & { summary_markdown?: string }).summary_markdown = sm;
        (t as Triage & { needs_human_decision?: boolean }).needs_human_decision = !!parsed.needs_human_decision;
        return t;
      }

      // Legacy contract — pass through.
      return parsed as unknown as Triage;
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

// PBS directive 2026-05-07 — agents must never bounce. If the reply contains
// any of these phrases, scrub them and post a one-line "auto-handled" note
// instead. The runner will pick up context from prior tickets on next pass.
const BOUNCE_PATTERNS: RegExp[] = [
  /what is the (actual )?problem/i,
  /what does ['']?done['']? look like/i,
  /cannot (write|raise|execute) (a |the )?(spec|ticket|fix)/i,
  /please (tell me|paste|describe|provide)/i,
  /no prior (thread )?context/i,
  /you should (go|run|click|paste|rotate|update|set)/i,
  /should i (raise|open|create|escalate|route)/i,
  /shall i (raise|open|create|escalate)/i,
  /want me to (raise|open|create|escalate)/i,
  /awaiting your (go-ahead|approval|input|direction)/i,
  /requires (a )?human (to )?(toggle|click|approve)/i,
];

function detectBounce(text: string): { isBounce: boolean; matched: string[] } {
  const matched: string[] = [];
  for (const p of BOUNCE_PATTERNS) {
    const m = text.match(p);
    if (m) matched.push(m[0]);
  }
  return { isBounce: matched.length >= 2, matched }; // 2+ matches = systemic bounce, not incidental
}

function renderTriageMarkdown(t: Triage, originalMessage: string): string {
  // v12+ Kit contract: summary_markdown is the full answer — render it directly,
  // append a one-line triage trailer for transparency.
  const sm = (t as Triage & { summary_markdown?: string }).summary_markdown;
  if (sm && sm.trim().length > 0) {
    const blockerLines = (t.blockers ?? []).filter(Boolean).map((s) => `- ${s}`).join("\n");
    return [
      `**Request**: ${originalMessage}`,
      "",
      sm.trim(),
      blockerLines ? `\n**Blocking questions**\n${blockerLines}` : "",
      `\n_— ${t.arm} · ${t.intent} · urgency ${t.urgency} · → ${t.recommended_agent}_`,
    ].join("\n");
  }
  // Legacy contract (Kit ≤v11) — preserve original triage layout.
  const planLines = t.plan.map((s, i) => `${i + 1}. ${s}`).join("\n");
  const blockerLines = (t.blockers ?? []).filter(Boolean).map((s) => `- ${s}`).join("\n");
  return [
    `**Request**: ${originalMessage}`,
    "",
    `**Triage** — ${t.arm} · ${t.intent} · urgency ${t.urgency}`,
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
  // OPEN MODE — auth gate disabled per PBS. Re-enable with COCKPIT_AUTH_GATE=on.
  if (process.env.COCKPIT_AUTH_GATE !== "on") return true;
  const cookie = req.headers.get("cookie") ?? "";
  if (/workspace_session=/.test(cookie)) return true;
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
    const body = await req.json();
    const { message, current_page_url, active_doc_id, mention: mentionFromUI, conversation_history } = body as {
      message?: string;
      current_page_url?: string;
      active_doc_id?: string;
      mention?: string;
      conversation_history?: Array<{ role: "user" | "assistant"; content: string }>;
    };
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }

    // KB #291 unified-chat enrichment — gathered up-front so triage + worker
    // both see the full context. Server-side parsing of @mention as a fallback
    // when the client doesn't send one.
    const mention = mentionFromUI ?? parseMention(message);
    const enriched = await gatherEnrichment({ message, current_page_url, active_doc_id });
    const enrichmentBlock = renderEnrichmentBlock(enriched, current_page_url);
    const mentionHint = mention
      ? `\n[USER ADDRESSED: @${mention}] — set recommended_role="${mention}".`
      : "";
    const enrichedMessage = `${enrichmentBlock}\n\nUSER MESSAGE:\n${message}${mentionHint}`;

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

    // 2. Triage via Anthropic (IT Manager role) — feeding the enriched message
    //    so Kit can cite KB, see page data, recent tickets, active doc.
    const debug = { iterations: 0, lastError: null as string | null, lastText: null as string | null, tokens_in: 0, tokens_out: 0, duration_ms: 0 };
    const triage = await triageMessage(enrichedMessage, debug, conversation_history);
    if (triage && mention) {
      // @mention overrides whatever Kit recommended.
      (triage as Triage).recommended_agent = mention;
    }

    // 3. UPDATE — realtime subscriber on /cockpit will pick this up.
    if (triage) {
      let summary = renderTriageMarkdown(triage, message);
      // Bounce-detection: scrub bouncing language and substitute a plain action message.
      // PBS directive 2026-05-07 — agents must never bounce.
      const bounce = detectBounce(summary);
      if (bounce.isBounce) {
        summary = `**Hallo Paul** — picked this up.\n\n` +
          `(Triage agent's draft contained ${bounce.matched.length} bouncing phrases — auto-scrubbed.) ` +
          `I'm pulling context from the recent ticket history and routing to the right specialist now. ` +
          `If something genuinely needs your input I'll tag it 🟡 Needs you with a single one-line ask, never a 4-question quiz.\n\n` +
          `Verify on the Pulse tab in /cockpit/docs.`;
        triage.recommended_agent = triage.recommended_agent || "it_manager";
        (triage as Triage & { __bounce_detected?: boolean }).__bounce_detected = true;
        (triage as Triage & { __bounce_matched?: string[] }).__bounce_matched = bounce.matched;
        await supabase.from("cockpit_audit_log").insert({
          agent: "chat-bounce-filter",
          action: "bounce_scrubbed",
          target: `ticket:${inserted.id}`,
          success: true,
          metadata: { matched: bounce.matched },
          reasoning: "Reply contained bouncing language. Substituted with auto-handled message per PBS directive.",
        });
      }
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

      // Audit trail with cost + enrichment counts (KB #291).
      const milliCost = Math.round((debug.tokens_in * 3 + debug.tokens_out * 15) / 1000);
      await supabase.from("cockpit_audit_log").insert({
        ticket_id: inserted.id,
        agent: "it_manager",
        action: "unified_chat_response",
        target: `ticket:${inserted.id}`,
        success: true,
        metadata: {
          triage,
          model: "claude-sonnet-4-6",
          debug,
          mention_used: !!mention,
          mention_role: mention,
          had_page_data: !!(enriched.page_data),
          had_active_doc: !!(enriched.active_doc),
          kb_top5_count: Array.isArray(enriched.kb_top5) ? (enriched.kb_top5 as unknown[]).length : 0,
          doc_top5_count: Array.isArray(enriched.doc_top5) ? (enriched.doc_top5 as unknown[]).length : 0,
          current_page_url: current_page_url ?? null,
        },
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
        // 2026-05-07 — was eslint-disable-next-line @typescript-eslint/no-floating-promises
        // but plugin isn't installed; void operator gives the same effect cleanly.
        void fetch(
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
      // Triage parse failed. Defensive fallback: if the model produced a
      // substantive markdown answer (Captain Kit answered the user directly
      // instead of emitting JSON triage), wrap it as a direct-answer ticket
      // with the markdown surfaced via parsed_summary so the user sees the
      // actual response — a 502 hides a perfectly good answer.
      const fallbackText = (debug.lastText ?? "").trim();
      const looksLikeAnswer =
        fallbackText.length >= 120 &&
        (/^#{1,6}\s/m.test(fallbackText) ||      // markdown headings
          /^\s*[-*]\s/m.test(fallbackText) ||    // bullets
          /\|.*\|/.test(fallbackText));          // tables

      if (looksLikeAnswer) {
        const fakeTriage: Triage = {
          arm: "ops",
          intent: "decide",
          urgency: "low",
          summary: "Direct answer (model emitted markdown, not triage JSON).",
          plan: ["Direct answer rendered below."],
          recommended_agent: "none",
          blockers: [],
          estimated_minutes: 0,
        };
        const fallbackSummary = `**Request**: ${message}\n\n${fallbackText}`;
        await supabase
          .from("cockpit_tickets")
          .update({
            arm: "ops",
            intent: "decide",
            status: "triaged",
            parsed_summary: fallbackSummary,
            notes: JSON.stringify({ kind: "direct_answer_fallback", debug }),
          })
          .eq("id", inserted.id);
        const milliCost = Math.round((debug.tokens_in * 3 + debug.tokens_out * 15) / 1000);
        await supabase.from("cockpit_audit_log").insert({
          ticket_id: inserted.id,
          agent: "it_manager",
          action: "triage_fallback_markdown",
          target: `ticket:${inserted.id}`,
          success: true,
          metadata: { kind: "direct_answer_fallback", debug },
          reasoning: "Model returned markdown instead of triage JSON. Treated text as direct answer.",
          input_tokens: debug.tokens_in,
          output_tokens: debug.tokens_out,
          cost_usd_milli: milliCost,
          duration_ms: debug.duration_ms,
        });
        return NextResponse.json({
          ticket: { ...inserted, ...fakeTriage, status: "triaged", parsed_summary: fallbackSummary },
          triage: fakeTriage,
          fallback: "direct_answer_markdown",
        });
      }

      // True triage failure (no answer, no JSON) → mark + 502.
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
