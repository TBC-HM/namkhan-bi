// lib/entitlements.ts
// Monetization Engine v1 (brief monetization-engine-v1) — entitlement enforcement.
//
// Adopted law (brief §"Adopted as law"): "Entitlements checked BEFORE task
// execution." This module is the single TS choke point that both skill
// execution paths call before running any skill:
//   1. lib/cockpit-skills/dispatcher.ts → executeSkill()   (chat persona path)
//   2. lib/cockpit-tools.ts → dispatchSkillGated()          (agent runner + it_manager path)
//
// Semantics (rule 594 agent-class decisions, logged in the brief build log):
// - Enforcement fires ONLY when a tenant context exists: the skill call carries
//   a numeric property_id AND the skill maps to a tenancy module. Holding-scope
//   skills (IT, Platform, Legal, Strategy) and calls without a property context
//   are platform work — property entitlements do not apply to them.
// - A skill whose serves_module is set but unmappable to any tenancy module is
//   DENIED when called with a property context (deny-by-default, mirroring
//   commercial.fn_entitlement_check's default_deny for unknown modules).
// - Infrastructure failure of the check RPC fails OPEN with a console.warn —
//   same posture as the call_skill governance gate in dispatcher.ts ("the gate
//   is best-effort governance, not a security boundary; RLS is the boundary").
//   An explicit allowed=false from the engine always DENIES.
//
// public.fn_entitlement_check is service_role-only (migration
// monetization_v1_entitlement_acl_and_bridge_serves_module) — this module must
// only ever be imported from server-side code with a service-role client.

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * cap_skills.serves_module (display labels) → tenancy.modules.module_code.
 * `null` = holding/platform scope: property entitlements do not apply.
 * Labels verified against live cockpit.cap_skills + tenancy.modules 2026-08-01.
 */
const MODULE_CODE_MAP: Record<string, string | null> = {
  // Tenant modules
  'Guest': 'guest_crm',
  'HR · People': 'hr_people',
  'HR · Background Check': 'hr_people',
  'Marketing · Media': 'marketing',
  'Marketing · Newsletter': 'marketing',
  'Marketing · YouTube': 'marketing',
  'Operations': 'operations',
  'Sales': 'sales',
  // Holding/platform scope — no tenant entitlement applies
  'Legal': null,
  'Strategy': null,
  'Platform': null,
  'IT · Codebase': null,
  'IT · Database': null,
  'IT · Deploy': null,
  'IT · Knowledge': null,
  'IT · Platform': null,
};

/** Canonical tenancy module codes (pass-through when serves_module already uses a code). */
const TENANCY_MODULE_CODES = new Set([
  'activities', 'fb_pos', 'finance', 'frontoffice', 'guest_crm', 'hr_people',
  'marketing', 'operations', 'platform_required', 'revenue', 'sales', 'spa',
  'utilities',
]);

export type EntitlementVerdict = {
  allowed: boolean;
  /** Why: 'no_property_context' | 'holding_scope' | 'no_module_mapping_deny' |
   * engine sources ('property_modules' | 'override_allow' | 'override_deny' |
   * 'default_deny') | 'check_failed_open'. */
  source: string;
  moduleCode: string | null;
  propertyId: number | null;
};

/** Extract a numeric property_id from a skill input payload, if present. */
export function propertyIdFromInput(input: Record<string, unknown> | null | undefined): number | null {
  if (!input || typeof input !== 'object') return null;
  const raw = (input as { property_id?: unknown }).property_id
    ?? (input as { p_property_id?: unknown }).p_property_id;
  const n = typeof raw === 'string' ? Number(raw) : raw;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

/** Resolve a cap_skills.serves_module label to a tenancy module code (or null = exempt). */
export function resolveModuleCode(servesModule: string | null | undefined): { mapped: boolean; code: string | null } {
  if (!servesModule) return { mapped: true, code: null }; // no module declared → holding scope
  if (servesModule in MODULE_CODE_MAP) return { mapped: true, code: MODULE_CODE_MAP[servesModule] };
  const lower = servesModule.toLowerCase();
  if (TENANCY_MODULE_CODES.has(lower)) return { mapped: true, code: lower };
  return { mapped: false, code: null }; // unmappable label
}

// serves_module lookups by skill name (dispatchSkillGated path has no LoadedSkill).
const SERVES_CACHE = new Map<string, { at: number; serves: string | null }>();
const SERVES_CACHE_TTL_MS = 60_000;

async function lookupServesModule(supa: SupabaseClient, skillName: string): Promise<string | null> {
  const now = Date.now();
  const hit = SERVES_CACHE.get(skillName);
  if (hit && now - hit.at < SERVES_CACHE_TTL_MS) return hit.serves;
  const { data, error } = await supa
    .from('cockpit_agent_skills')
    .select('serves_module')
    .eq('name', skillName)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn(`[entitlements] serves_module lookup failed for ${skillName}: ${error.message}`);
    return null; // treated as holding scope (fail-open on lookup infra failure)
  }
  const serves = (data?.serves_module as string | null) ?? null;
  SERVES_CACHE.set(skillName, { at: now, serves });
  return serves;
}

/**
 * Check whether a skill call is entitled to run in its tenant context.
 * Pass `servesModule` when the caller already holds it (executeSkill path);
 * otherwise it is looked up by `skillName` (dispatchSkillGated path).
 */
export async function checkSkillEntitlement(opts: {
  supa: SupabaseClient;
  skillName: string;
  servesModule?: string | null;
  input: Record<string, unknown> | null | undefined;
}): Promise<EntitlementVerdict> {
  const propertyId = propertyIdFromInput(opts.input);
  if (propertyId === null) {
    return { allowed: true, source: 'no_property_context', moduleCode: null, propertyId: null };
  }

  const serves = opts.servesModule !== undefined
    ? opts.servesModule
    : await lookupServesModule(opts.supa, opts.skillName);

  const { mapped, code } = resolveModuleCode(serves);
  if (!mapped) {
    // Deny-by-default: declared module label we cannot map to tenancy.
    return { allowed: false, source: 'no_module_mapping_deny', moduleCode: serves ?? null, propertyId };
  }
  if (code === null) {
    return { allowed: true, source: 'holding_scope', moduleCode: null, propertyId };
  }

  try {
    const { data, error } = await opts.supa.rpc('fn_entitlement_check', {
      p_property_id: propertyId,
      p_module_code: code,
    });
    if (error) {
      console.warn(`[entitlements] fn_entitlement_check rpc failed (${opts.skillName}/${code}): ${error.message}`);
      return { allowed: true, source: 'check_failed_open', moduleCode: code, propertyId };
    }
    const verdict = data as { allowed?: boolean; source?: string } | null;
    return {
      allowed: !!verdict?.allowed,
      source: verdict?.source ?? 'default_deny',
      moduleCode: code,
      propertyId,
    };
  } catch (e) {
    console.warn(`[entitlements] fn_entitlement_check threw (${opts.skillName}/${code}):`, e);
    return { allowed: true, source: 'check_failed_open', moduleCode: code, propertyId };
  }
}
