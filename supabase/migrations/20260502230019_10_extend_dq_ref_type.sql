-- ============================================================================
-- Migration: 10_extend_dq_ref_type  (Phase 2.5)
-- Version:   20260502230019
-- Date:      2026-05-02
-- ----------------------------------------------------------------------------
-- gl.dq_findings.ref_type was originally finance-shaped (account/class/txn/
-- period/upload/vendor). Extend to support Phase 2.5 inventory + procurement
-- ref types so the DQ engine can route findings to the right entity.
-- Existing rows all use 'period' — non-destructive change.
-- ============================================================================

ALTER TABLE gl.dq_findings
  DROP CONSTRAINT IF EXISTS dq_findings_ref_type_check;
ALTER TABLE gl.dq_findings
  ADD CONSTRAINT dq_findings_ref_type_check CHECK (
    ref_type = ANY (ARRAY[
      'account','class','txn','period','upload','vendor',
      'inv_item','inv_movement','inv_count','inv_count_line',
      'fa_asset','proc_request','proc_purchase_order','supplier'
    ])
  );
