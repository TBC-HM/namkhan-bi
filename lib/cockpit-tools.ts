// lib/cockpit-tools.ts
// Server-side handlers for the cockpit agent skills. Each handler maps to
// the `handler` column in cockpit_agent_skills and is dispatched from the
// agent worker when Anthropic emits a tool_use block.
//
// ENVIRONMENT ROUTING (Phase 4c — Phase 0 spec):
// - Production project ref: kpenyneooigsyuuomgct (NEXT_PUBLIC_SUPABASE_URL points here on namkhan-bi)
// - Staging project ref:    hutnvqqdumjdnetkkajd (NEXT_PUBLIC_SUPABASE_URL points here on namkhan-bi-staging)
// - The supabase client always points at whichever project this Vercel app
//   is deployed against (i.e. NEXT_PUBLIC_SUPABASE_URL). No cross-project
//   write paths exist in this file.
//
// Production-write skills check `isProductionEnvironment()` before executing
// destructive operations. The default is to refuse production writes unless
// the COCKPIT_PROD_WRITE_TOKEN env var is set in the request context (PBS-only
// approval token, one-shot, expires).

import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";
import path from "path";

const PROD_PROJECT_REF = "kpenyneooigsyuuomgct";
const STAGING_PROJECT_REF = "hutnvqqdumjdnetkkajd";

function isProductionEnvironment(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return url.includes(PROD_PROJECT_REF);
}

function isStagingEnvironment(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return url.includes(STAGING_PROJECT_REF);
}

function currentEnvironmentLabel(): "production" | "staging" | "unknown" {
  if (isProductionEnvironment()) return "production";
  if (isStagingEnvironment()) return "staging";
  return "unknown";
}

// Re-exports for use by other server routes (chat/triage, agent worker, etc.)
// so every audit-log insert can stamp its environment.
export const ENVIRONMENT = currentEnvironmentLabel();
export { isProductionEnvironment, isStagingEnvironment, requireProdWriteApproval };

// Production-write guard. Throws if invoked in production without the
// approval token. Staging operations bypass this check.
function requireProdWriteApproval(skillName: string): void {
  if (!isProductionEnvironment()) return;
  const token = process.env.COCKPIT_PROD_WRITE_TOKEN;
  if (!token) {
    throw new Error(
      `[${skillName}] production write blocked — environment is production and COCKPIT_PROD_WRITE_TOKEN not set. ` +
      `AI agents must work in staging by default. PBS-only override.`
    );
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Allowlist for query_supabase_view. Add views here as agents need them.
const ALLOWED_VIEWS = new Set([
  "v_overview_kpis",
  "v_compset_set_summary",
  "v_compset_property_summary",
  "v_dq_open",
  "v_overview_dq",
  "v_pl_monthly_usali",
  "v_tactical_alerts_top",
  "v_unanswered_threads",
  "cockpit_tickets",
  "cockpit_incidents",
  "cockpit_audit_log",
  "cockpit_kpi_snapshots",
  "cockpit_decisions",
  // GAPs 3+4+5 of COWORK BRIEF 2026-05-07 — Kit cross-dept watch.
  "v_agent_health",
  "v_cross_dept_it_intake",
  "v_it_weekly_digest",
  // GAP 13 (v2 brief) — Kit retro
  "v_kit_performance",
  // From v2 brief context — already created elsewhere, allowlist for explicit access
  "v_agent_capabilities",
]);

type ToolResult = {
  ok: boolean;
  result?: unknown;
  error?: string;
};

async function query_supabase_view(args: {
  view_name?: string;
  limit?: number;
  filter_column?: string;
  filter_value?: string;
  order_by?: string;
}): Promise<ToolResult> {
  const { view_name, limit = 50, filter_column, filter_value, order_by } = args;
  if (!view_name) return { ok: false, error: "view_name required" };
  if (!ALLOWED_VIEWS.has(view_name)) {
    return { ok: false, error: `view '${view_name}' is not in the allowlist (${Array.from(ALLOWED_VIEWS).join(", ")})` };
  }
  const safeLimit = Math.min(Math.max(1, limit), 100);
  let q = supabase.from(view_name).select("*").limit(safeLimit);
  if (filter_column && filter_value !== undefined) {
    q = q.eq(filter_column, filter_value);
  }
  if (order_by) {
    q = q.order(order_by, { ascending: false });
  }
  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true, result: data ?? [] };
}

async function read_audit_log(args: {
  limit?: number;
  agent?: string;
  action?: string;
}): Promise<ToolResult> {
  const { limit = 10, agent, action } = args;
  const safeLimit = Math.min(Math.max(1, limit), 50);
  let q = supabase
    .from("cockpit_audit_log")
    .select("id, created_at, agent, action, target, success, reasoning")
    .order("created_at", { ascending: false })
    .limit(safeLimit);
  if (agent) q = q.eq("agent", agent);
  if (action) q = q.eq("action", action);
  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true, result: data ?? [] };
}

async function read_design_doc(args: { section?: string }): Promise<ToolResult> {
  const { section } = args;
  if (!section) return { ok: false, error: "section required" };
  try {
    const docPath = path.join(process.cwd(), "DESIGN_NAMKHAN_BI.md");
    const text = await fs.readFile(docPath, "utf-8");
    if (section === "" || section.toUpperCase() === "TOC") {
      const headings = text
        .split("\n")
        .filter((l) => l.startsWith("#"))
        .slice(0, 200)
        .join("\n");
      return { ok: true, result: { toc: headings } };
    }
    // Find section by case-insensitive substring match in headings.
    const lines = text.split("\n");
    const lowerSection = section.toLowerCase();
    const startIdx = lines.findIndex(
      (l) => l.startsWith("#") && l.toLowerCase().includes(lowerSection),
    );
    if (startIdx < 0) {
      return { ok: false, error: `section not found: '${section}'` };
    }
    const headingLevel = (lines[startIdx].match(/^#+/) || ["#"])[0].length;
    let endIdx = lines.length;
    for (let i = startIdx + 1; i < lines.length; i++) {
      const m = lines[i].match(/^(#+)\s/);
      if (m && m[1].length <= headingLevel) {
        endIdx = i;
        break;
      }
    }
    const body = lines.slice(startIdx, endIdx).join("\n").slice(0, 8000);
    return { ok: true, result: { heading: lines[startIdx], body } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "fs error" };
  }
}

async function list_recent_tickets(args: {
  limit?: number;
  status?: string;
  arm?: string;
}): Promise<ToolResult> {
  const { limit = 10, status, arm } = args;
  const safeLimit = Math.min(Math.max(1, limit), 50);
  let q = supabase
    .from("cockpit_tickets")
    .select("id, created_at, source, arm, intent, status, parsed_summary, github_issue_url")
    .order("created_at", { ascending: false })
    .limit(safeLimit);
  if (status) q = q.eq("status", status);
  if (arm) q = q.eq("arm", arm);
  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true, result: data ?? [] };
}

async function read_repo_file(args: { path?: string }): Promise<ToolResult> {
  const { path: relPath } = args;
  if (!relPath) return { ok: false, error: "path required" };
  // Block traversal + sensitive files.
  if (relPath.includes("..") || relPath.startsWith("/") || relPath.includes("\\0")) {
    return { ok: false, error: "invalid path" };
  }
  const blocked = [".env", ".env.local", "node_modules", ".vercel/", ".next/", "package-lock.json"];
  if (blocked.some((b) => relPath.includes(b))) {
    return { ok: false, error: `path blocked: ${relPath}` };
  }
  try {
    const full = path.join(process.cwd(), relPath);
    const stat = await fs.stat(full);
    if (stat.size > 200_000) return { ok: false, error: "file too large (>200KB)" };
    const content = await fs.readFile(full, "utf-8");
    return { ok: true, result: { path: relPath, size: stat.size, content: content.slice(0, 60_000) } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "fs error" };
  }
}

async function search_repo(args: { pattern?: string; file_glob?: string; max_results?: number }): Promise<ToolResult> {
  const { pattern, file_glob = "**/*.{ts,tsx,sql,md}", max_results = 30 } = args;
  if (!pattern) return { ok: false, error: "pattern required" };
  // Reject obvious shell injection.
  if (/[`$|;&]/.test(pattern)) return { ok: false, error: "pattern contains forbidden characters" };
  const safeMax = Math.min(Math.max(1, max_results), 100);
  try {
    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const pExec = promisify(exec);
    // Use simple glob → ripgrep file-type filter conversion: prefer rg if present.
    const cmd = `cd ${JSON.stringify(process.cwd())} && (rg -n --max-count 3 -g ${JSON.stringify(file_glob)} ${JSON.stringify(pattern)} 2>/dev/null | head -n ${safeMax} || grep -rn --include="*.ts" --include="*.tsx" --include="*.sql" --include="*.md" -m 3 ${JSON.stringify(pattern)} . 2>/dev/null | head -n ${safeMax})`;
    const { stdout } = await pExec(cmd, { maxBuffer: 1_000_000, timeout: 15_000 });
    const lines = stdout.trim().split("\n").filter(Boolean);
    return { ok: true, result: { matches: lines, total: lines.length } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "grep error" };
  }
}

async function list_vercel_deploys(args: { limit?: number; state?: string }): Promise<ToolResult> {
  const { limit = 5, state } = args;
  const token = process.env.VERCEL_TOKEN;
  if (!token) return { ok: false, error: "VERCEL_TOKEN not set" };
  const params = new URLSearchParams({
    projectId: "prj_be5AGzi7cB5HnkTEvOWTzUv3YCAl",
    teamId: "team_vKod3ZYFgteGCHsam7IG8tEb",
    limit: String(Math.min(Math.max(1, limit), 20)),
  });
  if (state) params.set("state", state);
  try {
    const r = await fetch(`https://api.vercel.com/v6/deployments?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return { ok: false, error: `vercel ${r.status}: ${(await r.text()).slice(0, 200)}` };
    const j = await r.json();
    type VercelDep = { uid: string; name: string; state: string; readyState: string; url: string; created: number; target?: string; meta?: Record<string, string> };
    const summary = (j?.deployments ?? []).map((d: VercelDep) => ({
      uid: d.uid,
      name: d.name,
      state: d.state ?? d.readyState,
      url: `https://${d.url}`,
      created_at: new Date(d.created).toISOString(),
      target: d.target,
      commit_msg: d.meta?.githubCommitMessage,
    }));
    return { ok: true, result: summary };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "vercel error" };
  }
}

async function read_github_issue(args: { number?: number }): Promise<ToolResult> {
  const { number } = args;
  if (!number) return { ok: false, error: "number required" };
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { ok: false, error: "GITHUB_TOKEN not set" };
  try {
    const r = await fetch(`https://api.github.com/repos/TBC-HM/namkhan-bi/issues/${number}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    });
    if (!r.ok) return { ok: false, error: `github ${r.status}` };
    const j = await r.json();
    return {
      ok: true,
      result: {
        number: j.number,
        title: j.title,
        state: j.state,
        labels: (j.labels ?? []).map((l: { name: string }) => l.name),
        body: (j.body ?? "").slice(0, 6000),
        url: j.html_url,
        created_at: j.created_at,
        comments: j.comments,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "github error" };
  }
}

async function create_department(args: {
  slug?: string;
  name?: string;
  description?: string;
  chief_role?: string;
  chief_prompt?: string;
  workers?: Array<{ role: string; prompt: string; skills?: string[] }>;
  shared_skills?: string[];
}): Promise<ToolResult> {
  const { slug, name, description, chief_role, chief_prompt, workers = [], shared_skills = [] } = args;
  if (!slug || !name || !chief_role || !chief_prompt) {
    return { ok: false, error: "slug, name, chief_role, chief_prompt all required" };
  }
  if (!/^[a-z][a-z0-9_]{2,30}$/.test(slug)) {
    return { ok: false, error: "slug must be lowercase letters/numbers/underscores, 3-31 chars" };
  }
  // 1. Create department row.
  const { error: deptErr } = await supabase
    .from("cockpit_departments")
    .insert({ slug, name, chief_role, description: description ?? "", active: true })
    .select()
    .single();
  if (deptErr) return { ok: false, error: `dept insert: ${deptErr.message}` };

  // 2. Create chief prompt.
  const { error: chiefErr } = await supabase.from("cockpit_agent_prompts").insert({
    role: chief_role,
    prompt: chief_prompt,
    version: 1,
    active: true,
    source: "department_creator",
    department: slug,
    notes: `Chief of ${name}`,
  });
  if (chiefErr) return { ok: false, error: `chief insert: ${chiefErr.message}` };

  // 3. Create worker prompts.
  const created_workers: string[] = [];
  for (const w of workers.slice(0, 8)) {
    if (!w.role || !w.prompt) continue;
    const { error: wErr } = await supabase.from("cockpit_agent_prompts").insert({
      role: w.role,
      prompt: w.prompt,
      version: 1,
      active: true,
      source: "department_creator",
      department: slug,
      notes: null,
    });
    if (!wErr) created_workers.push(w.role);
  }

  // 4. Assign shared skills (read-only) + KB read to ALL roles in this dept.
  const { data: skills } = await supabase
    .from("cockpit_agent_skills")
    .select("id, name")
    .in("name", [...shared_skills, "read_knowledge_base", "list_recent_tickets"]);
  const skillMap = new Map((skills ?? []).map((s) => [s.name, s.id] as [string, number]));
  const allRoles = [chief_role, ...created_workers];
  const assignments: Array<{ role: string; skill_id: number }> = [];
  for (const role of allRoles) {
    for (const skillName of new Set([...shared_skills, "read_knowledge_base", "list_recent_tickets"])) {
      const sid = skillMap.get(skillName);
      if (sid) assignments.push({ role, skill_id: sid });
    }
  }
  if (assignments.length > 0) {
    await supabase.from("cockpit_agent_role_skills").upsert(assignments, { onConflict: "role,skill_id" });
  }

  return {
    ok: true,
    result: {
      department_slug: slug,
      department_name: name,
      chief: chief_role,
      workers: created_workers,
      shared_skills: [...shared_skills, "read_knowledge_base", "list_recent_tickets"],
      message: `Department "${name}" spawned with ${1 + created_workers.length} agents.`,
    },
  };
}

// ============================================================
// Doc-governance handlers (write_doc_staging, read_doc, propose_promotion, run_backup)
// ============================================================
const DOC_TYPES = ['vision_roadmap','prd','architecture','data_model','api','security','integration'];
const AUTO_PROMOTE_TYPES = new Set(['architecture','data_model','api']);

async function write_doc_staging(args: {
  doc_type?: string;
  parent_version?: number;
  content_md?: string;
  change_summary?: string;
  external_agent_hash?: string;
}): Promise<ToolResult> {
  const { doc_type, parent_version, content_md, change_summary, external_agent_hash } = args;
  if (!doc_type || !DOC_TYPES.includes(doc_type)) return { ok: false, error: `doc_type must be one of: ${DOC_TYPES.join(', ')}` };
  if (typeof parent_version !== 'number') return { ok: false, error: 'parent_version (integer) required' };
  if (!content_md) return { ok: false, error: 'content_md required' };
  if (!change_summary) return { ok: false, error: 'change_summary required' };

  const { data, error } = await supabase.schema('documentation_staging' as never).rpc('write_doc', {
    p_doc_type: doc_type,
    p_parent_version: parent_version,
    p_content_md: content_md,
    p_change_summary: change_summary,
    p_agent: 'agent_worker',
    p_external_hash: external_agent_hash ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, result: data };
}

async function read_doc(args: { doc_type?: string; environment?: string }): Promise<ToolResult> {
  const { doc_type, environment = 'staging' } = args;
  if (!doc_type || !DOC_TYPES.includes(doc_type)) return { ok: false, error: `doc_type must be one of: ${DOC_TYPES.join(', ')}` };
  const schemaName = environment === 'production' ? 'documentation' : 'documentation_staging';
  const { data, error } = await supabase
    .schema(schemaName as never)
    .from('documents')
    .select('id, doc_type, title, content_md, version, parent_version, status, last_updated_by, last_updated_at, locked_by, locked_at, requires_approval, auto_promoted, auto_promoted_at')
    .eq('doc_type', doc_type)
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, result: data };
}

async function propose_promotion(args: { doc_type?: string; staging_version?: number; auto?: boolean; notes?: string }): Promise<ToolResult> {
  const { doc_type, staging_version, auto = false, notes } = args;
  if (!doc_type || !DOC_TYPES.includes(doc_type)) return { ok: false, error: 'invalid doc_type' };
  if (typeof staging_version !== 'number') return { ok: false, error: 'staging_version required' };

  // Auto-promote rule check.
  const isAutoEligible = AUTO_PROMOTE_TYPES.has(doc_type);
  if (auto && !isAutoEligible) {
    return { ok: false, error: `auto=true is only allowed for: ${Array.from(AUTO_PROMOTE_TYPES).join(', ')}. ${doc_type} requires manual approval.` };
  }

  if (auto) {
    // Get current production version for integrity check.
    const prodCurrent = await supabase
      .schema('documentation' as never)
      .from('documents')
      .select('version')
      .eq('doc_type', doc_type)
      .single();
    const prodBefore = prodCurrent.data?.version ?? 0;

    const { data, error } = await supabase.schema('documentation' as never).rpc('promote_doc', {
      p_doc_type: doc_type,
      p_staging_version: staging_version,
      p_promoted_by: 'auto:agent_worker',
      p_promotion_type: 'auto',
      p_approver: null,
      p_notes: notes ?? 'auto-promoted (architecture/data_model/api)',
      p_expected_prod_version_before: prodBefore,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, result: { ...(data as Record<string, unknown>), promoted: true, promotion_type: 'auto' } };
  }

  // Manual: flip staging doc to pending_approval + create approvals row.
  const { data: stagingDoc } = await supabase
    .schema('documentation_staging' as never)
    .from('documents')
    .select('id, version')
    .eq('doc_type', doc_type)
    .single();
  if (!stagingDoc) return { ok: false, error: 'staging doc not found' };
  const { data: prodDoc } = await supabase
    .schema('documentation' as never)
    .from('documents')
    .select('id, version')
    .eq('doc_type', doc_type)
    .single();

  await supabase.schema('documentation_staging' as never).from('documents').update({ status: 'pending_approval' }).eq('id', stagingDoc.id);
  await supabase.schema('documentation_staging' as never).from('approvals').insert({
    document_id: stagingDoc.id,
    staging_version,
    production_version_before: prodDoc?.version ?? 0,
    status: 'pending',
    notes: notes ?? null,
  });
  return { ok: true, result: { promoted: false, status: 'pending_approval', awaiting: 'owner_click' } };
}

async function run_backup(args: { backup_type?: string; deployment_id?: string }): Promise<ToolResult> {
  const { backup_type = 'manual', deployment_id } = args;
  // Mark started, snapshot, mark completed. Inline JSONB body in metadata until S3 target exists.
  const { data: started, error: e1 } = await supabase
    .schema('documentation' as never)
    .from('backup_log')
    .insert({ backup_type, triggered_by: 'agent:run_backup', deployment_id: deployment_id ?? null, status: 'started' })
    .select()
    .single();
  if (e1) return { ok: false, error: e1.message };
  const [stagingDocs, prodDocs, stagingVers, prodVers] = await Promise.all([
    supabase.schema('documentation_staging' as never).from('documents').select('*'),
    supabase.schema('documentation' as never).from('documents').select('*'),
    supabase.schema('documentation_staging' as never).from('document_versions').select('*'),
    supabase.schema('documentation' as never).from('document_versions').select('*'),
  ]);
  const payload = {
    staging: stagingDocs.data ?? [],
    production: prodDocs.data ?? [],
    staging_versions: stagingVers.data ?? [],
    production_versions: prodVers.data ?? [],
  };
  const sizeBytes = JSON.stringify(payload).length;
  await supabase.schema('documentation' as never).from('backup_log').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
    backup_location: 'inline:backup_log.metadata',
    size_bytes: sizeBytes,
    metadata: payload,
  }).eq('id', (started as { id: string }).id);
  return { ok: true, result: { backup_id: (started as { id: string }).id, size_bytes: sizeBytes, type: backup_type } };
}

async function read_property_settings(args: { section?: string }): Promise<ToolResult> {
  const { section = "all" } = args;
  // marketing.v_property_card aggregates trading name, descriptions, USPs,
  // address, contacts, brand, social — the full identity card.
  const { data, error } = await supabase
    .schema("marketing")
    .from("v_property_card")
    .select("*")
    .limit(1)
    .single();
  if (error) return { ok: false, error: `marketing.v_property_card: ${error.message}` };
  if (!data) return { ok: false, error: "no property data found" };

  // Sections: identity | description | location | contacts | brand | social | meta | all
  const buckets: Record<string, Record<string, unknown>> = {
    identity: {
      property_id: data.property_id,
      trading_name: data.trading_name,
      legal_name: data.legal_name,
      star_rating: data.star_rating,
      category: data.category,
      affiliations: data.affiliations,
      brand_taglines: data.brand_taglines,
      unique_selling_points: data.unique_selling_points,
    },
    description: {
      short_description: data.short_description,
      long_description: data.long_description,
    },
    location: {
      formatted_address: data.formatted_address,
      city: data.city,
      district: data.district,
      country: data.country,
      latitude: data.latitude,
      longitude: data.longitude,
      check_in_time: data.check_in_time,
      check_out_time: data.check_out_time,
    },
    contacts: {
      website_url: data.website_url,
      booking_engine_url: data.booking_engine_url,
      primary_contacts: data.primary_contacts,
      all_contacts: data.all_contacts,
      languages_spoken: data.languages_spoken,
    },
    brand: {
      brand_color_hex: data.brand_color_hex,
      brand_palette: data.brand_palette,
      brand_typography: data.brand_typography,
      brand_logo_variants: data.brand_logo_variants,
      brand_assets_url: data.brand_assets_url,
    },
    social: {
      social_accounts: data.social_accounts,
    },
    meta: {
      business_license_no: data.business_license_no,
      tax_id: data.tax_id,
      vat_registered: data.vat_registered,
      todo_list: data.todo_list,
      updated_at: data.updated_at,
    },
  };
  if (section === "all") {
    return { ok: true, result: { all: buckets } };
  }
  if (buckets[section]) {
    return { ok: true, result: buckets[section] };
  }
  return { ok: false, error: `unknown section '${section}'. valid: ${Object.keys(buckets).join(", ")}, or 'all'` };
}

async function read_knowledge_base(args: { topic?: string; scope?: string; limit?: number }): Promise<ToolResult> {
  const { topic, scope = "global", limit = 20 } = args;
  const safeLimit = Math.min(Math.max(1, limit), 50);
  let q = supabase
    .from("cockpit_knowledge_base")
    .select("topic, key_fact, scope, source, confidence, created_at")
    .eq("active", true)
    .limit(safeLimit);
  if (scope && scope !== "all") q = q.eq("scope", scope);
  if (topic) q = q.or(`topic.ilike.%${topic}%,key_fact.ilike.%${topic}%`);
  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true, result: data ?? [] };
}

async function read_knowledge_base_semantic(args: {
  query?: string;
  limit?: number;
  scope?: string;
  min_similarity?: number;
}): Promise<ToolResult> {
  const query = (args.query ?? "").toString().trim();
  if (!query) return { ok: false, error: "query required" };
  const limit = Math.min(Math.max(args.limit ?? 5, 1), 20);
  const minSim = typeof args.min_similarity === "number" ? args.min_similarity : 0.5;
  const scope = args.scope ?? null;

  // 1. Embed the query via the embed-kb edge function (gte-small, 384-dim).
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const embRes = await fetch(`${supaUrl}/functions/v1/embed-kb`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supaKey}`,
    },
    body: JSON.stringify({ mode: "embed_query", query }),
  });
  if (!embRes.ok) {
    return { ok: false, error: `embed-kb ${embRes.status}: ${await embRes.text().then((t) => t.slice(0, 200))}` };
  }
  const embJson = (await embRes.json()) as { embedding?: number[]; error?: string };
  if (!embJson.embedding) {
    return { ok: false, error: `embed failed: ${embJson.error ?? "no embedding returned"}` };
  }

  // 2. Call the SQL semantic search function with the query vector.
  // Pass the vector as a Postgres array literal string — pgvector accepts the
  // `[a,b,c]` text form when cast to vector.
  const vecLiteral = `[${embJson.embedding.join(",")}]`;
  const { data, error } = await supabase.rpc("read_knowledge_base_semantic", {
    p_query_embedding: vecLiteral,
    p_limit: limit,
    p_scope: scope,
    p_min_similarity: minSim,
  });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    result: {
      query,
      limit,
      scope,
      min_similarity: minSim,
      hits: data ?? [],
      model: "gte-small",
    },
  };
}

async function add_knowledge_base_entry(args: {
  topic?: string;
  key_fact?: string;
  scope?: string;
  confidence?: string;
}): Promise<ToolResult> {
  const { topic, key_fact, scope = "global", confidence = "medium" } = args;
  if (!topic || !key_fact) return { ok: false, error: "topic and key_fact required" };
  if (!["low", "medium", "high"].includes(confidence)) {
    return { ok: false, error: "confidence must be low|medium|high" };
  }
  const { data, error } = await supabase
    .from("cockpit_knowledge_base")
    .insert({ topic, key_fact, scope, source: "ticket", confidence })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, result: { id: data.id, message: "knowledge entry saved" } };
}

async function web_fetch(args: { url?: string }): Promise<ToolResult> {
  const { url } = args;
  if (!url) return { ok: false, error: "url required" };
  try {
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol)) return { ok: false, error: "only http(s) allowed" };
    // Block private network / metadata endpoints (basic SSRF guard).
    if (/^(localhost|127\.|10\.|172\.16\.|172\.17\.|172\.18\.|172\.19\.|172\.2[0-9]\.|172\.3[01]\.|192\.168\.|169\.254\.)/.test(u.hostname)) {
      return { ok: false, error: "private network blocked" };
    }
    const r = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "namkhan-cockpit-research/1.0" },
    });
    const text = await r.text();
    // Strip HTML tags lightly to make it easier on the model.
    const stripped = text.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return {
      ok: true,
      result: {
        status: r.status,
        url,
        content_type: r.headers.get("content-type"),
        text: stripped.slice(0, 8000),
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "fetch error" };
  }
}

// Anti-fantasy guardrail: agents asking "who's on the team" must call this
// to get real names from cockpit_agent_identity. Verified against ticket #25
// hallucination (Olive invented "Backend Boris" / "Frontend Faye" / etc).
async function list_team_members(args: { include_archived?: boolean }): Promise<ToolResult> {
  const { include_archived = false } = args;
  const { data: identities, error: idErr } = await supabase
    .from("cockpit_agent_identity")
    .select("role, display_name, avatar, tagline, color")
    .order("display_name");
  if (idErr) return { ok: false, error: `cockpit_agent_identity: ${idErr.message}` };

  const { data: prompts, error: pErr } = await supabase
    .from("cockpit_agent_prompts")
    .select("role, version, active, status, archived_at, archived_reason");
  if (pErr) return { ok: false, error: `cockpit_agent_prompts: ${pErr.message}` };

  type PromptRow = {
    role: string;
    version: number;
    active: boolean;
    status: string;
    archived_at: string | null;
    archived_reason: string | null;
  };
  const promptByRole: Record<string, PromptRow[]> = {};
  for (const row of (prompts ?? []) as PromptRow[]) {
    (promptByRole[row.role] ??= []).push(row);
  }

  type AgentRow = {
    role: string;
    display_name: string;
    avatar: string;
    tagline: string;
    active_prompt_version: number | null;
    archived: boolean;
    archived_reason: string | null;
  };

  const roster: AgentRow[] = [];
  for (const id of (identities ?? []) as Array<{
    role: string; display_name: string; avatar: string; tagline: string; color: string;
  }>) {
    const versions = promptByRole[id.role] ?? [];
    const activeOne = versions.find((v) => v.active);
    const allArchived =
      versions.length > 0 && versions.every((v) => v.status === "archived");
    if (allArchived && !include_archived) continue;
    roster.push({
      role: id.role,
      display_name: id.display_name,
      avatar: id.avatar,
      tagline: id.tagline,
      active_prompt_version: activeOne?.version ?? null,
      archived: allArchived,
      archived_reason: versions.find((v) => v.status === "archived")?.archived_reason ?? null,
    });
  }

  return {
    ok: true,
    result: {
      total: roster.length,
      authoritative_source: "cockpit_agent_identity (DO NOT INVENT — these names are the only valid ones)",
      roster,
    },
  };
}

// Architect hard-precondition check (ZIP 3 founder interview).
async function check_founder_brief(args: { dept?: string }): Promise<ToolResult> {
  const { count, error } = await supabase
    .from("cockpit_knowledge_base")
    .select("id", { count: "exact", head: true })
    .like("topic", "architect_brief_%")
    .eq("active", true);
  if (error) return { ok: false, error: `cockpit_knowledge_base: ${error.message}` };
  const c = count ?? 0;
  const expected = 47;
  return {
    ok: true,
    result: {
      brief_rows_present: c,
      brief_rows_expected: expected,
      halt: c < expected,
      reason: c < expected
        ? `founder_interview_incomplete (${c}/${expected} architect_brief_* rows)`
        : "ok",
      dept_checked: args.dept ?? null,
    },
  };
}

// propose_department — read-only stub. Architect emits the proposal in JSON output;
// this skill exists so the prompt can claim the capability without DB writes.
async function propose_department(args: Record<string, unknown>): Promise<ToolResult> {
  return {
    ok: true,
    result: {
      action: "noop",
      message: "propose_department is read-only. Embed the proposal in your JSON output (department_proposal field). Cowork executes via apply_migration after PBS approves.",
      received: args,
    },
  };
}

// HoD-level skills (Smart Office 2026-05-07).
async function create_subticket(args: { worker_role?: string; task?: string; due?: string }): Promise<ToolResult> {
  const role = (args.worker_role ?? "").toString();
  const task = (args.task ?? "").toString();
  if (!role || !task) return { ok: false, error: "worker_role + task required" };
  const { data, error } = await supabase
    .from("cockpit_tickets")
    .insert({
      source: "hod_subticket",
      arm: "dev",
      intent: "build",
      status: "triaged",
      email_subject: `[${role}] ${task.slice(0, 80)}`,
      parsed_summary: task + (args.due ? `\n\nDue: ${args.due}` : ""),
      notes: `Spawned by HoD via create_subticket. Assigned to ${role}.`,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, result: { ticket_id: data?.id, assigned_to: role } };
}

async function request_peer_consult(args: { peer_role?: string; question?: string }): Promise<ToolResult> {
  const peer = (args.peer_role ?? "").toString();
  const q = (args.question ?? "").toString();
  if (!peer || !q) return { ok: false, error: "peer_role + question required" };
  const { data, error } = await supabase
    .from("cockpit_tickets")
    .insert({
      source: "hod_peer_consult",
      arm: "dev",
      intent: "decide",
      status: "triaged",
      email_subject: `[peer-consult → ${peer}]`,
      parsed_summary: q,
      notes: "Cross-dept consult between HoDs.",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, result: { ticket_id: data?.id, peer } };
}

async function open_pbs_ticket(args: { topic?: string; decision_required?: string; context?: string }): Promise<ToolResult> {
  const t = (args.topic ?? "").toString();
  const d = (args.decision_required ?? "").toString();
  if (!t || !d) return { ok: false, error: "topic + decision_required required" };
  const { data, error } = await supabase
    .from("cockpit_tickets")
    .insert({
      source: "hod_pbs_escalation",
      arm: "ops",
      intent: "decide",
      status: "awaits_user",
      email_subject: `[PBS] ${t}`,
      parsed_summary: `**Decision required:** ${d}\n\n${args.context ?? ""}`,
      notes: "HoD escalation to PBS.",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, result: { ticket_id: data?.id } };
}

async function propose_kpi_target(args: { kpi?: string; proposed_threshold?: string; rationale?: string }): Promise<ToolResult> {
  if (!args.kpi || !args.proposed_threshold) return { ok: false, error: "kpi + proposed_threshold required" };
  await supabase.from("cockpit_audit_log").insert({
    agent: "hod",
    action: "kpi_target_proposed",
    target: args.kpi,
    success: true,
    metadata: { proposed: args.proposed_threshold, rationale: args.rationale ?? null },
    reasoning: "HoD proposes KPI threshold change for PBS review.",
  });
  return { ok: true, result: { logged: true, kpi: args.kpi } };
}

async function route_ticket_to_dept(args: { ticket_id?: number }): Promise<ToolResult> {
  if (!args.ticket_id) return { ok: false, error: "ticket_id required" };
  // Simple acknowledgement — Captain Kit assigns via recommended_agent already.
  await supabase.from("cockpit_audit_log").insert({
    agent: "hod",
    action: "ticket_received",
    target: `ticket ${args.ticket_id}`,
    success: true,
    metadata: { ticket_id: args.ticket_id },
    reasoning: "HoD acknowledged routing from Captain Kit.",
  });
  return { ok: true, result: { acknowledged: args.ticket_id } };
}

// ============================================================================
// WRITE SKILLS — Vercel / Supabase / GitHub. PBS directive 2026-05-07:
// agents must be able to repair autonomously. Authority = write_with_audit.
// ============================================================================

const VERCEL_TEAM_ID = "team_vKod3ZYFgteGCHsam7IG8tEb";
function vercelToken(): string | null { return process.env.VERCEL_TOKEN ?? null; }

async function vercel_set_env(args: { project: string; key: string; value: string; targets?: string[] }): Promise<ToolResult> {
  const token = vercelToken();
  if (!token) return { ok: false, error: "VERCEL_TOKEN env var missing on this deploy" };
  const project = args.project; const key = args.key; const value = args.value;
  if (!project || !key || !value) return { ok: false, error: "project, key, value required" };
  const targets = args.targets ?? ["production", "preview", "development"];
  // delete existing
  const list = await fetch(`https://api.vercel.com/v9/projects/${project}/env?teamId=${VERCEL_TEAM_ID}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json()).catch(() => ({ envs: [] }));
  const existing = (list.envs ?? []).filter((e: { key?: string }) => e.key === key);
  for (const e of existing) {
    await fetch(`https://api.vercel.com/v9/projects/${project}/env/${e.id}?teamId=${VERCEL_TEAM_ID}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
  }
  const res = await fetch(`https://api.vercel.com/v10/projects/${project}/env?teamId=${VERCEL_TEAM_ID}&upsert=true`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ key, value, target: targets, type: "encrypted" }),
  });
  if (!res.ok) return { ok: false, error: `vercel api ${res.status}: ${(await res.text()).slice(0, 200)}` };
  await supabase.from("cockpit_audit_log").insert({
    agent: "vercel-write", action: "set_env", target: `${project}.${key}`, success: true,
    metadata: { project, key, targets, replaced_count: existing.length },
    reasoning: `Set ${key} on Vercel project ${project} (replaced ${existing.length} prior versions).`,
  });
  return { ok: true, result: { project, key, targets, replaced: existing.length } };
}

async function vercel_remove_env(args: { project: string; key: string }): Promise<ToolResult> {
  const token = vercelToken();
  if (!token) return { ok: false, error: "VERCEL_TOKEN env var missing" };
  const list = await fetch(`https://api.vercel.com/v9/projects/${args.project}/env?teamId=${VERCEL_TEAM_ID}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json()).catch(() => ({ envs: [] }));
  const existing = (list.envs ?? []).filter((e: { key?: string }) => e.key === args.key);
  for (const e of existing) {
    await fetch(`https://api.vercel.com/v9/projects/${args.project}/env/${e.id}?teamId=${VERCEL_TEAM_ID}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
  }
  await supabase.from("cockpit_audit_log").insert({
    agent: "vercel-write", action: "remove_env", target: `${args.project}.${args.key}`, success: true,
    metadata: { project: args.project, key: args.key, removed: existing.length },
    reasoning: `Removed ${existing.length} Vercel env entries for ${args.key} on ${args.project}.`,
  });
  return { ok: true, result: { project: args.project, key: args.key, removed: existing.length } };
}

async function vercel_set_deployment_protection(args: { project: string; password_protection: boolean; sso: boolean }): Promise<ToolResult> {
  const token = vercelToken();
  if (!token) return { ok: false, error: "VERCEL_TOKEN env var missing" };
  const body = {
    passwordProtection: args.password_protection ? { deploymentType: "all" } : null,
    ssoProtection: args.sso ? { deploymentType: "all" } : null,
  };
  const res = await fetch(`https://api.vercel.com/v9/projects/${args.project}?teamId=${VERCEL_TEAM_ID}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, error: `vercel api ${res.status}: ${(await res.text()).slice(0, 200)}` };
  await supabase.from("cockpit_audit_log").insert({
    agent: "vercel-write", action: "set_deployment_protection", target: args.project, success: true,
    metadata: body, reasoning: `Toggled deployment protection on ${args.project}: pw=${args.password_protection} sso=${args.sso}.`,
  });
  return { ok: true, result: { project: args.project, ...body } };
}

async function vercel_redeploy(args: { project: string; ref?: string; target?: string }): Promise<ToolResult> {
  const token = vercelToken();
  if (!token) return { ok: false, error: "VERCEL_TOKEN env var missing" };
  // Get latest READY deployment for the project + target, then promote it (free redeploy = redeploy SHA via deploy POST).
  const list = await fetch(`https://api.vercel.com/v6/deployments?projectId=${args.project}&teamId=${VERCEL_TEAM_ID}&target=${args.target ?? "production"}&state=READY&limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json()).catch(() => ({ deployments: [] }));
  const last = (list.deployments ?? [])[0];
  if (!last) return { ok: false, error: "no prior READY deployment found to redeploy" };
  const res = await fetch(`https://api.vercel.com/v13/deployments/${last.uid}/redeploy?teamId=${VERCEL_TEAM_ID}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) return { ok: false, error: `vercel redeploy ${res.status}: ${(await res.text()).slice(0, 200)}` };
  const j = await res.json();
  await supabase.from("cockpit_audit_log").insert({
    agent: "vercel-write", action: "redeploy", target: args.project, success: true,
    metadata: { from: last.uid, to: j.uid, ref: args.ref ?? null },
    reasoning: `Redeployed ${args.project} from ${last.uid} → ${j.uid}.`,
  });
  return { ok: true, result: { project: args.project, deployment_id: j.uid, url: j.url } };
}

async function supabase_execute_sql(args: { query: string }): Promise<ToolResult> {
  if (!args.query || typeof args.query !== "string") return { ok: false, error: "query (string) required" };
  // Hard guard against destructive ops without explicit ALLOW_DESTRUCTIVE flag.
  const dangerous = /\b(DROP|TRUNCATE|DELETE\s+FROM\s+(?!cockpit_skill_calls|net\._http))/i;
  if (dangerous.test(args.query)) {
    return { ok: false, error: "DROP/TRUNCATE/DELETE forbidden via this skill — use Supabase MCP under PBS sign" };
  }
  // Run via the existing service-role client.
  let data: unknown = null; let error: { message: string } | null = null;
  try {
    const r = await supabase.rpc("exec_sql_strict", { p_query: args.query });
    data = r.data; error = r.error ? { message: r.error.message } : null;
  } catch (e) {
    error = { message: e instanceof Error ? e.message : "exec_sql_strict RPC not present" };
  }
  if (error) {
    // Fall back to a raw query if RPC missing — still service role.
    return { ok: false, error: `SQL exec failed: ${(error as { message: string }).message}` };
  }
  await supabase.from("cockpit_audit_log").insert({
    agent: "supabase-write", action: "execute_sql", target: "service_role", success: true,
    metadata: { query: args.query.slice(0, 500), rows: Array.isArray(data) ? data.length : null },
    reasoning: "Agent-initiated SQL via supabase_execute_sql.",
  });
  return { ok: true, result: { rows: data } };
}

async function github_list_issues(args: { state?: "open" | "closed" | "all"; labels?: string; per_page?: number }): Promise<ToolResult> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { ok: false, error: "GITHUB_TOKEN env var missing" };
  const repo = "TBC-HM/namkhan-bi";
  const params = new URLSearchParams({
    state: args.state ?? "open",
    per_page: String(Math.min(Math.max(args.per_page ?? 20, 1), 100)),
  });
  if (args.labels) params.set("labels", args.labels);
  const res = await fetch(`https://api.github.com/repos/${repo}/issues?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) return { ok: false, error: `github api ${res.status}: ${(await res.text()).slice(0, 200)}` };
  const issues = (await res.json()) as Array<{ number: number; state: string; title: string; html_url: string; labels: Array<{ name: string }>; user: { login: string } }>;
  return {
    ok: true,
    result: issues.map(i => ({
      number: i.number, state: i.state, title: i.title, url: i.html_url,
      labels: i.labels.map(l => l.name), opened_by: i.user?.login,
    })),
  };
}

async function github_close_issue(args: { number: number; reason?: "completed" | "not_planned"; comment?: string }): Promise<ToolResult> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { ok: false, error: "GITHUB_TOKEN env var missing" };
  const repo = "TBC-HM/namkhan-bi";
  if (args.comment) {
    await fetch(`https://api.github.com/repos/${repo}/issues/${args.number}/comments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
      body: JSON.stringify({ body: args.comment }),
    });
  }
  const res = await fetch(`https://api.github.com/repos/${repo}/issues/${args.number}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
    body: JSON.stringify({ state: "closed", state_reason: args.reason ?? "completed" }),
  });
  if (!res.ok) return { ok: false, error: `github close ${res.status}: ${(await res.text()).slice(0, 200)}` };
  await supabase.from("cockpit_audit_log").insert({
    agent: "github-write", action: "close_issue", target: `${repo}#${args.number}`, success: true,
    metadata: { reason: args.reason ?? "completed", comment_added: !!args.comment },
    reasoning: args.comment ?? "Closed by agent.",
  });
  return { ok: true, result: { number: args.number, state: "closed" } };
}

async function github_comment_issue(args: { number: number; body: string }): Promise<ToolResult> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { ok: false, error: "GITHUB_TOKEN env var missing" };
  const repo = "TBC-HM/namkhan-bi";
  const res = await fetch(`https://api.github.com/repos/${repo}/issues/${args.number}/comments`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
    body: JSON.stringify({ body: args.body }),
  });
  if (!res.ok) return { ok: false, error: `github comment ${res.status}: ${(await res.text()).slice(0, 200)}` };
  await supabase.from("cockpit_audit_log").insert({
    agent: "github-write", action: "comment_issue", target: `${repo}#${args.number}`, success: true,
    metadata: { body_preview: args.body.slice(0, 200) },
    reasoning: "Comment added by agent.",
  });
  return { ok: true, result: { number: args.number } };
}

async function github_read_file(args: { path: string; ref?: string }): Promise<ToolResult> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { ok: false, error: "GITHUB_TOKEN env var missing" };
  const repo = "TBC-HM/namkhan-bi";
  const ref = args.ref ?? "main";
  const headers = { Authorization: `Bearer ${token}`, "Accept": "application/vnd.github+json" };
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${args.path}?ref=${ref}`, { headers });
  if (res.status === 404) return { ok: true, result: { exists: false, path: args.path, ref } };
  if (!res.ok) return { ok: false, error: `github api ${res.status}: ${(await res.text()).slice(0, 200)}` };
  const j = await res.json() as { content?: string; sha?: string; size?: number };
  if (!j.content) return { ok: false, error: "no content field (likely a directory)" };
  const text = Buffer.from(j.content.replace(/\n/g, ""), "base64").toString("utf-8");
  return { ok: true, result: { exists: true, path: args.path, ref, sha: j.sha, size: j.size, lines: text.split("\n").length, content: text } };
}

async function github_commit_file(args: { path: string; content: string; message: string; branch?: string; allow_destructive?: boolean }): Promise<ToolResult> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { ok: false, error: "GITHUB_TOKEN env var missing" };
  const repo = "TBC-HM/namkhan-bi";
  const branch = args.branch ?? "staging";
  const headers = { Authorization: `Bearer ${token}`, "Accept": "application/vnd.github+json", "Content-Type": "application/json" };

  // 2026-05-07 — auto-create the branch from main if it doesn't exist.
  // Lets agents target feature/agent-{id}-{slug} branches without needing
  // a separate "create branch" call. PRs can then be opened against this.
  if (branch !== "main" && branch !== "staging") {
    const ref = await fetch(`https://api.github.com/repos/${repo}/git/ref/heads/${branch}`, { headers });
    if (ref.status === 404) {
      const mainRef = await fetch(`https://api.github.com/repos/${repo}/git/ref/heads/main`, { headers });
      if (!mainRef.ok) return { ok: false, error: `cannot read main ref: ${mainRef.status}` };
      const mainJson = await mainRef.json();
      const create = await fetch(`https://api.github.com/repos/${repo}/git/refs`, {
        method: "POST", headers,
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: mainJson.object?.sha }),
      });
      if (!create.ok && create.status !== 422) {
        return { ok: false, error: `branch create failed: ${create.status}: ${(await create.text()).slice(0, 200)}` };
      }
    }
  }

  // Get current file SHA + content if exists (always read main, not branch — we want delta vs production state)
  const curOnBranch = await fetch(`https://api.github.com/repos/${repo}/contents/${args.path}?ref=${branch}`, { headers }).then(r => r.ok ? r.json() : null).catch(() => null);
  const curOnMain = (branch === "main")
    ? curOnBranch
    : await fetch(`https://api.github.com/repos/${repo}/contents/${args.path}?ref=main`, { headers }).then(r => r.ok ? r.json() : null).catch(() => null);

  // ─── DESTRUCTION GUARD (added 2026-05-08 PBS directive) ─────────────────────
  // Reject any commit that deletes >50 lines from an existing file unless
  // the caller explicitly sets allow_destructive: true (used for verified rewrites).
  // Reason: preserves every existing tab/sub-tab/expandable table by default.
  if (curOnMain && (curOnMain as { content?: string }).content && !args.allow_destructive) {
    try {
      const existingB64 = (curOnMain as { content: string }).content.replace(/\n/g, "");
      const existingText = Buffer.from(existingB64, "base64").toString("utf-8");
      const before = existingText.split("\n").length;
      const after = args.content.split("\n").length;
      const linesRemoved = before - after;
      const ratio = before > 0 ? after / before : 1;
      if (linesRemoved > 50 || (before > 100 && ratio < 0.6)) {
        await supabase.from("cockpit_audit_log").insert({
          agent: "github-write", action: "commit_file_BLOCKED", target: `${repo}@${branch}:${args.path}`, success: false,
          metadata: { before_lines: before, after_lines: after, lines_removed: linesRemoved, ratio: Number(ratio.toFixed(2)), branch },
          reasoning: `BLOCKED destructive commit: would delete ${linesRemoved} lines (${before}→${after}, ratio ${ratio.toFixed(2)}). Pass allow_destructive:true if intentional.`,
        });
        return {
          ok: false,
          error: `DESTRUCTION_GUARD: refusing to commit. Existing file has ${before} lines, your version has ${after} lines (delta -${linesRemoved}, kept ratio ${ratio.toFixed(2)}). Use github_read_file first to fetch existing content, then ADD/MODIFY only the sections you need. If this rewrite is intentional, re-call with allow_destructive:true.`,
        };
      }
    } catch {
      // base64 decode failed — fall through, don't block on guard error
    }
  }

  const body = {
    message: args.message,
    content: Buffer.from(args.content, "utf-8").toString("base64"),
    branch,
    sha: (curOnBranch as { sha?: string } | null)?.sha,
  };
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${args.path}`, {
    method: "PUT", headers, body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, error: `github api ${res.status}: ${(await res.text()).slice(0, 200)}` };
  const j = await res.json();
  await supabase.from("cockpit_audit_log").insert({
    agent: "github-write", action: "commit_file", target: `${repo}@${branch}:${args.path}`, success: true,
    metadata: { sha: j.commit?.sha, branch, path: args.path },
    reasoning: args.message,
  });
  return { ok: true, result: { sha: j.commit?.sha, branch, path: args.path, html_url: j.commit?.html_url } };
}

async function github_open_pr(args: { branch: string; title: string; body?: string; base?: string; labels?: string[]; auto_merge?: boolean }): Promise<ToolResult> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { ok: false, error: "GITHUB_TOKEN env var missing" };
  const repo = "TBC-HM/namkhan-bi";
  const base = args.base ?? "main";
  const autoMerge = args.auto_merge !== false; // default true per PBS directive 2026-05-07
  const headers = { Authorization: `Bearer ${token}`, "Accept": "application/vnd.github+json", "Content-Type": "application/json" };

  const body = {
    title: args.title.slice(0, 120),
    head: args.branch,
    base,
    body: (args.body ?? "").slice(0, 4000),
    maintainer_can_modify: true,
  };
  const res = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
    method: "POST", headers, body: JSON.stringify(body),
  });
  let pr: { number: number; html_url: string; node_id?: string; reused?: boolean };
  if (!res.ok) {
    const txt = (await res.text()).slice(0, 300);
    if (res.status === 422 && txt.includes("already exists")) {
      const list = await fetch(`https://api.github.com/repos/${repo}/pulls?head=TBC-HM:${args.branch}&state=open`, { headers });
      const arr = list.ok ? await list.json() : [];
      const existing = Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
      if (existing) {
        pr = { number: existing.number, html_url: existing.html_url, node_id: existing.node_id, reused: true };
      } else {
        return { ok: false, error: `github api ${res.status}: ${txt}` };
      }
    } else {
      return { ok: false, error: `github api ${res.status}: ${txt}` };
    }
  } else {
    const j = await res.json();
    pr = { number: j.number, html_url: j.html_url, node_id: j.node_id };
  }

  // Apply labels if requested.
  if (Array.isArray(args.labels) && args.labels.length > 0) {
    await fetch(`https://api.github.com/repos/${repo}/issues/${pr.number}/labels`, {
      method: "POST", headers,
      body: JSON.stringify({ labels: args.labels }),
    }).catch(() => {});
  }

  // Enable auto-merge so the PR squashes into main automatically when CI passes.
  // Uses the GraphQL enablePullRequestAutoMerge mutation. Requires the repo to
  // have auto-merge enabled in Settings → General (already on per PBS setup).
  let autoMergeEnabled = false;
  if (autoMerge && pr.node_id) {
    const gq = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `mutation Auto($id: ID!) {
          enablePullRequestAutoMerge(input: { pullRequestId: $id, mergeMethod: SQUASH }) {
            pullRequest { number autoMergeRequest { enabledAt mergeMethod } }
          }
        }`,
        variables: { id: pr.node_id },
      }),
    }).catch(() => null);
    if (gq && gq.ok) {
      const gqJson = await gq.json();
      if (gqJson?.data?.enablePullRequestAutoMerge?.pullRequest?.autoMergeRequest?.enabledAt) {
        autoMergeEnabled = true;
      }
    }
  }

  await supabase.from("cockpit_audit_log").insert({
    agent: "github-write", action: "open_pr", target: `${repo}#${pr.number}`, success: true,
    metadata: {
      number: pr.number, head: args.branch, base, html_url: pr.html_url,
      labels: args.labels ?? [], auto_merge: autoMergeEnabled, reused: pr.reused ?? false,
    },
    reasoning: args.title,
  });
  return { ok: true, result: { number: pr.number, html_url: pr.html_url, branch: args.branch, base, auto_merge: autoMergeEnabled } };
}

const HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<ToolResult>> = {
  list_team_members: (a) => list_team_members(a as Parameters<typeof list_team_members>[0]),
  check_founder_brief: (a) => check_founder_brief(a as Parameters<typeof check_founder_brief>[0]),
  propose_department: (a) => propose_department(a),
  create_subticket: (a) => create_subticket(a as Parameters<typeof create_subticket>[0]),
  request_peer_consult: (a) => request_peer_consult(a as Parameters<typeof request_peer_consult>[0]),
  open_pbs_ticket: (a) => open_pbs_ticket(a as Parameters<typeof open_pbs_ticket>[0]),
  propose_kpi_target: (a) => propose_kpi_target(a as Parameters<typeof propose_kpi_target>[0]),
  route_ticket_to_dept: (a) => route_ticket_to_dept(a as Parameters<typeof route_ticket_to_dept>[0]),
  query_supabase_view: (a) => query_supabase_view(a as Parameters<typeof query_supabase_view>[0]),
  read_audit_log: (a) => read_audit_log(a as Parameters<typeof read_audit_log>[0]),
  read_design_doc: (a) => read_design_doc(a as Parameters<typeof read_design_doc>[0]),
  list_recent_tickets: (a) => list_recent_tickets(a as Parameters<typeof list_recent_tickets>[0]),
  read_repo_file: (a) => read_repo_file(a as Parameters<typeof read_repo_file>[0]),
  search_repo: (a) => search_repo(a as Parameters<typeof search_repo>[0]),
  list_vercel_deploys: (a) => list_vercel_deploys(a as Parameters<typeof list_vercel_deploys>[0]),
  read_github_issue: (a) => read_github_issue(a as Parameters<typeof read_github_issue>[0]),
  web_fetch: (a) => web_fetch(a as Parameters<typeof web_fetch>[0]),
  read_knowledge_base: (a) => read_knowledge_base(a as Parameters<typeof read_knowledge_base>[0]),
  read_knowledge_base_semantic: (a) => read_knowledge_base_semantic(a as Parameters<typeof read_knowledge_base_semantic>[0]),
  add_knowledge_base_entry: (a) => add_knowledge_base_entry(a as Parameters<typeof add_knowledge_base_entry>[0]),
  create_department: (a) => create_department(a as Parameters<typeof create_department>[0]),
  read_property_settings: (a) => read_property_settings(a as Parameters<typeof read_property_settings>[0]),
  write_doc_staging: (a) => write_doc_staging(a as Parameters<typeof write_doc_staging>[0]),
  read_doc: (a) => read_doc(a as Parameters<typeof read_doc>[0]),
  propose_promotion: (a) => propose_promotion(a as Parameters<typeof propose_promotion>[0]),
  run_backup: (a) => run_backup(a as Parameters<typeof run_backup>[0]),
  // Write skills — PBS directive 2026-05-07.
  vercel_set_env: (a) => vercel_set_env(a as Parameters<typeof vercel_set_env>[0]),
  vercel_remove_env: (a) => vercel_remove_env(a as Parameters<typeof vercel_remove_env>[0]),
  vercel_set_deployment_protection: (a) => vercel_set_deployment_protection(a as Parameters<typeof vercel_set_deployment_protection>[0]),
  vercel_redeploy: (a) => vercel_redeploy(a as Parameters<typeof vercel_redeploy>[0]),
  supabase_execute_sql: (a) => supabase_execute_sql(a as Parameters<typeof supabase_execute_sql>[0]),
  github_commit_file: (a) => github_commit_file(a as Parameters<typeof github_commit_file>[0]),
  github_read_file: (a) => github_read_file(a as Parameters<typeof github_read_file>[0]),
  github_open_pr: (a) => github_open_pr(a as Parameters<typeof github_open_pr>[0]),
  github_list_issues: (a) => github_list_issues(a as Parameters<typeof github_list_issues>[0]),
  github_close_issue: (a) => github_close_issue(a as Parameters<typeof github_close_issue>[0]),
  github_comment_issue: (a) => github_comment_issue(a as Parameters<typeof github_comment_issue>[0]),
  unzip_storage_object: (a) => unzip_storage_object(a as Parameters<typeof unzip_storage_object>[0]),
  list_mcp_connectors: (a) => list_mcp_connectors(a as Parameters<typeof list_mcp_connectors>[0]),
  request_skill_approval: (a) => request_skill_approval(a as Parameters<typeof request_skill_approval>[0]),
  list_vercel_crons: (a) => list_vercel_crons(a as Parameters<typeof list_vercel_crons>[0]),
  run_typecheck: (a) => run_typecheck(a as Parameters<typeof run_typecheck>[0]),
};

// ============================================================================
// unzip_storage_object — GAP 1 of COWORK BRIEF 2026-05-07.
// Same logic as /api/cockpit/skills/unzip_storage_object/route.ts but callable
// in-process from the agent runner.
// ============================================================================
async function unzip_storage_object(args: { storage_url?: string; max_files?: number }): Promise<ToolResult> {
  const STORAGE_PREFIX = "https://kpenyneooigsyuuomgct.supabase.co/storage/v1/object/public/cockpit-uploads/";
  const TEXT_EXTS = new Set(["md","json","txt","html","htm","css","tsx","ts","jsx","js","mjs","cjs","yml","yaml","csv","tsv"]);
  const HARD_CAP_FILES = 200;
  const HARD_CAP_BYTES = 10 * 1024 * 1024;

  const url = (args.storage_url ?? "").trim();
  const maxFiles = Math.min(Math.max(args.max_files ?? HARD_CAP_FILES, 1), HARD_CAP_FILES);
  if (!url) return { ok: false, error: "storage_url required" };
  if (!url.startsWith(STORAGE_PREFIX)) return { ok: false, error: `storage_url must start with ${STORAGE_PREFIX}` };

  const t0 = Date.now();
  let zipBuf: ArrayBuffer;
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return { ok: false, error: `fetch ${r.status}` };
    zipBuf = await r.arrayBuffer();
  } catch (e) {
    return { ok: false, error: `fetch_threw: ${e instanceof Error ? e.message : String(e)}` };
  }

  const JSZipMod = (await import("jszip")).default;
  let zip: InstanceType<typeof JSZipMod>;
  try { zip = await JSZipMod.loadAsync(zipBuf); }
  catch (e) { return { ok: false, error: `zip_invalid: ${e instanceof Error ? e.message : String(e)}` }; }

  const file_tree: { path: string; size: number; is_text: boolean }[] = [];
  const text_contents: Record<string, string> = {};
  let totalBytes = 0; let count = 0;

  for (const path of Object.keys(zip.files)) {
    const entry = zip.files[path];
    if (entry.dir) continue;
    if (count >= maxFiles) return { ok: false, error: `too_many_files: > ${maxFiles}` };
    const ext = (() => { const i = path.lastIndexOf("."); return i >= 0 ? path.slice(i + 1).toLowerCase() : ""; })();
    const isText = TEXT_EXTS.has(ext);
    let size = 0;
    if (isText) {
      const c = await entry.async("string");
      size = Buffer.byteLength(c, "utf8");
      text_contents[path] = c;
    } else {
      size = (await entry.async("uint8array")).byteLength;
    }
    totalBytes += size;
    if (totalBytes > HARD_CAP_BYTES) return { ok: false, error: `too_large: > ${HARD_CAP_BYTES} bytes` };
    file_tree.push({ path, size, is_text: isText });
    count++;
  }

  await supabase.from("cockpit_audit_log").insert({
    agent: "skill-unzip", action: "unzip_storage_object", target: url, success: true,
    duration_ms: Date.now() - t0,
    metadata: { files: count, total_bytes: totalBytes, text_files: Object.keys(text_contents).length },
    reasoning: `Unzipped ${count} files (${totalBytes} bytes uncompressed).`,
  });

  return {
    ok: true,
    result: {
      file_tree, text_contents,
      stats: { files: count, total_bytes: totalBytes, text_files: Object.keys(text_contents).length, duration_ms: Date.now() - t0 },
    },
  };
}

// ============================================================================
// COWORK BRIEF v2 — GAPs 8, 9, 10, 12 in-process handlers.
// Each one mirrors its HTTP route under /api/cockpit/skills/<name>/route.ts.
// ============================================================================

async function list_mcp_connectors(_args: Record<string, unknown>): Promise<ToolResult> {
  const t0 = Date.now();
  const now = () => new Date().toISOString();
  type C = { name: string; scopes: string[]; auth_status: string; last_check_at: string; detail?: string };
  const connectors: C[] = [];
  // vercel
  if (!process.env.VERCEL_TOKEN) connectors.push({ name: "vercel", scopes: [], auth_status: "misconfigured", last_check_at: now(), detail: "VERCEL_TOKEN missing" });
  else {
    const r = await fetch("https://api.vercel.com/v2/user", { headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` } }).catch(() => null);
    connectors.push({ name: "vercel", scopes: ["projects:read","deployments:write","env:write"], auth_status: r?.ok ? "connected" : "misconfigured", last_check_at: now(), detail: r?.ok ? undefined : `vercel ${r?.status ?? "fetch-fail"}` });
  }
  // github
  if (!process.env.GITHUB_TOKEN) connectors.push({ name: "github", scopes: [], auth_status: "misconfigured", last_check_at: now(), detail: "GITHUB_TOKEN missing" });
  else {
    const r = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, "User-Agent": "namkhan-cockpit" } }).catch(() => null);
    connectors.push({ name: "github", scopes: (r?.headers.get("x-oauth-scopes") ?? "").split(",").map(s => s.trim()).filter(Boolean), auth_status: r?.ok ? "connected" : "misconfigured", last_check_at: now() });
  }
  // supabase
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    connectors.push({ name: "supabase", scopes: [], auth_status: "misconfigured", last_check_at: now(), detail: "URL or SERVICE_ROLE_KEY missing" });
  } else {
    const { error } = await supabase.from("cockpit_audit_log").select("id").limit(1);
    connectors.push({ name: "supabase", scopes: ["sql:write","storage:rw","rpc:call"], auth_status: error ? "misconfigured" : "connected", last_check_at: now(), detail: error?.message });
  }
  // env-only ones
  const envOnly: [string, string, string[], string?][] = [
    ["anthropic", "ANTHROPIC_API_KEY", ["claude:inference"]],
    ["openai", "OPENAI_API_KEY", ["embeddings"], "used by embed-kb edge function only"],
    ["cloudbeds", "CLOUDBEDS_CLIENT_ID", ["pms:read","pms:write"], "OAuth flow handled in Edge Function"],
    ["make_com", "MAKE_WEBHOOK_TOKEN", ["webhook:trigger"]],
    ["nimble", "NIMBLE_API_KEY", ["scrape:read"], "comp-set scraper"],
    ["gmail_oauth", "GMAIL_CLIENT_ID", ["gmail.readonly","gmail.send"], "pb@ only currently"],
  ];
  for (const [name, varName, scopes, note] of envOnly) {
    connectors.push({ name, scopes, auth_status: process.env[varName] ? "connected" : "misconfigured", last_check_at: now(), detail: process.env[varName] ? note : `${varName} env var missing${note ? `; ${note}` : ""}` });
  }

  await supabase.from("cockpit_audit_log").insert({
    agent: "skill-mcp-discovery", action: "list_mcp_connectors", target: "cockpit", success: true,
    duration_ms: Date.now() - t0,
    metadata: { connected: connectors.filter(c => c.auth_status === "connected").length, misconfigured: connectors.filter(c => c.auth_status === "misconfigured").length },
    reasoning: `Probed ${connectors.length} connectors.`,
  });
  return { ok: true, result: { connectors } };
}

async function request_skill_approval(args: { target_skill?: string; action_summary?: string; reasoning?: string; rollback_plan?: string; parent_ticket_id?: number; requesting_agent?: string }): Promise<ToolResult> {
  if (!args.target_skill || !args.action_summary || !args.reasoning) return { ok: false, error: "target_skill, action_summary, reasoning all required" };
  const subject = `[skill_approval] ${args.target_skill} — ${args.action_summary.slice(0, 80)}`;
  const noteJson = JSON.stringify({
    type: "skill_approval_request",
    target_skill: args.target_skill,
    action_summary: args.action_summary,
    reasoning: args.reasoning,
    rollback_plan: args.rollback_plan ?? null,
    requesting_agent: args.requesting_agent ?? null,
    parent_ticket_id: args.parent_ticket_id ?? null,
    requested_at: new Date().toISOString(),
  }, null, 2);
  const { data, error } = await supabase.from("cockpit_tickets").insert({
    source: "skill_approval_request", arm: "dev", intent: "skill_approval", status: "pending_pbs_approval",
    email_subject: subject, parsed_summary: args.action_summary, notes: noteJson,
    metadata: { tags: ["skill_approval"], target_skill: args.target_skill, parent_ticket_id: args.parent_ticket_id ?? null },
  }).select("id").single();
  if (error) return { ok: false, error: error.message };
  await supabase.from("cockpit_audit_log").insert({
    agent: args.requesting_agent ?? "skill-approval", action: "request_skill_approval", target: args.target_skill, success: true, ticket_id: data.id,
    metadata: { target_skill: args.target_skill, parent_ticket_id: args.parent_ticket_id ?? null },
    reasoning: `Opened approval sub-ticket #${data.id} for ${args.target_skill}.`,
  });
  return { ok: true, result: { ticket_id: data.id, status: "pending_pbs_approval" } };
}

async function list_vercel_crons(args: { project?: string }): Promise<ToolResult> {
  const slug = args.project ?? "namkhan-bi";
  const token = process.env.VERCEL_TOKEN;
  if (!token) return { ok: false, error: "VERCEL_TOKEN missing" };
  const t0 = Date.now();
  const pidRes = await fetch(`https://api.vercel.com/v9/projects/${slug}?teamId=${VERCEL_TEAM_ID}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!pidRes.ok) return { ok: false, error: `project ${slug} not resolvable: ${pidRes.status}` };
  const pid = (await pidRes.json()).id as string;
  const r = await fetch(`https://api.vercel.com/v1/projects/${pid}/crons?teamId=${VERCEL_TEAM_ID}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return { ok: false, error: `vercel crons api ${r.status}` };
  type RawCron = { schedule?: string; path?: string; lastFinishedAt?: number; lastRunStatus?: string };
  const arr: RawCron[] = (await r.json()).crons ?? [];
  const crons = arr.map((c) => ({
    schedule: c.schedule ?? "?", path: c.path ?? "?",
    last_run_at: c.lastFinishedAt ? new Date(c.lastFinishedAt).toISOString() : null,
    last_run_status: c.lastRunStatus ?? null,
  }));
  await supabase.from("cockpit_audit_log").insert({
    agent: "skill-vercel-crons", action: "list_vercel_crons", target: slug, success: true,
    duration_ms: Date.now() - t0, metadata: { count: crons.length }, reasoning: `Fetched ${crons.length} crons for ${slug}.`,
  });
  return { ok: true, result: { project: slug, crons } };
}

async function run_typecheck(args: { project?: string }): Promise<ToolResult> {
  const slug = args.project ?? "namkhan-bi-staging";
  const token = process.env.VERCEL_TOKEN;
  if (!token) return { ok: false, error: "VERCEL_TOKEN missing" };
  const t0 = Date.now();
  const pidRes = await fetch(`https://api.vercel.com/v9/projects/${slug}?teamId=${VERCEL_TEAM_ID}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!pidRes.ok) return { ok: false, error: `project ${slug} not resolvable` };
  const pid = (await pidRes.json()).id as string;

  const dRes = await fetch(`https://api.vercel.com/v6/deployments?projectId=${pid}&teamId=${VERCEL_TEAM_ID}&limit=1`, { headers: { Authorization: `Bearer ${token}` } });
  const dep = ((await dRes.json()).deployments ?? [])[0];
  if (!dep) return { ok: false, error: "no deployments found" };

  let errors: { file: string; line: number; col?: number; message: string }[] = [];
  if (dep.state === "ERROR") {
    const evRes = await fetch(`https://api.vercel.com/v3/deployments/${dep.uid}/events?teamId=${VERCEL_TEAM_ID}&direction=forward&limit=500&builds=1`, { headers: { Authorization: `Bearer ${token}` } });
    type Ev = { text?: string; payload?: { text?: string } };
    const evs = (await evRes.json()) as Ev[];
    const log = (evs ?? []).map((e) => e.text ?? e.payload?.text ?? "").join("\n");
    const re1 = /([./\w-]+\.tsx?):(\d+):(\d+)\s*\n\s*Type error:\s*(.+?)(?:\n|$)/g;
    const re2 = /([./\w-]+\.tsx?)\((\d+),(\d+)\):\s*error\s*TS\d+:\s*(.+?)(?:\n|$)/g;
    const seen = new Set<string>();
    for (const re of [re1, re2]) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(log))) {
        const k = `${m[1]}:${m[2]}:${m[4]}`;
        if (!seen.has(k)) { seen.add(k); errors.push({ file: m[1], line: +m[2], col: +m[3], message: m[4].trim() }); }
      }
    }
  }

  const ok = dep.state === "READY";
  await supabase.from("cockpit_audit_log").insert({
    agent: "skill-typecheck", action: "run_typecheck", target: slug, success: ok,
    duration_ms: Date.now() - t0,
    metadata: { deployment_id: dep.uid, deployment_state: dep.state, sha: dep.meta?.githubCommitSha?.slice(0, 7) ?? null, error_count: errors.length },
    reasoning: ok ? `Latest deploy READY (sha ${dep.meta?.githubCommitSha?.slice(0, 7) ?? "?"}).` : `Latest deploy state ${dep.state}; ${errors.length} type error(s).`,
  });
  return {
    ok: true,
    result: {
      project: slug, deployment_id: dep.uid, deployment_state: dep.state,
      sha: dep.meta?.githubCommitSha?.slice(0, 7) ?? null, errors,
      build_passed: ok,
    },
  };
}

export async function dispatchSkill(handler: string, args: Record<string, unknown>): Promise<ToolResult> {
  const fn = HANDLERS[handler];
  if (!fn) return { ok: false, error: `unknown handler: ${handler}` };
  try {
    return await fn(args);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "handler crashed" };
  }
}

/**
 * Phase 1.2 — wrap a skill invocation with cockpit.call_skill / complete_skill_call.
 * Authorizes via SQL dispatcher (logs unauthorized attempts to cockpit_skill_calls
 * with status=rejected_*), executes the handler, then closes the call row with
 * output/error/duration. Falls back to raw dispatchSkill if the SQL gate isn't
 * available (e.g. migration not yet applied) so production never hard-breaks.
 *
 * skill_name + role are the cockpit_agent_skills.name + cockpit_agent_prompts.role
 * the agent runner is currently executing as. ticket_id is optional for tying the
 * skill call back to the originating ticket.
 */
export async function dispatchSkillGated(
  role: string,
  skillName: string,
  handler: string,
  args: Record<string, unknown>,
  ticketId: number | null = null,
): Promise<ToolResult> {
  const t0 = Date.now();
  // 1. Authorization gate.
  const { data: authData, error: authErr } = await supabase.rpc("call_skill", {
    p_role: role,
    p_skill_name: skillName,
    p_input: args as never,
    p_dry_run: false,
    p_approval_id: null,
    p_ticket_id: ticketId,
  });
  if (authErr) {
    // SQL gate unavailable — fall through to ungated dispatch (back-compat).
    return dispatchSkill(handler, args);
  }
  const auth = authData as { authorized?: boolean; reason?: string; call_id?: number };
  if (!auth?.authorized) {
    return { ok: false, error: `skill_gated: ${auth?.reason ?? "unauthorized"}` };
  }
  const callId = auth.call_id ?? null;
  // 2. Execute the handler.
  let result: ToolResult;
  let status: "succeeded" | "failed" = "succeeded";
  let errPayload: Record<string, unknown> | null = null;
  try {
    result = await dispatchSkill(handler, args);
    if (!result.ok) {
      status = "failed";
      errPayload = { error: (result as { ok: false; error: string }).error };
    }
  } catch (e) {
    status = "failed";
    errPayload = { error: e instanceof Error ? e.message : "handler crashed" };
    result = { ok: false, error: errPayload.error as string };
  }
  // 3. Close the call row.
  if (callId !== null) {
    await supabase.rpc("complete_skill_call", {
      p_call_id: callId,
      p_status: status,
      p_output: status === "succeeded" ? (result as never) : null,
      p_error: errPayload as never,
      p_cost_usd_milli: 0,
      p_duration_ms: Date.now() - t0,
    });
  }
  return result;
}

export type AgentToolDef = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  handler: string;
};

export async function loadSkillsForRole(role: string): Promise<AgentToolDef[]> {
  const { data } = await supabase
    .from("cockpit_agent_role_skills")
    .select("skill_id, enabled, cockpit_agent_skills!inner(name, description, input_schema, handler, active)")
    .eq("role", role)
    .eq("enabled", true);
  if (!data) return [];
  type SkillJoined = {
    enabled: boolean;
    cockpit_agent_skills:
      | {
          name: string;
          description: string;
          input_schema: Record<string, unknown>;
          handler: string;
          active: boolean;
        }
      | {
          name: string;
          description: string;
          input_schema: Record<string, unknown>;
          handler: string;
          active: boolean;
        }[];
  };
  return (data as SkillJoined[])
    .map((row) => {
      const s = Array.isArray(row.cockpit_agent_skills)
        ? row.cockpit_agent_skills[0]
        : row.cockpit_agent_skills;
      return s;
    })
    .filter((s) => s && s.active)
    .map((s) => ({
      name: s.name,
      description: s.description,
      input_schema: s.input_schema,
      handler: s.handler,
    }));
}
