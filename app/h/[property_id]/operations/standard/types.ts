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
  atoms: number;
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
  /** second owning department for shared obligations (pool deck: F&B + housekeeping) */
  dept_code_2: string | null;
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
  requirements: number;
  sources: number;
  authorities: number;
  /** active SOPs in the register */
  sops: number;
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
