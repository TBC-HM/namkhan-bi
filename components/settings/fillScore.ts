// components/settings/fillScore.ts
// PBS 2026-07-18 · shared helper for the Property Settings completeness KPI.
// Counts NULL / empty-string / empty-array fields in a data object, ignoring
// meta columns (id · timestamps · foreign keys to tenant/property). Works on:
//   - single-row panels: pass the row object → returns { missing, tracked }
//   - collection panels: pass an array → sums NULLs across all rows × cols
// The helper is intentionally schema-agnostic (no per-panel field lists) so it
// stays useful as columns are added to property.* tables without maintenance.

const META_KEYS = new Set([
  'id', 'created_at', 'updated_at', 'deleted_at',
  'property_id', 'tenant_id', 'tenant_scope', 'organization_id',
  // per-table PKs commonly named *_id
  'facility_id', 'activity_id', 'room_type_id', 'certification_id',
  'contact_id', 'season_id', 'transport_id', 'boat_id', 'cruise_id',
  'license_id', 'social_id', 'staff_id', 'emp_id', 'retreat_id', 'treatment_id',
  // computed / display-order (not fields the operator fills)
  'display_order', 'sort_order', 'is_active',
]);

function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  if (typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v).length === 0) return true;
  return false;
}

function scoreRow(row: Record<string, unknown>): { missing: number; tracked: number } {
  let missing = 0;
  let tracked = 0;
  for (const key of Object.keys(row)) {
    if (META_KEYS.has(key)) continue;
    tracked += 1;
    if (isEmpty(row[key])) missing += 1;
  }
  return { missing, tracked };
}

export function fillScore(input: unknown): { missing: number; tracked: number } {
  if (input == null) return { missing: 0, tracked: 0 };
  if (Array.isArray(input)) {
    let missing = 0;
    let tracked = 0;
    for (const row of input) {
      if (row && typeof row === 'object') {
        const r = scoreRow(row as Record<string, unknown>);
        missing += r.missing;
        tracked += r.tracked;
      }
    }
    return { missing, tracked };
  }
  if (typeof input === 'object') return scoreRow(input as Record<string, unknown>);
  return { missing: 0, tracked: 0 };
}

export function fillScoreAll(data: Record<string, unknown>): { missing: number; tracked: number } {
  let missing = 0;
  let tracked = 0;
  for (const key of Object.keys(data)) {
    const r = fillScore(data[key]);
    missing += r.missing;
    tracked += r.tracked;
  }
  return { missing, tracked };
}