-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502205403
-- Name:    phase2_5_10_extend_dq_ref_type
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Extend gl.dq_findings.ref_type CHECK to allow Phase 2.5 inventory/procurement
-- ref types. Existing rows all use 'period', so extending is non-destructive.
ALTER TABLE gl.dq_findings
  DROP CONSTRAINT IF EXISTS dq_findings_ref_type_check;
ALTER TABLE gl.dq_findings
  ADD CONSTRAINT dq_findings_ref_type_check CHECK (
    ref_type = ANY (ARRAY[
      -- Finance (existing)
      'account','class','txn','period','upload','vendor',
      -- Phase 2.5 inventory + procurement
      'inv_item','inv_movement','inv_count','inv_count_line',
      'fa_asset','proc_request','proc_purchase_order','supplier'
    ])
  );
