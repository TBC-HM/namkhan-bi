// scripts/seed-discharge-modes.mjs
//
// Classifies every atom that has no HoD correction. Re-runnable: rows with
// mode_source='edited' are never touched, so a HoD's fix survives every re-seed.
import { createClient } from '@supabase/supabase-js';
import { dischargeModeFor } from '../lib/standards/dischargeMode.ts';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: rows, error } = await sb.rpc('fn_standards_atoms_for_classification');
if (error) { console.error(error); process.exit(1); }

const updates = rows
  .filter((r) => r.mode_source !== 'edited')
  .map((r) => ({
    atom_id: r.atom_id,
    discharge_mode: dischargeModeFor({
      authority: r.authority ?? '', sourceTitle: r.source_title ?? '',
      category: r.category, text: r.requirement_text ?? '',
    }),
  }));

const { error: wErr } = await sb.rpc('fn_standards_set_discharge_modes', { p_rows: updates });
if (wErr) { console.error(wErr); process.exit(1); }

const counts = updates.reduce((a, u) => ({ ...a, [u.discharge_mode]: (a[u.discharge_mode] ?? 0) + 1 }), {});
console.log(`classified ${updates.length} atoms:`, counts);
