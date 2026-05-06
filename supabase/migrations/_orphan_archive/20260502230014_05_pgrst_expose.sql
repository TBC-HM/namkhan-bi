-- ============================================================================
-- Migration: 05_pgrst_expose  (Phase 2.5)
-- Version:   20260502230014
-- Date:      2026-05-02
-- ----------------------------------------------------------------------------
-- Expose suppliers/fa/inv/proc schemas to PostgREST so frontend can read them.
-- Per repo convention (memory: pgrst.db_schemas — always merge, never overwrite),
-- this MERGES new schemas into the existing list. Read current value first if
-- this migration is ever modified.
-- ============================================================================

ALTER ROLE authenticator
  SET pgrst.db_schemas TO 'public, graphql_public, marketing, governance, guest, gl, suppliers, fa, inv, proc';

NOTIFY pgrst, 'reload config';
