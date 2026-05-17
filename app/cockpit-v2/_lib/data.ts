// app/cockpit-v2/_lib/data.ts
//
// Server-side data fetchers for the cockpit-v2 tabs. Every read uses the
// service-role client against PUBLIC views of cockpit.* tables.
//
// IMPORTANT (2026-05-17, claude_md §0.5):
//   PostgREST only exposes the `public` schema. `sbCockpit` with
//   db:{schema:'cockpit'} silently returns []. Every fetcher therefore
//   uses getSupabaseAdmin() against the corresponding public view:
//
//     cockpit.id_agents          -> public.cockpit_agent_identity
//     cockpit.cap_skills         -> public.cockpit_skills_catalog
//     cockpit.cap_agent_skills   -> public.cockpit_agent_role_skills
//     cockpit.cap_skill_calls    -> public.cockpit_skill_calls
//     cockpit.kn_agent_memory    -> public.cockpit_agent_memory
//     cockpit.cap_prompts        -> public.cockpit_agent_prompts
//     cockpit.aud_change_log     -> public.cockpit_change_log
//     cockpit.intake_items       -> public.cockpit_intake_items
//
// fetchSchemaInventory still uses sbCockpit.rpc (different fix — separate scope).
// fetchDocs still uses sbDocs (documentation schema — separate scope).

import { sbCockpit, sbDocs } from './supabase-cockpit';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import type {
  Agent,
  Skill,
  AgentSkill,
  SkillCall,
  AgentMemory,
  Prompt,
  Document,
  RoleRunStats,
  SchemaObject,
  ActivityEvent,
} from './types';

// --- agents -----------------------------------------------------------------

export async function fetchAgents(): Promise<Agent[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('cockpit_agent_identity')
    .select('role, display_name, avatar, tagline, color, property_id, hierarchy_level, reports_to, dept, status, scope, updated_at')
    .neq('status', 'disabled')
    .order('property_id', { ascending: true, nullsFirst: true })
    .order('hierarchy_level', { ascending: true, nullsFirst: false })
    .order('dept', { ascending: true, nullsFirst: false })
    .order('role', { ascending: true });
  if (error) {
    console.error('[cockpit-v2] fetchAgents error', error);
    return [];
  }
  return (data as Agent[]) ?? [];
}

// --- skills + per-agent skill map ------------------------------------------

export async function fetchSkills(): Promise<Skill[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('cockpit_skills_catalog')
    .select('id, name, description, category, cost_class, authority_level, active')
    .order('category', { ascending: true })
    .order('name', { ascending: true });
  if (error) {
    console.error('[cockpit-v2] fetchSkills error', error);
    return [];
  }
  return (data as Skill[]) ?? [];
}

export async function fetchAgentSkills(): Promise<AgentSkill[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('cockpit_agent_role_skills')
    .select('role, skill_id, enabled');
  if (error) {
    console.error('[cockpit-v2] fetchAgentSkills error', error);
    return [];
  }
  return (data as AgentSkill[]) ?? [];
}

// --- run statistics ---------------------------------------------------------

export async function fetchRoleRunStats(): Promise<Record<string, RoleRunStats>> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('cockpit_skill_calls')
    .select('role, created_at')
    .gte('created_at', new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(5000);

  const { data: lifetimeRows, error: lifetimeErr } = await admin
    .from('cockpit_skill_calls')
    .select('role')
    .limit(50000);

  if (error || lifetimeErr) {
    console.error('[cockpit-v2] fetchRoleRunStats error', error, lifetimeErr);
    return {};
  }
  const sevenDayCut = Date.now() - 7 * 24 * 3600 * 1000;
  const stats: Record<string, RoleRunStats> = {};
  (lifetimeRows as Array<{ role: string }> | null)?.forEach((r) => {
    const k = r.role;
    stats[k] = stats[k] || { role: k, lifetime: 0, last_7d: 0, latest: null };
    stats[k].lifetime += 1;
  });
  (data as Array<{ role: string; created_at: string }> | null)?.forEach((r) => {
    const k = r.role;
    stats[k] = stats[k] || { role: k, lifetime: 0, last_7d: 0, latest: null };
    const t = new Date(r.created_at).getTime();
    if (t >= sevenDayCut) stats[k].last_7d += 1;
    if (!stats[k].latest || stats[k].latest! < r.created_at) {
      stats[k].latest = r.created_at;
    }
  });
  return stats;
}

export async function fetchAgentArchive(role: string, limit = 50): Promise<SkillCall[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('cockpit_skill_calls')
    .select('id, ticket_id, role, skill_id, skill_name, input, output, error, duration_ms, cost_usd_milli, was_dry_run, status, created_at, completed_at')
    .eq('role', role)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[cockpit-v2] fetchAgentArchive error', error);
    return [];
  }
  return (data as SkillCall[]) ?? [];
}

// --- knowledge --------------------------------------------------------------

export async function fetchMemories(opts?: {
  propertyId?: number | null;
  agentHandle?: string;
}): Promise<AgentMemory[]> {
  const admin = getSupabaseAdmin();
  let q = admin
    .from('cockpit_agent_memory')
    .select('id, agent_handle, memory_type, content, topics, confidence, importance, active, updated_at, property_id')
    .eq('active', true)
    .order('importance', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .limit(500);

  if (opts?.propertyId === null) q = q.is('property_id', null);
  else if (typeof opts?.propertyId === 'number') q = q.eq('property_id', opts.propertyId);
  if (opts?.agentHandle) q = q.eq('agent_handle', opts.agentHandle);

  const { data, error } = await q;
  if (error) {
    console.error('[cockpit-v2] fetchMemories error', error);
    return [];
  }
  return (data as AgentMemory[]) ?? [];
}

export async function fetchPrompts(opts?: { role?: string }): Promise<Prompt[]> {
  const admin = getSupabaseAdmin();
  let q = admin
    .from('cockpit_agent_prompts')
    .select('id, role, prompt, version, active, notes, source, department, status, updated_at')
    .eq('active', true)
    .order('updated_at', { ascending: false })
    .limit(500);
  if (opts?.role) q = q.eq('role', opts.role);
  const { data, error } = await q;
  if (error) {
    console.error('[cockpit-v2] fetchPrompts error', error);
    return [];
  }
  return (data as Prompt[]) ?? [];
}

export async function fetchPromptForRole(role: string): Promise<Prompt | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('cockpit_agent_prompts')
    .select('id, role, prompt, version, active, notes, source, department, status, updated_at')
    .eq('role', role)
    .eq('active', true)
    .order('version', { ascending: false })
    .limit(1);
  if (error) {
    console.error('[cockpit-v2] fetchPromptForRole error', error);
    return null;
  }
  return ((data as Prompt[]) ?? [])[0] ?? null;
}

// --- documents --------------------------------------------------------------

// PBS 2026-05-17: surface ALL 11 published doc_types in documentation.documents
// (was hardcoded to 3). Still uses sbDocs because that's the documentation
// schema -- separate fix scope.
export async function fetchDocs(): Promise<Document[]> {
  const { data, error } = await sbDocs
    .from('documents')
    .select('id, doc_type, title, content_md, version, status, last_updated_by, last_updated_at')
    .eq('status', 'published')
    .order('doc_type', { ascending: true })
    .order('version', { ascending: false });
  if (error) {
    console.error('[cockpit-v2] fetchDocs error', error);
    return [];
  }
  const seen = new Set<string>();
  return ((data as Document[]) ?? []).filter((d) => {
    if (seen.has(d.doc_type)) return false;
    seen.add(d.doc_type);
    return true;
  });
}

// --- schemas tab (#77) -----------------------------------------------------
// Still uses sbCockpit.rpc for now -- separate fix scope. fn_schema_inventory
// will need either a public.fn_schema_inventory wrapper or the cockpit
// schema exposed for PostgREST.

export async function fetchSchemaInventory(): Promise<SchemaObject[]> {
  const { data, error } = await sbCockpit.rpc('fn_schema_inventory');
  if (error) {
    console.error('[cockpit-v2] fetchSchemaInventory error', error);
    return [];
  }
  return (data as SchemaObject[]) ?? [];
}

// --- activity tab (#77 cont.) ----------------------------------------------

export async function fetchActivityEvents(limit = 200): Promise<ActivityEvent[]> {
  const admin = getSupabaseAdmin();
  const perSource = Math.max(50, Math.ceil((limit * 12) / 10));
  const events: ActivityEvent[] = [];

  // 1. public.cockpit_change_log  (cockpit.aud_change_log) — DDL/schema changes
  try {
    const { data, error } = await admin
      .from('cockpit_change_log')
      .select('id, changed_at, command_tag, object_type, schema_name, object_identity, current_user_name, application_name')
      .order('changed_at', { ascending: false })
      .limit(perSource);
    if (error) {
      console.error('[cockpit-v2] activity: cockpit_change_log error', error);
    } else {
      for (const r of (data as Array<{
        id: number;
        changed_at: string;
        command_tag: string | null;
        object_type: string | null;
        schema_name: string | null;
        object_identity: string | null;
        current_user_name: string | null;
        application_name: string | null;
      }> | null) ?? []) {
        events.push({
          source: 'aud_change_log',
          id: r.id,
          at: r.changed_at,
          actor: r.current_user_name ?? r.application_name ?? null,
          action: r.command_tag ?? 'DDL',
          target: r.object_identity ?? (r.schema_name ?? null),
          status: r.object_type ?? null,
          detail: r.object_type
            ? `${r.command_tag ?? 'DDL'} ${r.object_type} ${r.object_identity ?? ''}`.trim()
            : (r.command_tag ?? 'DDL'),
          link: null,
        });
      }
    }
  } catch (e) {
    console.error('[cockpit-v2] activity: cockpit_change_log threw', e);
  }

  // 2. public.cockpit_intake_items  (cockpit.intake_items) — incoming intake / triage
  try {
    const { data, error } = await admin
      .from('cockpit_intake_items')
      .select('id, created_at, updated_at, kind, title, status, priority, current_stage, routed_to, assignee_role, dept_slug, property_id')
      .order('updated_at', { ascending: false })
      .limit(perSource);
    if (error) {
      console.error('[cockpit-v2] activity: cockpit_intake_items error', error);
    } else {
      for (const r of (data as Array<{
        id: number;
        created_at: string;
        updated_at: string | null;
        kind: string | null;
        title: string | null;
        status: string | null;
        priority: string | null;
        current_stage: string | null;
        routed_to: string | null;
        assignee_role: string | null;
        dept_slug: string | null;
        property_id: number | null;
      }> | null) ?? []) {
        events.push({
          source: 'intake_items',
          id: r.id,
          at: r.updated_at ?? r.created_at,
          actor: r.assignee_role ?? r.routed_to ?? null,
          action: r.kind ?? 'intake',
          target: r.title ?? null,
          status: r.current_stage ?? r.status ?? null,
          detail: [r.priority, r.dept_slug, r.property_id ? `prop ${r.property_id}` : null]
            .filter(Boolean)
            .join(' · ') || null,
          link: `/h/it/intake/${r.id}`,
        });
      }
    }
  } catch (e) {
    console.error('[cockpit-v2] activity: cockpit_intake_items threw', e);
  }

  // 3. public.cockpit_skill_calls  (cockpit.cap_skill_calls) — every agent skill invocation
  try {
    const { data, error } = await admin
      .from('cockpit_skill_calls')
      .select('id, role, skill_name, status, duration_ms, was_dry_run, created_at')
      .order('created_at', { ascending: false })
      .limit(perSource);
    if (error) {
      console.error('[cockpit-v2] activity: cockpit_skill_calls error', error);
    } else {
      for (const r of (data as Array<{
        id: number;
        role: string;
        skill_name: string | null;
        status: string | null;
        duration_ms: number | null;
        was_dry_run: boolean | null;
        created_at: string;
      }> | null) ?? []) {
        events.push({
          source: 'cap_skill_calls',
          id: r.id,
          at: r.created_at,
          actor: r.role,
          action: r.skill_name ?? 'skill',
          target: r.was_dry_run ? 'dry-run' : 'live',
          status: r.status ?? null,
          detail: typeof r.duration_ms === 'number' ? `${r.duration_ms}ms` : null,
          // Link to /agent/[role] (debug surface replaces old archive drawer)
          link: `/cockpit-v2/agent/${encodeURIComponent(r.role)}`,
        });
      }
    }
  } catch (e) {
    console.error('[cockpit-v2] activity: cockpit_skill_calls threw', e);
  }

  // 4. public.cockpit_audit_log — governance writes
  try {
    const { data, error } = await admin
      .from('cockpit_audit_log')
      .select('id, created_at, agent, action, target, success, reasoning')
      .order('created_at', { ascending: false })
      .limit(perSource);
    if (error) {
      console.error('[cockpit-v2] activity: cockpit_audit_log error', error);
    } else {
      for (const r of (data as Array<{
        id: number;
        created_at: string;
        agent: string | null;
        action: string | null;
        target: string | null;
        success: boolean | null;
        reasoning: string | null;
      }> | null) ?? []) {
        events.push({
          source: 'cockpit_audit_log',
          id: r.id,
          at: r.created_at,
          actor: r.agent ?? null,
          action: r.action ?? null,
          target: r.target ?? null,
          status: r.success == null ? null : r.success ? 'ok' : 'fail',
          detail: r.reasoning ? r.reasoning.slice(0, 160) : null,
          link: null,
        });
      }
    }
  } catch (e) {
    console.error('[cockpit-v2] activity: cockpit_audit_log threw', e);
  }

  events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return events.slice(0, limit);
}
