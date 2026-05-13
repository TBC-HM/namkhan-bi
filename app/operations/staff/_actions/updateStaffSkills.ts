// app/operations/staff/_actions/updateStaffSkills.ts
// PBS 2026-05-13 — write skills array to ops.staff_employment.skills.
// Also returns the property's full skill catalog (distinct values across
// every employee) so the popup can suggest existing tags.

'use server';

import { supabase } from '@/lib/supabase';

export async function updateStaffSkills(staffId: string, skills: string[]): Promise<{ ok: boolean; error?: string }> {
  if (!staffId) return { ok: false, error: 'missing staff id' };
  // Normalize: trim, dedupe, drop empties
  const clean = Array.from(new Set(skills.map((s) => s.trim()).filter(Boolean)));
  const { error } = await supabase
    .schema('ops')
    .from('staff_employment')
    .update({ skills: clean, updated_at: new Date().toISOString() })
    .eq('id', staffId);
  if (error) {
    console.error('updateStaffSkills error', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function fetchSkillCatalog(propertyId: number): Promise<string[]> {
  // PBS 2026-05-13: catalog is the UNION of:
  //   (a) canonical `ops.skills` rows tagged for this property (seeded list),
  //   (b) any free-text skill already saved on an employee
  //       (`staff_employment.skills` text[]).
  // Donna had no employees tagged → catalog was empty. Seeding ops.skills
  // alone now flows into the popup without needing tag-by-tag onboarding.
  const [catalogRes, tagsRes] = await Promise.all([
    supabase
      .schema('ops')
      .from('skills')
      .select('code')
      .eq('property_id', propertyId),
    supabase
      .schema('ops')
      .from('staff_employment')
      .select('skills')
      .eq('property_id', propertyId),
  ]);
  if (catalogRes.error) console.error('fetchSkillCatalog ops.skills error', catalogRes.error);
  if (tagsRes.error)    console.error('fetchSkillCatalog tags error', tagsRes.error);

  const set = new Set<string>();
  for (const row of (catalogRes.data as { code: string | null }[]) ?? []) {
    const t = (row.code ?? '').trim();
    if (t) set.add(t);
  }
  for (const row of (tagsRes.data as { skills: string[] | null }[]) ?? []) {
    if (Array.isArray(row.skills)) {
      for (const s of row.skills) {
        const t = (s ?? '').trim();
        if (t) set.add(t);
      }
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
