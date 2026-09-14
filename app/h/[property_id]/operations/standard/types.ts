// Shape of public.fn_standards_payload(p_property_id, p_dept).
//
// Transcribed from the function's jsonb_build_object, not guessed. jsonb numerics
// arrive from PostgREST as numbers here (count(*) is bigint -> JSON number), but
// every count is guarded at the render site anyway, because a tenant with no
// ops.departments rows still gets a payload and must still render.

export interface AuthorityRow {
  /** SLH · ASEAN · Travelife · GSTC · Legal · Sustainability · PM */
  authority: string;
  /** raw requirements this authority contributed, before merging */
  requirements: number;
  /** atoms citing it — sums to MORE than the corpus, because a merged atom cites several */
  atoms: number;
  /** the document titles behind the authority, joined with ' · ' */
  documents: string | null;
}

export interface DeptRow {
  dept_code: string;
  /** ops.departments.name for this property, falling back to the code */
  dept_name: string;
  /** atoms this department owns FIRST. Sums across departments to totals.atoms. */
  atoms: number;
  /** atoms where this department is the SECOND owner — real obligations, counted
      under the primary owner's `atoms`, so never add the two columns together. */
  shared: number;
  /** exact + declared. Suggestions are NOT counted here. */
  covered: number;
  /** an SOP names this requirement */
  exact: number;
  /** an SOP names the LAW this requirement comes from — coarse, needs confirming */
  declared: number;
  /** an embedding proposed an SOP; nobody has confirmed it */
  suggested: number;
  /** atoms built from more than one source requirement */
  multi_source: number;
  /** SLH score, weighted across this department's audited sections. null = not audited */
  slh_pct: number | null;
  /** worst single section — a department can be strong overall and still be bleeding in one place */
  slh_worst_pct: number | null;
  slh_sections: number | null;
  /** the worst section's recorded cause */
  slh_top_miss: string | null;
  /** what guests say, weighted across mapped OTA categories, normalised to 5 */
  guest_score: number | null;
  /** the lowest-scoring category feeding this department, with its platform */
  guest_weakest: string | null;
  guest_platforms: number | null;
}

export interface GuestPlatform {
  source: string;
  /** in the platform's own scale — Booking 9.1/10, TripAdvisor 4.8/5 */
  overall: number | null;
  scale: number | null;
  /** normalised to 5 so platforms are comparable */
  overall_5: number | null;
  reviews: number | null;
  rank: number | null;
  rank_of: number | null;
  rank_context: string | null;
}

export interface GuestSummary {
  as_of: string | null;
  platforms: GuestPlatform[];
}

/** Header summary of the most recent SLH blind visit. */
export interface AuditSummary {
  auditor: string | null;
  audited_at: string | null;
  departments: number;
  worst_dept: string | null;
  worst_pct: number | null;
}

export interface AtomRow {
  atom_id: string;
  atom_key: string;
  title: string;
  requirement_text: string;
  category: string | null;
  /** comma-joined origin tags, e.g. "SLH, ASEAN" */
  authorities: string | null;
  source_count: number;
  covered: boolean;
  sop_code: string | null;
  /** the department that owns this FIRST */
  dept_code: string;
  /** second owning department for shared obligations (pool deck: F&B + housekeeping) */
  dept_code_2: string | null;
  /** true when the department being viewed is the SECOND owner, not the first */
  is_shared: boolean;
  /** an SOP names this exact requirement (sustainability req_code) */
  has_exact: boolean;
  /** an SOP names the law this came from — credited with all its obligations */
  has_declared: boolean;
  /** an embedding proposed a match; not coverage until a human says so */
  has_suggested: boolean;
  suggested_sop: string | null;
  /** cosine similarity of the proposal, 0-1 */
  suggested_conf: number | null;
  suggested_note: string | null;
}

export interface StandardTotals {
  atoms: number;
  /** exact + declared only */
  covered: number;
  exact: number;
  declared: number;
  /** proposals awaiting a human verdict — never counted as covered */
  suggested: number;
  multi_source: number;
  /** atoms owned by two departments — counted once here, twice across `departments` */
  shared: number;
  requirements: number;
  /** SOP docs registered for THIS property (knowledge.sop_meta) — what the Quality
      dashboard counts. Always >= sops. */
  sop_docs: number;
  /** registered SOPs with no active body — a title and no procedure */
  sop_unwritten: number;
  sources: number;
  authorities: number;
  /** active SOPs in the register */
  sops: number;
  /** coverage split by how each obligation is actually discharged */
  by_mode: Array<{
    mode: 'procedure' | 'rule' | 'evidence' | 'observation';
    atoms: number;
    covered: number;
    /** true for 'procedure' only. 'evidence' is NOT coverable — `covered` is derived
     *  from standards.sop_coverage for every mode, and ops.sustainability_evidence
     *  (the store the spec names for evidence) is wired nowhere; claiming evidence
     *  coverage from an SOP match would be a false positive (a separate brief wires
     *  the real evidence register). 'rule' has no training store to check, and
     *  'observation' is scored by audit, never closed by a document. */
    coverable: boolean;
  }>;
}

/** public.fn_standards_source_documents(p_property_id) — takes p_property_id and
 *  filters on it (invariant 3). The ATOM corpus is tenant-neutral, but the DOCUMENTS
 *  behind it are property-scoped — two of the six are the SLH Mystery Inspection
 *  2025/2026 reports, sensitivity='confidential', belonging to one property. A prior
 *  zero-argument version ignored property_id and leaked those reports cross-tenant;
 *  never call this without a verified p_property_id. For Namkhan (260955): six rows
 *  across four authorities — ASEAN and GSTC one document each, SLH three (the
 *  minimum standards chart plus the two mystery-inspection reports), Travelife one.
 *  Legal, Sustainability, PM and the two Namkhan house sources have none — those are
 *  registers this platform generates, not partner documents, and correctly have zero
 *  rows here; that is not a data gap. Fetched server-side in page.tsx, same pattern
 *  as AuditDocument in the sibling quality/[dept]/types.ts — this client component
 *  must never query Supabase directly (CLAUDE.md "Data access gotchas"). */
export interface SourceDocument {
  authority: string;
  source_key: string;
  source_title: string;
  doc_id: string;
  doc_title: string;
  file_name: string;
  mime: string | null;
  file_size_bytes: number | null;
  /** 'public' | 'internal' | 'confidential' today. Treat anything not 'public'/'internal'
   *  as worth labelling — fails open (labelled), not closed (silently hidden) — same
   *  convention as AuditDocument.sensitivity in the sibling department QA page. */
  sensitivity: string | null;
}

export interface StandardPayload {
  generated_at: string;
  property_id: number;
  /** null on the landing view; a dept_code when one is selected */
  dept: string | null;
  dept_name: string | null;
  totals: StandardTotals;
  /** null when the property has no recorded SLH inspection */
  audit: AuditSummary | null;
  /** OTA ratings; null when the property has none recorded */
  guest: GuestSummary | null;
  authorities: AuthorityRow[];
  departments: DeptRow[];
  /** empty unless `dept` is set */
  items: AtomRow[];
}
