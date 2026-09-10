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
  covered: number;
  /** atoms built from more than one source requirement */
  multi_source: number;
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
}

export interface StandardTotals {
  atoms: number;
  covered: number;
  multi_source: number;
  requirements: number;
  sources: number;
  authorities: number;
}

export interface StandardPayload {
  generated_at: string;
  property_id: number;
  /** null on the landing view; a dept_code when one is selected */
  dept: string | null;
  dept_name: string | null;
  totals: StandardTotals;
  authorities: AuthorityRow[];
  departments: DeptRow[];
  /** empty unless `dept` is set */
  items: AtomRow[];
}
