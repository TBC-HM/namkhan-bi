// app/api/cockpit/team/route.ts
// Reads the agent network from Postgres — single source of truth.
// Source: cockpit_agent_prompts (active=true) + cockpit_agent_skills + role_skills.
// Earlier filesystem-based implementation removed because the DB is now
// authoritative. New roles created via meta-mode in /cockpit appear here
// automatically with no deploy.

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key"
);

type RolePromptRow = {
  role: string;
  prompt: string;
  version: number;
  source: string;
  notes: string | null;
  updated_at: string;
  department: string;
};
type IdentityRow = { role: string; display_name: string; avatar: string; tagline: string | null; color: string | null };
type DeptRow = { slug: string; name: string; chief_role: string; description: string | null };

type SkillJoin = {
  role: string;
  enabled: boolean;
  cockpit_agent_skills:
    | { id: number; name: string; description: string; active: boolean }
    | { id: number; name: string; description: string; active: boolean }[];
};

type RecentRun = { agent: string; success: boolean; created_at: string };

// "Chief" displays at the top with a different visual; everything else is a worker.
const CHIEF_ROLES = new Set(["it_manager"]);

// Friendly display order for the UI.
const ROLE_ORDER = [
  "it_manager",
  "lead",
  "frontend",
  "backend",
  "designer",
  "researcher",
  "reviewer",
  "tester",
  "documentarian",
  "ops_lead",
  "code_spec_writer",
  "none",
];

export async function GET() {
  noStore();
  const [promptsRes, skillsJoinRes, runsRes, activeTicketsRes, costRes, identityRes, deptRes] = await Promise.all([
    supabase
      .from("cockpit_agent_prompts")
      .select("role, prompt, version, source, notes, updated_at, department")
      .eq("active", true),
    supabase
      .from("cockpit_agent_role_skills")
      .select("role, enabled, cockpit_agent_skills!inner(id, name, description, active)")
      .eq("enabled", true),
    supabase
      .from("cockpit_audit_log")
      .select("agent, success, created_at")
      // PBS 2026-05-09 architect bug #6: team page didn't show agents
      // working — the action whitelist was too narrow. Widened to include
      // chat / sweep / cron actions that fire most often today.
      .in("action", [
        "agent_run", "triage", "approve_and_spec", "meta_apply",
        "unified_chat_response", "ack_and_route", "promote_processing",
        "promote_done", "triage_fallback_markdown", "project_summarized",
        "meta_propose", "ticket_routed", "skill_invoke", "skill_call",
        // PBS 2026-05-10: include the agent_runner script's actions so the
        // team page reflects Carla actually working. Without these the page
        // looked idle even when the runner was processing tickets.
        "agent_run_start", "agent_run_pr_opened", "agent_run_no_edits",
        "agent_run_no_apply", "agent_run_failed", "agent_run_tsc_failed",
        "handoff_to_runner",
      ])
      .order("created_at", { ascending: false })
      .limit(400),
    supabase
      .from("cockpit_tickets")
      .select("id, status, arm")
      .in("status", ["triaging", "working"]),
    supabase
      .from("cockpit_audit_log")
      .select("agent, cost_usd_milli")
      .gte("created_at", new Date(Date.now() - 86400_000).toISOString())
      .not("cost_usd_milli", "is", null),
    supabase
      .from("cockpit_agent_identity")
      .select("role, display_name, avatar, tagline, color"),
    supabase
      .from("cockpit_departments")
      .select("slug, name, chief_role, description")
      .eq("active", true),
  ]);

  const prompts = (promptsRes.data ?? []) as RolePromptRow[];
  const skillsJoin = (skillsJoinRes.data ?? []) as unknown as SkillJoin[];
  const runs = (runsRes.data ?? []) as RecentRun[];
  const activeTickets = (activeTicketsRes.data ?? []) as { id: number; status: string; arm: string }[];
  const costRows = (costRes.data ?? []) as { agent: string; cost_usd_milli: number }[];

  // Map agent → currently-working tickets.
  const activeByAgent: Record<string, number[]> = {};
  for (const t of activeTickets) {
    // arm during triaging is 'triaging'; we attribute to it_manager. During 'working' the arm holds the role.
    const owner = t.status === "triaging" ? "it_manager" : t.arm;
    if (!activeByAgent[owner]) activeByAgent[owner] = [];
    activeByAgent[owner].push(t.id);
  }
  // Map agent → 24h cost in milli-USD.
  const costByAgent: Record<string, number> = {};
  for (const c of costRows) {
    costByAgent[c.agent] = (costByAgent[c.agent] ?? 0) + (c.cost_usd_milli ?? 0);
  }

  // Build skills map by role.
  const skillsByRole: Record<string, { id: number; name: string; description: string }[]> = {};
  for (const row of skillsJoin) {
    const s = Array.isArray(row.cockpit_agent_skills)
      ? row.cockpit_agent_skills[0]
      : row.cockpit_agent_skills;
    if (!s || !s.active) continue;
    if (!skillsByRole[row.role]) skillsByRole[row.role] = [];
    skillsByRole[row.role].push({ id: s.id, name: s.name, description: s.description });
  }

  // Build run stats by role.
  const stats: Record<string, { runs: number; ok: number; last_run_at: string | null }> = {};
  for (const r of runs) {
    if (!stats[r.agent]) stats[r.agent] = { runs: 0, ok: 0, last_run_at: null };
    stats[r.agent].runs += 1;
    if (r.success) stats[r.agent].ok += 1;
    if (!stats[r.agent].last_run_at || stats[r.agent].last_run_at! < r.created_at) {
      stats[r.agent].last_run_at = r.created_at;
    }
  }

  const identities = (identityRes.data ?? []) as IdentityRow[];
  const identityByRole: Record<string, IdentityRow> = {};
  for (const i of identities) identityByRole[i.role] = i;
  const departments = (deptRes.data ?? []) as DeptRow[];
  const deptChiefSet = new Set(departments.map((d) => d.chief_role));

  const agents = prompts
    .map((p) => {
      const rs = stats[p.role] ?? { runs: 0, ok: 0, last_run_at: null };
      const activeIds = activeByAgent[p.role] ?? [];
      const ident = identityByRole[p.role];
      return {
        name: p.role,
        display_name: ident?.display_name ?? roleHumanLabel(p.role),
        avatar: ident?.avatar ?? "🤖",
        tagline: ident?.tagline ?? p.notes ?? roleHumanLabel(p.role),
        color: ident?.color ?? null,
        is_chief: CHIEF_ROLES.has(p.role) || deptChiefSet.has(p.role),
        department: p.department ?? "it",
        role: p.notes ?? roleHumanLabel(p.role),
        version: p.version,
        prompt_source: p.source,
        last_updated: p.updated_at,
        skills: skillsByRole[p.role] ?? [],
        runs_24h: rs.runs,
        success_rate: rs.runs > 0 ? Math.round((100 * rs.ok) / rs.runs) : null,
        last_run_at: rs.last_run_at,
        state: activeIds.length > 0 ? "active" : deriveState(rs),
        workers: 1,
        active_ticket_ids: activeIds,
        cost_24h_usd: ((costByAgent[p.role] ?? 0) / 1000).toFixed(4),
      };
    })
    .sort((a, b) => {
      const ai = ROLE_ORDER.indexOf(a.name);
      const bi = ROLE_ORDER.indexOf(b.name);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  return NextResponse.json({ agents, departments });
}

function roleHumanLabel(role: string): string {
  const map: Record<string, string> = {
    it_manager: "Chief / IT Manager · routes everything",
    lead: "Senior engineer · decomposes features",
    frontend: "UI specialist · pages, components, styling",
    backend: "Schema, API, RLS, cron",
    designer: "Brand & design-system enforcement",
    researcher: "Data, metrics, investigation",
    reviewer: "Pre-build risk + tests-required",
    tester: "Test plans (unit / integration / e2e)",
    documentarian: "Docs, ADRs, runbooks",
    ops_lead: "Out-of-IT-scope handoff (Cloudbeds, accounting)",
    code_spec_writer: "Generates GH-issue-ready specs from approved tickets",
    none: "Generic dispatcher / fallback",
  };
  return map[role] ?? role;
}

function deriveState(rs: { runs: number; last_run_at: string | null }): "idle" | "active" | "attention" {
  if (rs.runs === 0) return "idle";
  if (!rs.last_run_at) return "idle";
  const ageMin = (Date.now() - new Date(rs.last_run_at).getTime()) / 60000;
  if (ageMin < 10) return "active";
  if (ageMin < 60 * 24) return "idle";
  return "attention";
}
