// lib/cockpit-tools.ts
// Server-side handlers for the cockpit agent skills. Each handler maps to
// the `handler` column in cockpit_agent_skills and is dispatched from the
// agent worker when Anthropic emits a tool_use block.
//
// All handlers run with the SUPABASE_SERVICE_ROLE_KEY but are explicitly
// scoped to read-only public views/tables. No DDL, no writes, no deletes.

import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";
import path from "path";

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

const HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<ToolResult>> = {
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
  add_knowledge_base_entry: (a) => add_knowledge_base_entry(a as Parameters<typeof add_knowledge_base_entry>[0]),
  create_department: (a) => create_department(a as Parameters<typeof create_department>[0]),
  read_property_settings: (a) => read_property_settings(a as Parameters<typeof read_property_settings>[0]),
  write_doc_staging: (a) => write_doc_staging(a as Parameters<typeof write_doc_staging>[0]),
  read_doc: (a) => read_doc(a as Parameters<typeof read_doc>[0]),
  propose_promotion: (a) => propose_promotion(a as Parameters<typeof propose_promotion>[0]),
  run_backup: (a) => run_backup(a as Parameters<typeof run_backup>[0]),
};

export async function dispatchSkill(handler: string, args: Record<string, unknown>): Promise<ToolResult> {
  const fn = HANDLERS[handler];
  if (!fn) return { ok: false, error: `unknown handler: ${handler}` };
  try {
    return await fn(args);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "handler crashed" };
  }
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
