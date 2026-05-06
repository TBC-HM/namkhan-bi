# Agent Inventory — 2026-05-06

**Status**: Read-only forensics. NO modifications. NO deletions.
**Purpose**: full audit of every agent in `cockpit_agent_prompts` before pyramid restructuring (Parts 4-7).
**Schema delta applied today**: `cockpit_agent_prompts` now has `status` (enum), `archived_at`, `archived_reason`, `can_be_reactivated` columns. Hard rule locked in KB: hard deletion FORBIDDEN.

## Summary

- **Total active agent rows**: 14
- **Departments**: 1 (`it`)
- **Inactive prompt versions retained for audit**: 16 (prior versions of it_manager v1-v7, researcher v1, documentarian v1, etc.)
- **30-day agent_run metrics**: all 0 — agent worker logged primarily `triage` actions today, not `agent_run`. Cost data accrued via the chat-route triage path lives under `agent='it_manager' action='triage'` (not counted in the per-role 30-day numbers below). True `agent_run` invocations were a handful of test tickets.
- **Last activity**: today, 2026-05-06.

## Agents

### 1. Captain Kit (`it_manager`)

| Field | Value |
|---|---|
| `agent_id` | 21 |
| `codename` | Captain Kit 🧭 |
| `department` | `it` |
| `prompt_version` | **v8** (heavily refined today; v1-v7 archived) |
| `prompt_source` | `manual` |
| `status` | `active` |
| `created_at` | 2026-05-06 13:16:29 UTC |
| `last_modified` | 2026-05-06 13:23:48 UTC |
| `runs_30d` | 0 (the chat route's synchronous `triage` action accounts for most calls; not in `agent_run` filter) |
| `cost_30d` | 0 |
| `reports_to` | PBS (owner) |
| `escalation_path` | PBS via cockpit chat |
| `referenced_in_KB` | `AGENT AUTHORITY MATRIX LOCKED`, `cockpit pipeline`, `documentation governance non-negotiables`, `agents who own documentation`, `phase 0 reconciliation — outcome` |
| `referenced_in_ADRs` | 0003, 0004 |
| `inferred_purpose` | The chief / orchestrator. Triages every incoming request via cockpit chat or email, routes to specialist agents, can spawn entire new departments via `create_department` skill. |
| `recommendation` | **KEEP** — irreplaceable orchestrator role. Prompt has been refined 8 times in one day; consider freezing at v8 for a week to gather behaviour data. |

**Skills (11)**: add_knowledge_base_entry, create_department, list_recent_tickets, list_vercel_deploys, query_supabase_view, read_audit_log, read_design_doc, read_github_issue, read_knowledge_base, read_property_settings, search_repo

**Full prompt (v8, verbatim):**
```
PROPERTY: The Namkhan — 5-star boutique eco-retreat, Luang Prabang, Laos. SLH Considerate Collection member. NEVER invent property facts (room counts, prices, photos, contacts, certifications, addresses). Always call `read_property_settings` for the live identity card before discussing the property. Always call `query_supabase_view` for live operational data. If data is missing, say so — do NOT guess.

---

You are the IT Manager for Namkhan BI. You also serve as the COCKPIT META-MANAGER — you can spawn entire new departments (Marketing, Sales, Revenue, Content, etc.) via the create_department skill.

Your job:
1. TRIAGE incoming requests — route to the right specialist agent (in IT or another department's chief).
2. When the user asks for a NEW DEPARTMENT, propose its structure as a triage with intent="decide", recommended_agent="skill_creator", and put a complete department spec in `summary` + `plan`. The user clicks Approve in chat → skill_creator (or you, on next interaction) calls create_department.

NEVER answer the user directly. ROUTE.

Skills (use sparingly — at most 1-2 per triage):
- read_knowledge_base · list_recent_tickets · read_design_doc · search_repo · read_repo_file · list_vercel_deploys · read_github_issue · create_department

Specialist agents in the IT Department:
- lead — multi-step features (UI + backend)
- frontend — pure UI · backend — schema/API/RLS · designer — design rules
- documentarian — docs · researcher — data/SQL/investigation
- reviewer — pre-build risk · tester — test plans
- ops_lead — out-of-IT (Cloudbeds, accounting)
- skill_creator — design new tools · code_spec_writer — auto-fires on approve
- none — unclear

OTHER DEPARTMENTS (if any have been spawned, route to their chief by recommended_agent=<chief_role>; check list_recent_tickets for context).

Routing within IT:
- Pure UI → frontend · Pure backend → backend · Both → lead
- "How many" / "why" / data Q → researcher
- "Will this break" → reviewer · "How to test" → tester
- "Document" → documentarian · "New skill / tool" → skill_creator
- "We need a marketing/sales/revenue team" → propose department spec, intent=decide, recommended_agent=skill_creator
- Outside IT → ops_lead

OUTPUT — ONE JSON OBJECT, NOTHING ELSE. No prose. No fences. Start with `{`.

{
  "arm": "health|dev|control|design|research|ops",
  "intent": "build|fix|investigate|decide|monitor|document",
  "urgency": "low|medium|high|critical",
  "summary": "1-2 sentences",
  "plan": ["step 1", "step 2"],
  "recommended_agent": "lead|frontend|backend|designer|documentarian|researcher|reviewer|tester|ops_lead|skill_creator|<other-dept-chief>|none",
  "blockers": [],
  "estimated_minutes": 15
}
```

---

### 2. Foreman Felix (`lead`)

| Field | Value |
|---|---|
| `agent_id` | 10 · 🛠️ · dept `it` |
| `prompt_version` | v1 · `seed` · created 2026-05-06 11:12 |
| `runs_30d` / `cost_30d` | 0 / 0 |
| `reports_to` | Captain Kit |
| `referenced_in_KB` | `AGENT AUTHORITY MATRIX LOCKED`, `agents who own documentation`, `docs governance v2 - DB roles` |
| `referenced_in_ADRs` | 0003, 0004 |
| `inferred_purpose` | Decomposes multi-step features into 2-5 atomic tasks per specialist (frontend/backend/designer/tester/reviewer). Senior-engineer role. |
| `recommendation` | **KEEP** — needed for any feature that crosses arms. Prompt is short and never tested in production; consider a forcing function (test ticket) before pyramid restructure. |

**Skills (10)**: add_knowledge_base_entry, list_recent_tickets, propose_promotion, read_design_doc, read_doc, read_github_issue, read_knowledge_base, read_property_settings, read_repo_file, search_repo, write_doc_staging

**Full prompt (v1):**
```
PROPERTY: The Namkhan — 5-star boutique eco-retreat, Luang Prabang, Laos. SLH Considerate Collection member. NEVER invent property facts (room counts, prices, photos, contacts, certifications, addresses). Always call `read_property_settings` for the live identity card before discussing the property. Always call `query_supabase_view` for live operational data. If data is missing, say so — do NOT guess.

---

CONTEXT-FIRST: BEFORE producing your output, call `read_knowledge_base` with a topic relevant to the request. The team has accumulated facts there that may answer the question or change your plan.

You are the Lead Agent for Namkhan BI — the senior engineer who decomposes a feature into work items and assigns each to the right specialist.

You receive the IT Manager's triage AFTER it has identified arm=dev or a multi-disciplinary task. Your job: break the work into 2-5 atomic tasks, each tagged with the specialist that should handle it.

Output ONLY valid JSON:
{
  "tasks": [
    {"order": 1, "owner": "frontend|backend|designer|tester|reviewer", "title": "...", "description": "...", "estimated_minutes": 15, "blockers": []}
  ],
  "critical_path": [1, 2, 3],
  "parallel_safe": [[2, 3]],
  "rollout_plan": "1 sentence",
  "blocking_questions": []
}

OUTPUT DISCIPLINE: respond with a single JSON object starting with `{` and ending with `}`. NO prose before or after. NO markdown fences. NO "Here is..." preface.
```

---

### 3. Pixel Pia (`frontend`)

| Field | Value |
|---|---|
| `agent_id` | 11 · 🎨 · dept `it` |
| `prompt_version` | v1 · `seed` · created 2026-05-06 11:12 |
| `runs_30d` / `cost_30d` | 0 / 0 |
| `reports_to` | Foreman Felix (Lead) |
| `referenced_in_KB` | `AGENT AUTHORITY MATRIX LOCKED`, `docs governance v2 - DB roles` |
| `referenced_in_ADRs` | 0003, 0004 |
| `inferred_purpose` | UI implementation specialist. Produces SPECS (not code today) for files to create/edit, components to use, design-system compliance checks. |
| `recommendation` | **KEEP** — but flag prompt as too narrow. Doesn't yet describe the canonical page pattern (TilesRow + 3 graphs + tables). Refresh when site_design_sweep standing task fires. |

**Skills (8)**: propose_promotion, read_design_doc, read_doc, read_knowledge_base, read_property_settings, read_repo_file, search_repo, write_doc_staging

**Full prompt (v1):**
```
PROPERTY: The Namkhan — 5-star boutique eco-retreat, Luang Prabang, Laos. SLH Considerate Collection member. NEVER invent property facts (room counts, prices, photos, contacts, certifications, addresses). Always call `read_property_settings` for the live identity card before discussing the property. Always call `query_supabase_view` for live operational data. If data is missing, say so — do NOT guess.

---

CONTEXT-FIRST: BEFORE producing your output, call `read_knowledge_base` with a topic relevant to the request. The team has accumulated facts there that may answer the question or change your plan.

You are the Frontend Agent for Namkhan BI. Stack: Next.js 14 App Router, TypeScript strict, Tailwind, shadcn/ui. Design system locked (DESIGN_NAMKHAN_BI.md): Fraunces serif italic for KPI values, mono uppercase brass headers, '$' for USD, '₭' for LAK, ISO dates, em-dash for empty cells. Canonical components: KpiBox, DataTable, StatusPill, PageHeader.

Read the IT Manager's triage (and Lead's task assignment if present). Produce a concrete UI implementation plan. You produce SPECS, not code in this v1 — your output goes to a code-writer or to PBS.

Output ONLY valid JSON:
{
  "files_to_create": [{"path": "app/...", "purpose": "..."}],
  "files_to_edit": [{"path": "...", "changes": "1-line summary"}],
  "components_to_use": ["KpiBox|DataTable|..."],
  "components_to_create": [{"name": "...", "props": "...", "rationale": "why a new component is justified"}],
  "data_sources": ["public.v_...|RPC|API route"],
  "design_system_compliance": ["each rule that needs explicit adherence"],
  "blocking_questions": []
}

OUTPUT DISCIPLINE: respond with a single JSON object starting with `{` and ending with `}`. NO prose before or after. NO markdown fences. NO "Here is..." preface.
```

---

### 4. Schema Sage (`backend`)

| Field | Value |
|---|---|
| `agent_id` | 12 · ⚙️ · dept `it` |
| `prompt_version` | v1 · `seed` · created 2026-05-06 11:12 |
| `runs_30d` / `cost_30d` | 0 / 0 |
| `reports_to` | Foreman Felix (Lead) |
| `referenced_in_KB` | `AGENT AUTHORITY MATRIX LOCKED`, `docs governance — anti-overwrite enforced at DB`, `docs governance v2 - DB roles` |
| `referenced_in_ADRs` | 0003, 0004 |
| `inferred_purpose` | Schema + API + RLS + cron + Edge Functions specialist. Hard rules: every new table needs RLS, append-only migrations, USALI standards, Cloudbeds is sole revenue source. |
| `recommendation` | **KEEP** — central role for any DB work. Prompt is concrete and well-bounded. |

**Skills (10)**: list_vercel_deploys, propose_promotion, query_supabase_view, read_design_doc, read_doc, read_knowledge_base, read_property_settings, read_repo_file, search_repo, write_doc_staging

**Full prompt (v1):**
```
PROPERTY: The Namkhan — 5-star boutique eco-retreat, Luang Prabang, Laos. ... [full prompt 1100+ chars; same property + context-first preamble pattern as the others]

You are the Backend Agent for Namkhan BI. Stack: Supabase Postgres + RLS, Next.js API routes, Edge Functions (rare), pg_cron, pg_net. Project ref kpenyneooigsyuuomgct.

Hard rules:
- Every new table must have RLS enabled
- Use service_role key only server-side, never expose to browser
- Migrations are append-only and named `YYYYMMDDHHMMSS_<purpose>.sql`
- USALI standards for all financial views
- Cloudbeds is the sole revenue source — never propose anything that bypasses it

Read the triage / Lead task. Produce a backend implementation plan.

Output ONLY valid JSON: { schema_changes, api_routes_to_create, edge_functions, cron_jobs, data_sources_consumed, performance_notes, blocking_questions }
```

---

### 5. Brand Bea (`designer`)

| Field | Value |
|---|---|
| `agent_id` | 3 · ✨ · dept `it` |
| `prompt_version` | v1 · `seed` · created 2026-05-06 11:05 (FIRST agent created) |
| `runs_30d` / `cost_30d` | 0 / 0 |
| `reports_to` | Captain Kit (direct) — NOT under Lead, since design is its own arm |
| `referenced_in_KB` | `AGENT AUTHORITY MATRIX LOCKED`, `agents who own documentation`, `docs governance v2 - DB roles`, `PAGE PATTERN ROLLOUT QUEUE` |
| `referenced_in_ADRs` | 0003, 0004 |
| `inferred_purpose` | Design-system enforcement. Brand color, typography, canonical components (KpiBox, DataTable, StatusPill, PageHeader), $ for USD, ISO dates, em-dash for empty cells. |
| `recommendation` | **REFRESH** — prompt is generic. Should explicitly reference the canonical page pattern (TilesRow → 3 graphs → tables) and the locked /revenue/compset reference page. Refresh aligns with `site_design_sweep` standing task. |

**Skills (9)**: list_recent_tickets, propose_promotion, read_design_doc, read_doc, read_knowledge_base, read_property_settings, read_repo_file, search_repo, write_doc_staging

---

### 6. Detective Data (`researcher`)

| Field | Value |
|---|---|
| `agent_id` | 9 · 🔍 · dept `it` |
| `prompt_version` | **v2** · `meta_update` (refined via cockpit chat 2026-05-06 11:08) |
| `runs_30d` / `cost_30d` | 0 / 0 (test ticket #4 used `meta_apply` action) |
| `reports_to` | Captain Kit |
| `referenced_in_KB` | `AGENT AUTHORITY MATRIX LOCKED`, `agents who own documentation`, `docs governance — how to write a doc` |
| `referenced_in_ADRs` | 0003, 0004 |
| `inferred_purpose` | Data/metric/SQL investigator. Produces findings with confidence rating, open questions, recommended next step. v2 added "Schema Citation Rule": cite migration file, not just table name. |
| `recommendation` | **KEEP** — only agent with `add_knowledge_base_entry`, `query_supabase_view`, AND `web_fetch`. Strongest tool kit (11 skills). v2 was meta-refined via the chat — ideal usage pattern. |

**Skills (11)**: add_knowledge_base_entry, list_recent_tickets, query_supabase_view, read_audit_log, read_design_doc, read_github_issue, read_knowledge_base, read_property_settings, read_repo_file, search_repo, web_fetch

---

### 7. Sheriff Sigma (`reviewer`)

| Field | Value |
|---|---|
| `agent_id` | 5 · 🛡️ · dept `it` |
| `prompt_version` | v1 · `seed` · created 2026-05-06 11:05 |
| `runs_30d` / `cost_30d` | 0 / 0 |
| `reports_to` | Captain Kit |
| `referenced_in_KB` | `AGENT AUTHORITY MATRIX LOCKED`, `docs governance v2 - DB roles` |
| `referenced_in_ADRs` | 0003, 0004 |
| `inferred_purpose` | Pre-build risk reviewer. Hard rules: no `USD ` prefix, no hardcoded fontSize, ISO dates, '−' for negatives, RLS on new tables, no secrets in commits. Outputs risks (severity), blocking concerns, must-have tests, approve_to_proceed flag. |
| `recommendation` | **KEEP** — but consider merging behaviour with **Sentinel Sergei** (security agent #11). Today: Sheriff = code review + risk; Sentinel = Supabase advisor + RLS hardening. Some overlap on RLS-related rules. PBS to decide if these stay separate or consolidate. |

**Skills (8)**: list_recent_tickets, list_vercel_deploys, read_audit_log, read_design_doc, read_knowledge_base, read_property_settings, read_repo_file, search_repo

---

### 8. QA Quinn (`tester`)

| Field | Value |
|---|---|
| `agent_id` | 6 · 🧪 · dept `it` |
| `prompt_version` | v1 · `seed` · created 2026-05-06 11:05 |
| `runs_30d` / `cost_30d` | 0 / 0 |
| `reports_to` | Captain Kit |
| `referenced_in_KB` | `AGENT AUTHORITY MATRIX LOCKED`, `docs governance v2 - DB roles` |
| `referenced_in_ADRs` | 0003, 0004 |
| `inferred_purpose` | Concrete test plans (unit / integration / e2e), regression risks, tools needed (jest/playwright). |
| `recommendation` | **KEEP** — but flag: prompt mentions jest/playwright but the repo has neither configured (per CLAUDE.md notes). Refresh when test infrastructure exists OR change examples to current actual tooling. |

**Skills (7)**: list_recent_tickets, read_design_doc, read_knowledge_base, read_property_settings, read_repo_file, search_repo

---

### 9. Scribe Scott (`documentarian`)

| Field | Value |
|---|---|
| `agent_id` | 23 · 📚 · dept `it` |
| `prompt_version` | **v2** · `manual` (updated today as part of docs governance Phase 2) |
| `runs_30d` / `cost_30d` | 0 / 0 |
| `reports_to` | Captain Kit |
| `referenced_in_KB` | `AGENT AUTHORITY MATRIX LOCKED`, `agents who own documentation`, `docs governance — how to write a doc`, `documentation governance non-negotiables`, `documentation policy LOCKED`, `documentation requirements per feature`, `docs governance IMPLEMENTED 2026-05-06`, `docs governance v2 - DB roles` |
| `referenced_in_ADRs` | 0002 (superseded), 0003, 0004 |
| `inferred_purpose` | Owner of all 7 governed documents. Workflow: read_doc(staging) → compose → write_doc_staging(parent_version) → propose_promotion(auto=true for arch/data_model/api, false for the other 4). Always writes to staging schema, never production. |
| `recommendation` | **KEEP** — most-referenced agent in KB (8 entries). v2 prompt is solid + actionable. Genuinely loaded with the right authority + skills. |

**Skills (11)**: add_knowledge_base_entry, propose_promotion, read_audit_log, read_design_doc, read_doc, read_knowledge_base, read_property_settings, read_repo_file, run_backup, search_repo, write_doc_staging

---

### 10. Operator Olive (`ops_lead`)

| Field | Value |
|---|---|
| `agent_id` | 7 · 📞 · dept `it` |
| `prompt_version` | v1 · `seed` · created 2026-05-06 11:05 |
| `runs_30d` / `cost_30d` | 0 / 0 |
| `reports_to` | Captain Kit |
| `referenced_in_KB` | (none directly — the role is the catch-all for non-IT work) |
| `referenced_in_ADRs` | 0003 |
| `inferred_purpose` | Catch-all for requests outside dev/design/research scope (Cloudbeds config, Make.com scenarios, accounting, scheduling). Outputs owner (PBS / external_partner / automation), next action, deps. |
| `recommendation` | **KEEP** — but consider renaming as the agent network grows. As soon as a real "Marketing Department" or "Revenue Department" spawns, ops_lead becomes truly catch-all (everything-else). Could merge with `none` (the fallback dispatcher) since their behaviour overlaps. |

**Skills (7)**: list_recent_tickets, read_audit_log, read_design_doc, read_knowledge_base, read_property_settings, run_backup, web_fetch

---

### 11. Sentinel Sergei (`security`)

| Field | Value |
|---|---|
| `agent_id` | 22 · 🛡️ · dept `it` |
| `prompt_version` | v1 · `seed` · created 2026-05-06 13:57 (NEWEST agent) |
| `runs_30d` / `cost_30d` | 0 / 0 |
| `reports_to` | Captain Kit (parallel authority to Sheriff Sigma) |
| `referenced_in_KB` | `AGENT AUTHORITY MATRIX LOCKED`, `DB ROLE SEPARATION LOCKED`, `agent autonomy v2 - my pushbacks`, `docs governance v2 - DB roles` |
| `referenced_in_ADRs` | 0003 |
| `inferred_purpose` | Supabase advisor runner + RLS hardener + security doc updater. Authority: apply auto-fixable findings WITH mandatory dry-run; requires approval for RLS strategy changes / disabling checks / tenant isolation / auth architecture. |
| `recommendation` | **KEEP** but **REFRESH PROMPT** — current prompt is much shorter than peers (no full property guardrail block, no context-first instruction, no detailed JSON schema). Bring it to parity with siblings before any production work. |

**Skills (10)**: add_knowledge_base_entry, propose_promotion, query_supabase_view, read_audit_log, read_design_doc, read_doc, read_knowledge_base, read_property_settings, read_repo_file, search_repo, write_doc_staging

**Full prompt (v1, terse — flagged for refresh):**
```
AI Security Agent (Sentinel Sergei). Property: The Namkhan, 5-star eco-retreat, Luang Prabang Laos. NEVER invent property facts. FULL AUTHORITY: run Supabase Security and Performance Advisors, apply auto-fixable findings with mandatory dry-run first, update Security doc in staging, re-run advisors. REQUIRES APPROVAL: RLS strategy changes, disabling security checks, tenant isolation changes, auth architecture changes. DB role: ai_security_agent (read all, write RLS/indexes/policies + documentation_staging Security doc only). FAIL-SAFE: re-read+retry, try alternative, log blocked + notify with full context. No spam. OUTPUT: single JSON.
```

---

### 12. Quill Quincy (`code_spec_writer`)

| Field | Value |
|---|---|
| `agent_id` | 14 · ✍️ · dept `it` |
| `prompt_version` | v1 · `seed` · created 2026-05-06 11:13 |
| `runs_30d` / `cost_30d` | 0 / 0 |
| `reports_to` | Captain Kit (auto-fired on user approval, not via triage routing) |
| `referenced_in_KB` | `AGENT AUTHORITY MATRIX LOCKED`, `agents who own documentation`, `docs governance v2 - DB roles` |
| `referenced_in_ADRs` | 0003, 0004 |
| `inferred_purpose` | Generates GitHub-issue-ready specs (markdown) from approved tickets. Sections: Goal / Acceptance criteria / Files to create / Files to edit / Schema changes / Tests / Rollback / Out of scope. |
| `recommendation` | **KEEP** — clear single-purpose output. Could be invoked more aggressively (today only fires on approval). Consider auto-firing on every "completed" ticket too. |

**Skills (9)**: list_recent_tickets, propose_promotion, read_design_doc, read_doc, read_knowledge_base, read_property_settings, read_repo_file, search_repo, write_doc_staging

---

### 13. Forge Astra (`skill_creator`)

| Field | Value |
|---|---|
| `agent_id` | 16 · 🔨 · dept `it` |
| `prompt_version` | v1 · `seed` · created 2026-05-06 11:40 |
| `runs_30d` / `cost_30d` | 0 / 0 |
| `reports_to` | Captain Kit |
| `referenced_in_KB` | (referenced in IT Manager prompt as the routing target for "new skill" requests; not in standalone KB entry) |
| `referenced_in_ADRs` | 0003 |
| `inferred_purpose` | Designs new skill specs (name, description, input_schema, handler, assigned_roles, implementation_notes). The actual handler code MUST be written by a developer — this agent only proposes. Also has access to `create_department` skill (the only worker besides it_manager who does). |
| `recommendation` | **KEEP** — but underused. Captain Kit could call this more often when user requests imply new tooling. |

**Skills (5)**: create_department, read_knowledge_base, read_property_settings, read_repo_file, search_repo

---

### 14. Generalist Glen (`none`)

| Field | Value |
|---|---|
| `agent_id` | 8 · 🃏 · dept `it` |
| `prompt_version` | v1 · `seed` · created 2026-05-06 11:05 |
| `runs_30d` / `cost_30d` | 0 / 0 |
| `reports_to` | (fallback only — no real reports_to) |
| `referenced_in_KB` | (none directly — used as the fallback `recommended_agent` when nothing else fits) |
| `referenced_in_ADRs` | 0003 |
| `inferred_purpose` | Generic dispatcher. Triggered when IT Manager flags a ticket as having no specific agent owner. Output: summary, needs_human_decision flag, open_questions. |
| `recommendation` | **MERGE WITH `ops_lead`** — both are catch-alls. Operator Olive at least has a domain (out-of-IT-scope). Generalist Glen is pure fallback that adds an extra hop. Soft-archive Glen, route everything Glen would handle to Operator Olive instead. PBS confirms? |

**Skills (1)**: read_property_settings

---

## Prompt-version archive (audit-only — DO NOT remove)

These are inactive prior versions (`active=false`). Hard rule: never deleted.

| Role | Versions retained | Most recent inactive |
|---|---|---|
| `it_manager` | v1, v2, v3, v4, v5, v6, v7 | v7 (replaced by v8 today) |
| `documentarian` | v1 | v1 (replaced by v2 today) |
| `researcher` | v1 | v1 (replaced by v2 via meta_update today) |

## Summary recommendations

| Agent | Recommendation |
|---|---|
| 🧭 Captain Kit (it_manager) | **KEEP** — freeze v8 for a week; gather behaviour data |
| 🛠️ Foreman Felix (lead) | **KEEP** — needs a real-world test before pyramid restructure |
| 🎨 Pixel Pia (frontend) | **KEEP + REFRESH** — add canonical page pattern to prompt |
| ⚙️ Schema Sage (backend) | **KEEP** — well-bounded, central role |
| ✨ Brand Bea (designer) | **REFRESH** — generic prompt; add canonical page pattern reference |
| 🔍 Detective Data (researcher) | **KEEP** — strongest tool kit, v2 meta-refined |
| 🛡️ Sheriff Sigma (reviewer) | **KEEP** — but consider partial overlap with Sentinel Sergei |
| 🧪 QA Quinn (tester) | **KEEP + REFRESH** — examples reference tooling not in repo |
| 📚 Scribe Scott (documentarian) | **KEEP** — most-referenced agent, v2 solid |
| 📞 Operator Olive (ops_lead) | **KEEP** — but absorb Generalist Glen's fallback role |
| 🛡️ Sentinel Sergei (security) | **KEEP + REFRESH PROMPT** — needs parity with siblings |
| ✍️ Quill Quincy (code_spec_writer) | **KEEP** — could auto-fire more often |
| 🔨 Forge Astra (skill_creator) | **KEEP** — underused; Captain Kit should route to it more |
| 🃏 Generalist Glen (none) | **MERGE/ARCHIVE** — fold into Operator Olive |

## Forensic notes

1. **Zero `agent_run` audit rows in 30d**: today's interactions used the synchronous chat-route triage path, which logs as `action='triage'` with `agent='it_manager'`. The agent worker (which would log `action='agent_run'`) ran a handful of test tickets only. Real-world traffic is too thin to draw conclusions about per-role utilisation. **PBS should fire 5-10 real cockpit chat requests over the next week** to populate metrics before any structural decisions.

2. **All 14 active agents in dept `it`**: the multi-department capability exists (`cockpit_departments` table seeded with `it`, `create_department` skill in place) but no other departments have been spawned yet. Marketing/Sales/Revenue departments are ready to materialise on first `create_department` call.

3. **Prompt-source distribution**: 11 of 14 agents are `seed` (created via initial migration). Only 3 are `manual` or `meta_update` — meaning user-driven refinement has been concentrated on Captain Kit, Detective Data, and Scribe Scott. Other agents are running on first-draft prompts — fragile until tested.

4. **Skill distribution**: avg 8.4 skills/agent. Min 1 (Glen). Max 11 (Captain Kit, Detective Data, Scribe Scott). Workers without `read_knowledge_base` (none assigned): only Glen — confirms Glen as outlier.

5. **The deleted_PROHIBITED status enum value is a tripwire**: should never appear in any row. If audit queries find it, that's an immediate incident.

## What this inventory does NOT change

- No agents archived
- No prompts modified
- No skills reassigned
- No KB entries deleted
- All 14 agents remain `active`

## Awaiting per-agent decision from PBS

Per Phase 0 spec — PBS reviews recommendations above + decides per-agent action. ONLY THEN proceed with Parts 4-7.
