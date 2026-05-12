// lib/dept-cfg/types.ts
// 2026-05-08 — types for the parameterized dept entry page. The /revenue
// page.tsx is the canonical implementation; every dept entry page renders
// the same component (<DeptEntry cfg={DEPT_CFG.<slug>} />) with these
// values swapped per dept.

export type DeptSlug =
  | 'revenue' | 'sales' | 'marketing' | 'operations' | 'guest' | 'finance' | 'it' | 'architect';

export interface DeptAttentionItem {
  id: string;
  label: string;
  severity: 'high' | 'medium' | 'low';
  kind: 'leakage' | 'opportunity';
  // Intake #6 (2026-05-12): optional ISO timestamp. When present, AttnRow
  // shows "Nm/Nh/Nd ago" next to the label so PBS sees how long the item
  // has been sitting unaddressed. Seeded defaults can omit it.
  created_at?: string;
}
export interface DeptDocItem {
  id: string;
  label: string;
  href: string;
  size?: number;
  uploaded_at?: string;
  body?: string;
  kind?: 'upload' | 'report';
  report_type?: string;
  report_dims?: Record<string, string>;
  schedule?: 'once' | 'daily' | 'weekly' | 'monthly';
  next_run?: string;
  email_recipients?: string[];
  email_time?: string;
}
export interface DeptTaskItem {
  id: string;
  label: string;
  done: boolean;
  created?: string;
  due?: string;
  alert?: boolean;
}

export interface KPITile { k: string; v: string; d: string }

export interface SubPageLink { label: string; href: string }
export interface AttentionRoute { matcher: string; href: string }

// Revenue-specific report builder config. If a dept doesn't need its own
// taxonomy we leave reportTypes empty; the My Docs `+` modal then only
// shows the Upload option and hides "Build a report".
export interface ReportTypeDef {
  value: string;
  label: string;
  hrefBase: string;
  dimGroups: { key: string; label: string; options: { value: string; label: string }[] }[];
}

export interface DeptCfg {
  slug: DeptSlug;
  pillTitle: string;       // "Revenue" / "Finance" — shown in sub-eyebrow
  hodName: string;         // "Vector" / "Felix" — appears in "Ask <name>…"
  hodEmoji?: string;
  ownerRole: string;       // 'revenue_hod' | 'lead' (matches cockpit_agent_prompts.role)
  hodTagline: string;      // hero subtitle: "Ask Vector anything about revenue."
  chatPlaceholder: string; // composer placeholder
  storageKeyPrefix: string; // 'rev' / 'fin' / 'arch' — drives nk.<prefix>.entry.* keys
  subPages: SubPageLink[]; // top-left horizontal strip + Sub-pages dropdown
  quickChips: SubPageLink[]; // small chip row under the chat
  defaultAttn: DeptAttentionItem[];
  defaultDocs: DeptDocItem[];
  defaultTasks: DeptTaskItem[];
  attentionRoutes?: AttentionRoute[]; // keyword → drilldown href for AttnRow
  defaultDrilldown: string;           // fallback href if no attentionRoute matches
  kpiTiles?: KPITile[];               // shown in the date-hover popover
  reportTypes?: ReportTypeDef[];      // empty = hide Build-a-report
  // Brand color for accent (currently unused; ready for when SVGs land).
  brandHex?: string;
}
