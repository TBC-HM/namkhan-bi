// Shape of public.fn_dept_qa_payload(p_property_id, p_dept) and, for the
// audit-reports block, public.fn_audit_documents(p_property_id).
//
// Transcribed from the LIVE payload (Supabase MCP execute_sql against project
// kpenyneooigsyuuomgct, 2026-09-14) and from public.fn_dept_qa_payload's own
// jsonb_build_object / pg_get_functiondef, not from the task brief's prose or from
// memory — see db/proposed/dept-qa/004_dept_qa_payload.sql.md and
// .superpowers/sdd/2026-09-14-department-qa-discharge-modes/task-4-report.md for the
// verification queries this was checked against. A mistyped column here is a compile
// error, never a silent "—" on screen.

export type DischargeMode = 'procedure' | 'rule' | 'evidence' | 'observation';

export interface PersonRow {
  staff_id: string;
  name: string;
  position: string | null;
}

export interface Obligation {
  atom_id: string;
  title: string;
  /** requirement_text from standards.atoms — auditor language. */
  text: string;
  /** the HoD's plain-English rewrite (Task 6). Null until that task runs for this atom. */
  staff_wording: string | null;
  /** comma-joined origin tags, e.g. "SLH, ASEAN" — string_agg, so can be null if the
   *  atom has no linked source row. */
  authorities: string | null;
  category: string | null;
  mode: DischargeMode;
  /** 'seeded' (the classifier's guess) or 'edited' (a HoD corrected it); null if
   *  somehow never classified. */
  mode_source: string | null;
  covered: boolean;
  sop_code: string | null;
  /** true when THIS department is the second owner (standards.atoms.dept_code_2),
   *  not the first — the obligation still belongs on this page, but another
   *  department leads it. */
  is_shared: boolean;
}

export interface ModeRow {
  mode: DischargeMode;
  atoms: number;
  covered: number;
  /** true for 'procedure' only. 'evidence' is NOT coverable — `covered` above is
   *  derived from standards.sop_coverage (an SOP-coverage signal) for every mode,
   *  and ops.sustainability_evidence (the store the spec names for evidence) is
   *  wired nowhere; claiming evidence coverage from an SOP match would be a false
   *  positive (a separate brief wires the real evidence register). 'rule' has no
   *  training store to check, and 'observation' is scored by audit, never closed by
   *  a document — neither ever claims coverage either. */
  coverable: boolean;
}

/** knowledge.qa_audits, audit_type = 'slh_mystery_inspection', aggregated across this
 *  department's sections. This is a plain aggregate with no GROUP BY, so the scalar
 *  subquery in the RPC always returns exactly one row — `scores` itself is never JSON
 *  null. But when the department has no audited sections (e.g. boat), every
 *  aggregate over that empty set is SQL NULL except count(*), so `slh_sections` is 0
 *  and every other field is null. TREAT `slh_pct === null` AS "NOT YET AUDITED" —
 *  never render it as 0%; a 0% reads as a failed inspection, not an absent one. */
export interface ScoresBlock {
  slh_pct: number | null;
  slh_worst_pct: number | null;
  slh_sections: number;
  slh_audited_at: string | null;
  slh_top_miss: string | null;
}

export interface OpenBlock {
  findings_open: number;
  findings_total: number;
}

export interface DeptQaPayload {
  generated_at: string;
  property_id: number;
  dept_code: string;
  /** null only if ops.departments has no row for this property+code. */
  dept_name: string | null;
  /** zero-safe: COALESCE(..., '[]'::jsonb) + count(*) FILTER, so a department with
   *  no active staff (gm, hr, purchasing) gets {active:0, rows:[]}, never null. This
   *  is a normal shape — those obligations sit with management — not a data gap. */
  people: { active: number; rows: PersonRow[] };
  obligations: Obligation[];
  by_mode: ModeRow[];
  scores: ScoresBlock;
  /** zero-safe like `people` — {findings_open:0, findings_total:0} for a department
   *  with no qa_findings rows, never null. */
  open: OpenBlock;
}

/** public.fn_audit_documents(p_property_id) — dms.documents WHERE doc_type='audit'.
 *  PROPERTY-WIDE, not per-department: the same rows come back regardless of which
 *  dept page called it. Render that fact, don't let a HoD read these as their own. */
export interface AuditDocument {
  doc_id: string;
  title: string;
  doc_subtype: string | null;
  /** 'confidential' | 'internal' | other values the register may add later — treat
   *  anything truthy and not 'internal'/'public' as worth labelling, rather than an
   *  exact-match enum, so a new sensitivity value fails open (labelled) not closed
   *  (silently hidden). */
  sensitivity: string | null;
  file_name: string;
  mime: string | null;
  file_size_bytes: number | null;
  /** a date (YYYY-MM-DD), not a timestamp. */
  dated: string | null;
}
