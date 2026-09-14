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
console.log(`classification read: ${rows.length} rows; wrote: ${updates.length} atoms:`, counts);

// PostgREST applies a project-wide db-max-rows cap. A short read of
// fn_standards_atoms_for_classification (rows.length < the true atom count)
// completes silently and this script would otherwise exit 0 having classified
// only part of the table — this repo has been bitten by exactly that before
// (commit a5a62df8: a merge route read 1,000 of 1,880 requirements and said
// nothing). Read back the unclassified count from a scalar-returning function
// (not subject to row capping) to make a truncated read fail loudly instead.
const { data: unclassified, error: cErr } = await sb.rpc('fn_standards_unclassified_count');
if (cErr) { console.error(cErr); process.exit(1); }

console.log(`unclassified after write: ${unclassified}`);

if (unclassified > 0) {
  console.error(
    `FAILED: ${unclassified} atom(s) still have discharge_mode IS NULL after this run. ` +
    `Likely cause: the classification read (${rows.length} rows) was truncated by ` +
    `PostgREST's db-max-rows cap before it reached every atom. Re-run after confirming ` +
    `fn_standards_atoms_for_classification returned the full table, not a capped page.`
  );
  process.exit(1);
}
