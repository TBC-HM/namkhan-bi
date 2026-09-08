// Shape of public.fn_qa_dash_payload(p_property_id, p_max_age_minutes).
//
// Deviation from the handoff copy: it declared `Row = Record<string, any>`, which
// switches off checking on every table on the page (the department matrix alone
// reads 26 fields). The row interfaces below are transcribed from the live
// public.v_qa_dash_* views via information_schema, so a mistyped column is a
// compile error instead of a silent "—" on screen. Summary tiles stay as an
// index-signature `Row` — they are flat jsonb bags of scalars and the display
// helpers already render a missing key as "—".

export type Num = number | null;

// Widened payload value type: jsonb numerics can arrive as strings, and any key
// can be absent for a tenant with no ops.qa_dash_source_map row.
export type Val = number | string | boolean | null | undefined;

/** A flat summary object from a v_qa_dash_* view — every column is a scalar. */
export type Row = Record<string, Val>;

export interface Action {
  rank: number; rule_key: string; category: string; severity: 'red' | 'amber' | 'grey';
  title: string; detail: string; route_path: string; cta_label: string;
  route_path_2: string | null; cta_label_2: string | null;
}

export interface Loops {
  standards_status: string; standards_in_date_pct: Num; standards_lao_pct: Num;
  people_status: string; people_certs_held: Num; people_cert_fte_required: Num; people_certs_pct: Num;
  verification_status: string; verification_pm_pct: Num; verification_audits_90d: Num;
  guest_status: string; guest_low_180d: Num; guest_themed_reviews: Num; guest_unanswered: Num;
  capa_status: string; capa_findings_open: Num; capa_low_reviews_without_finding: Num; capa_recovery_cases: Num;
}

/* ---- row shapes, from public.v_qa_dash_* ---- */

export interface DeptMatrixRow {
  dept_code: string; dept_name: string; hod_set: boolean | null;
  staff_active: Num; left_12m: Num; avg_skills: Num; platform_users: Num;
  sops: Num; sops_in_date: Num; sops_lao: Num; proposals_open: Num;
  certs_required: string | null; cert_fte_required: Num; certs_held: Num;
  pm_tasks: Num; pm_sched_30d: Num; pm_done_30d: Num; pm_pct_30d: Num; pm_past_due: Num;
  last_audit_date: string | null; audit_pct_180d: Num;
  themes: string | null; negative_180d: Num; negative_90d: Num;
  ok_standards: boolean | null; ok_certs: boolean | null; ok_pm: boolean | null; ok_audit: boolean | null;
  audit_ready: boolean | null;
}

export interface SopByDeptRow {
  dept_code: string; sops: Num; in_date: Num; never_reviewed: Num; review_overdue: Num;
  lao: Num; visual_required: Num; visual_present: Num; scored: Num; avg_score: Num;
  proposals_open: Num; proposals_open_p1: Num;
}

export interface StaffByDeptRow {
  dept_code: string; staff_active: Num; left_12m: Num; hired_12m: Num;
  with_skills: Num; avg_skills: Num; platform_users: Num; hod_set: boolean | null;
}

export interface CertCoverageRow {
  cert: string; positions: Num; fte_required: Num; certs_held: Num; coverage_pct: Num;
}

export interface SkillDemandRow {
  skill: string; tasks: Num; staff_with: Num; single_point_of_failure: boolean | null;
}

export interface PmByDeptRow {
  dept_code: string; tasks: Num; tasks_with_sop: Num;
  sched_30d: Num; done_30d: Num; past_due_open: Num; next_30d: Num;
}

export interface ThemeRow {
  theme: string; dept_code: string | null; dept_code_2: string | null;
  mentions_180d: Num; positive: Num; negative: Num; mixed: Num; neutral: Num; negative_90d: Num;
}

export interface LowReviewRow {
  review_id: number; reviewed_at: string | null; source: string | null; rating_norm: Num;
  title: string | null; themes: string | null; depts_implicated: string | null;
  answered: boolean | null; has_finding: boolean | null; days_ago: Num;
}

export interface GoalRow {
  goal_id: number; title: string; metric: string; target_value: Num; deadline: string | null;
  stored_current_value: Num; computed_value: Num; computed_label: string | null;
  computed_source: string | null; status_flag: string | null; days_to_deadline: Num;
}

export interface FreshnessRow {
  source_key: string; label: string; asof: string | null; days_old: Num; status: string;
}

export interface AgendaRow {
  item_date: string; item_type: string; title: string; detail: string | null; status: string | null;
}

/* ---- nested tile shapes that are NOT flat ---- */

export interface Pillar { pillar: string; reqs: Num; compliant: Num; partial: Num; not_started: Num }
export interface SusStandard { code: string; body: string; frequency: string; questions: Num }
export interface LegalCategoryRow { category: string; laws: Num; needs_verification: Num }

export interface Sustainability {
  reqs: Num; compliant: Num; partial: Num; not_started: Num; non_compliant: Num; compliant_pct: Num;
  evidence_rows: Num; evidence_last_verified: string | null; evidence_last_updated: string | null;
  evidence_days_old: Num; evidence_review_overdue: Num; evidence_review_due_30d: Num;
  standards_n: Num; question_mappings: Num;
  pillars: Pillar[] | null; standards: SusStandard[] | null;
}

export interface Legal {
  laws: Num; laws_active: Num; needs_verification: Num; never_reviewed: Num;
  review_overdue: Num; no_review_date: Num; by_category: LegalCategoryRow[] | null;
}

export interface QaPayload {
  property_id: number; generated_at: string; cached?: boolean; cache_age_sec?: number;
  metrics: Row;
  badges: {
    today: { actions: number; actions_red: number; loops_live: Num };
    depts: { audit_ready: Num; total: Num };
    standards: { in_date_pct: Num; lao: Num };
    people: { certs_held: Num; cert_fte_required: Num };
    verify: { pm_pct_30d: Num; audits_90d: Num };
    guest: { low_180d: Num; findings_open: Num };
  };
  actions: Action[] | null;
  loops: Loops;
  freshness: FreshnessRow[] | null;
  agenda: AgendaRow[] | null;
  goals: GoalRow[] | null;
  dept_matrix: DeptMatrixRow[] | null;
  standards: { summary: Row | null; by_dept: SopByDeptRow[] | null; kinds: Record<string, number> | null };
  people: {
    workforce: Row | null; by_dept: StaffByDeptRow[] | null;
    cert_coverage: CertCoverageRow[] | null; skill_demand: SkillDemandRow[] | null; learning: Row | null;
  };
  verification: {
    pm: Row | null; pm_by_dept: PmByDeptRow[] | null; pm_monthly: Row[] | null;
    audits: Row | null; sustainability: Sustainability | null; legal: Legal | null; dq: Row | null;
  };
  guest: { summary: Row | null; themes: ThemeRow[] | null; low_reviews: LowReviewRow[] | null };
  deploy: { commit_short: string; prod_aliased_at: string } | null;
}

export type TabKey = 'today' | 'depts' | 'standards' | 'people' | 'verify' | 'guest';
export const TABS: { key: TabKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'depts', label: 'Departments' },
  { key: 'standards', label: 'Standards & SOPs' },
  { key: 'people', label: 'People & training' },
  { key: 'verify', label: 'Audits & PM' },
  { key: 'guest', label: 'Guest signal & CAPA' },
];
