// app/cockpit-v2/_lib/types.ts
// Shared types for the cockpit-v2 routes. Mirrors columns in
// cockpit.id_agents / cap_skills / cap_skill_calls / kn_agent_memory /
// cap_prompts and documentation.documents.

export type Agent = {
  role: string;
  display_name: string | null;
  avatar: string | null;
  tagline: string | null;
  color: string | null;
  property_id: number | null;
  hierarchy_level: string | null;
  reports_to: string | null;
  dept: string | null;
  status: string | null;
  scope: string | null;
  updated_at: string | null;
};

export type Skill = {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  cost_class: string | null;
  authority_level: string | null;
  active: boolean | null;
};

export type AgentSkill = { role: string; skill_id: number; enabled: boolean | null };

export type SkillCall = {
  id: number;
  ticket_id: number | null;
  role: string;
  skill_id: number | null;
  skill_name: string | null;
  input: unknown;
  output: unknown;
  error: unknown;
  duration_ms: number | null;
  cost_usd_milli: number | null;
  was_dry_run: boolean | null;
  status: string | null;
  created_at: string;
  completed_at: string | null;
};

export type AgentMemory = {
  id: number;
  agent_handle: string;
  memory_type: string | null;
  content: string;
  topics: string[] | null;
  confidence: number | null;
  importance: number | null;
  active: boolean | null;
  updated_at: string | null;
  property_id: number | null;
};

export type Prompt = {
  id: number;
  role: string;
  prompt: string;
  version: number;
  active: boolean | null;
  notes: string | null;
  source: string | null;
  department: string | null;
  status: string | null;
  updated_at: string | null;
};

export type Document = {
  id: string;
  doc_type: string;
  title: string;
  content_md: string;
  version: number;
  status: string;
  last_updated_by: string | null;
  last_updated_at: string | null;
};

// Run-counter aggregate per role from cap_skill_calls.
export type RoleRunStats = {
  role: string;
  lifetime: number;
  last_7d: number;
  latest: string | null;
};

export const PROPERTY_NAMKHAN = 260955;
export const PROPERTY_DONNA = 1000001;

export type PropertyId = typeof PROPERTY_NAMKHAN | typeof PROPERTY_DONNA;

// --- Schemas tab (#77) ------------------------------------------------------
export type SchemaObject = {
  schema_name: string;
  object_name: string;
  object_kind: string;
  est_row_count: number;
  has_grants: boolean;
  last_ddl_at: string | null;
};

// --- Activity tab (#77 cont.) ----------------------------------------------
export type ActivityEvent = {
  source: 'aud_change_log' | 'intake_items' | 'cap_skill_calls' | 'cockpit_audit_log';
  id: string | number;
  at: string;
  actor: string | null;
  action: string | null;
  target: string | null;
  status: string | null;
  detail: string | null;
  link: string | null;
};
