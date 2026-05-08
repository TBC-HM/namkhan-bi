'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/* ──────────────────────────────────────────────────────────────────────────
 * /revenue — entry page
 * Layout (PBS spec 2026-05-08):
 *   • greeting top-left, italic Fraunces, modest size
 *   • Revenue ▾ dept dropdown top-right
 *   • CHAT in the middle as hero
 *   • small chip row immediately below chat
 *   • 3 containers in a row (Action items / My Docs / My Tasks)
 *     with + add and × delete per row, persisted to localStorage
 *   • black background, brass + paper accents (brand)
 * ────────────────────────────────────────────────────────────────────────── */

interface AttentionItem { id: string; label: string; severity: 'high' | 'medium' | 'low'; kind: 'leakage' | 'opportunity' }
interface DocItem       {
  id: string;
  label: string;
  href: string;
  size?: number;
  uploaded_at?: string;
  body?: string;
  // Reports-specific (PBS 2026-05-08): scheduled reports show recurrence
  // pill on the card and the dim selection that produced them.
  kind?: 'upload' | 'report';
  report_type?: string;
  report_dims?: Record<string, string>;
  schedule?: 'once' | 'daily' | 'weekly' | 'monthly';
  next_run?: string;
  // Email delivery (PBS 2026-05-08). Recipients run alongside the
  // schedule — same cron tick generates the report AND emails it.
  email_recipients?: string[];
  email_time?: string;  // "HH:MM" 24-hour, ICT
}
interface TaskItem      { id: string; label: string; done: boolean; created?: string; due?: string; alert?: boolean }

// 2026-05-08 — Revenue-specific report dimensions. Each report type has its
// OWN dimension groups (Pace ≠ Pulse ≠ Channels). The builder renders only
// the groups for the selected type. Single-select per group; "All" or no
// selection means the report uses its own default for that dimension.
type ReportType = 'pulse' | 'pace' | 'channels' | 'pricing' | 'comp_set' | 'forecast' | 'all';

interface DimGroup { key: string; label: string; options: { value: string; label: string }[] }

const REPORT_LABEL: Record<ReportType, string> = {
  pulse:    'Pulse',
  pace:     'Pace',
  channels: 'Channels',
  pricing:  'Pricing',
  comp_set: 'Comp Set',
  forecast: 'Forecast',
  all:      'All revenue',
};

const REPORT_HREF_BASE: Record<ReportType, string> = {
  pulse:    '/revenue/pulse',
  pace:     '/revenue/pace',
  channels: '/revenue/channels',
  pricing:  '/revenue/pricing',
  comp_set: '/revenue/compset',
  forecast: '/revenue/forecast',
  all:      '/revenue',
};

const REPORT_DIM_GROUPS: Record<ReportType, DimGroup[]> = {
  pulse: [
    { key: 'window', label: 'Window', options: [
      { value: 'today',  label: 'Today'   },
      { value: 'last_7d',  label: 'Last 7d' },
      { value: 'last_30d', label: 'Last 30d' },
      { value: 'mtd',    label: 'MTD'     },
      { value: 'ytd',    label: 'YTD'     },
    ]},
    { key: 'compare', label: 'Compare', options: [
      { value: 'sdly', label: 'SDLY' },
      { value: 'stly', label: 'STLY' },
      { value: 'lw',   label: 'Last week' },
      { value: 'lm',   label: 'Last month' },
      { value: 'ly',   label: 'LY' },
      { value: 'budget', label: 'Budget' },
    ]},
    { key: 'segment', label: 'Segment', options: [
      { value: 'all',    label: 'All'        },
      { value: 'room',   label: 'Room type'  },
      { value: 'source', label: 'Source'     },
      { value: 'rate',   label: 'Rate plan'  },
    ]},
  ],
  pace: [
    { key: 'horizon', label: 'Stay horizon', options: [
      { value: 'fwd_7d',  label: 'Next 7d'  },
      { value: 'fwd_30d', label: 'Next 30d' },
      { value: 'fwd_60d', label: 'Next 60d' },
      { value: 'fwd_90d', label: 'Next 90d' },
      { value: 'fwd_180d', label: 'Next 180d' },
    ]},
    { key: 'pickup', label: 'Pickup window', options: [
      { value: 'last_1d',  label: 'Last 1d'  },
      { value: 'last_7d',  label: 'Last 7d'  },
      { value: 'last_28d', label: 'Last 28d' },
    ]},
    { key: 'compare', label: 'Compare', options: [
      { value: 'stly',   label: 'STLY' },
      { value: 'sdly',   label: 'SDLY' },
      { value: 'budget', label: 'Budget' },
      { value: 'forecast', label: 'Forecast' },
    ]},
    { key: 'granularity', label: 'Granularity', options: [
      { value: 'day',   label: 'Day'   },
      { value: 'week',  label: 'Week'  },
      { value: 'month', label: 'Month' },
    ]},
  ],
  channels: [
    { key: 'window', label: 'Window', options: [
      { value: 'last_7d',  label: 'Last 7d'  },
      { value: 'last_30d', label: 'Last 30d' },
      { value: 'last_90d', label: 'Last 90d' },
      { value: 'mtd',      label: 'MTD'      },
      { value: 'ytd',      label: 'YTD'      },
    ]},
    { key: 'channel', label: 'Channel', options: [
      { value: 'all',       label: 'All'       },
      { value: 'direct',    label: 'Direct'    },
      { value: 'ota',       label: 'OTA'       },
      { value: 'wholesale', label: 'Wholesale' },
      { value: 'gds',       label: 'GDS'       },
    ]},
    { key: 'metric', label: 'Metric', options: [
      { value: 'revenue',    label: 'Revenue'    },
      { value: 'rn',         label: 'RN'         },
      { value: 'adr',        label: 'ADR'        },
      { value: 'net_adr',    label: 'Net ADR'    },
      { value: 'commission', label: 'Commission' },
    ]},
    { key: 'compare', label: 'Compare', options: [
      { value: 'stly',   label: 'STLY' },
      { value: 'ly',     label: 'LY'   },
      { value: 'lm',     label: 'Last month' },
    ]},
  ],
  pricing: [
    { key: 'horizon', label: 'Date horizon', options: [
      { value: 'fwd_7d',  label: 'Next 7d'  },
      { value: 'fwd_30d', label: 'Next 30d' },
      { value: 'fwd_90d', label: 'Next 90d' },
    ]},
    { key: 'room', label: 'Room type', options: [
      { value: 'all',       label: 'All' },
      { value: 'premium',   label: 'Premium' },
      { value: 'signature', label: 'Signature' },
      { value: 'entry',     label: 'Entry' },
    ]},
    { key: 'plan', label: 'Rate plan', options: [
      { value: 'all',         label: 'All' },
      { value: 'bar',         label: 'BAR' },
      { value: 'promotional', label: 'Promotional' },
      { value: 'package',     label: 'Package' },
    ]},
    { key: 'compare', label: 'Compare', options: [
      { value: 'comp',     label: 'vs comp set' },
      { value: 'ly_date',  label: 'vs LY same date' },
    ]},
  ],
  comp_set: [
    { key: 'window', label: 'Window', options: [
      { value: 'last_7d',  label: 'Last 7d'  },
      { value: 'last_30d', label: 'Last 30d' },
      { value: 'last_90d', label: 'Last 90d' },
    ]},
    { key: 'property', label: 'Property', options: [
      { value: 'all', label: 'All peers' },
      { value: 'avg', label: 'Average' },
      { value: 'top', label: 'Top performer' },
    ]},
    { key: 'metric', label: 'Metric', options: [
      { value: 'mpi',    label: 'MPI'    },
      { value: 'ari',    label: 'ARI'    },
      { value: 'rgi',    label: 'RGI'    },
      { value: 'adr',    label: 'ADR'    },
      { value: 'occ',    label: 'OCC'    },
      { value: 'revpar', label: 'RevPAR' },
    ]},
    { key: 'date_type', label: 'Date type', options: [
      { value: 'stay', label: 'Stay date' },
      { value: 'shop', label: 'Shop date' },
    ]},
  ],
  forecast: [
    { key: 'horizon', label: 'Horizon', options: [
      { value: 'fwd_7d',   label: 'Next 7d'   },
      { value: 'fwd_30d',  label: 'Next 30d'  },
      { value: 'fwd_90d',  label: 'Next 90d'  },
      { value: 'fwd_180d', label: 'Next 180d' },
    ]},
    { key: 'confidence', label: 'Confidence', options: [
      { value: 'p50', label: 'P50' },
      { value: 'p90', label: 'P90' },
    ]},
    { key: 'driver', label: 'Driver', options: [
      { value: 'pace', label: 'Pace' },
      { value: 'mix',  label: 'Mix'  },
      { value: 'comp', label: 'Comp set' },
    ]},
    { key: 'compare', label: 'Compare', options: [
      { value: 'budget', label: 'Budget' },
      { value: 'ly',     label: 'LY'     },
    ]},
  ],
  all: [
    { key: 'window', label: 'Window', options: [
      { value: 'last_7d',  label: 'Last 7d'  },
      { value: 'last_30d', label: 'Last 30d' },
      { value: 'mtd',      label: 'MTD'      },
      { value: 'ytd',      label: 'YTD'      },
    ]},
    { key: 'compare', label: 'Compare', options: [
      { value: 'stly',   label: 'STLY'   },
      { value: 'budget', label: 'Budget' },
    ]},
  ],
};

const SCHEDULE_OPTIONS: { value: 'once' | 'daily' | 'weekly' | 'monthly'; label: string }[] = [
  { value: 'once',    label: 'Once'    },
  { value: 'daily',   label: 'Daily'   },
  { value: 'weekly',  label: 'Weekly'  },
  { value: 'monthly', label: 'Monthly' },
];

// Compute the next-run timestamp for a recurring schedule (for display only).
function computeNextRun(schedule: 'once' | 'daily' | 'weekly' | 'monthly'): string | undefined {
  if (schedule === 'once') return undefined;
  const d = new Date();
  if (schedule === 'daily')   d.setDate(d.getDate() + 1);
  if (schedule === 'weekly')  d.setDate(d.getDate() + 7);
  if (schedule === 'monthly') d.setMonth(d.getMonth() + 1);
  d.setHours(6, 0, 0, 0);
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

const ATTN_KEY  = 'nk.rev.entry.attention.v2';
const DOCS_KEY  = 'nk.rev.entry.docs.v2';
const TASKS_KEY = 'nk.rev.entry.tasks.v2';

const DEFAULT_ATTN: AttentionItem[] = [
  // Leakage = revenue we are losing or about to lose (parity, cancellations, channel-cost creep).
  { id: 'l1', label: 'OTA parity breach — BDC $142 vs direct $158',  severity: 'high',   kind: 'leakage'     },
  { id: 'l2', label: 'Comp set data stale — last sync 48h ago',      severity: 'low',    kind: 'leakage'     },
  // Opportunity = unrealized upside (pace gaps, mix shifts, group ask we can win).
  { id: 'o1', label: 'Pace −14% vs STLY for next 30 days',           severity: 'medium', kind: 'opportunity' },
  { id: 'o2', label: 'Long-weekend BAR ladder under-priced vs comp', severity: 'medium', kind: 'opportunity' },
];

const DEFAULT_DOCS: DocItem[] = [
  { id: 'd1', label: 'Revenue Strategy 2026',       href: '/revenue/strategy'    },
  { id: 'd2', label: 'Channel Mix Report — Apr 2026', href: '/revenue/channel-mix' },
  { id: 'd3', label: 'BAR Rate Grid',                href: '/revenue/bar'         },
];

const DEFAULT_TASKS: TaskItem[] = [
  { id: 't1', label: 'Review OTA parity alerts',    done: false, created: '2026-05-08' },
  { id: 't2', label: 'Update BAR for long weekend', done: false, created: '2026-05-08' },
  { id: 't3', label: 'Sign off on group quote #12', done: false, created: '2026-05-08' },
];

const QUICK_CHIPS = [
  { label: 'Pulse',    href: '/revenue/pulse'    },
  { label: 'Pace',     href: '/revenue/pace'     },
  { label: 'Channels', href: '/revenue/channels' },
  { label: 'Comp Set', href: '/revenue/compset'  },
  { label: 'Parity',   href: '/revenue/parity'   },
  { label: 'Forecast', href: '/revenue/forecast' },
];

// 2026-05-08 (ticket #328 follow-up): top-right dropdown was a duplicate
// of the global N (dept switcher). PBS asked it to surface this dept's
// own sub-tabs instead, so the bare entry page has a way to jump into
// the original tabbed views.
const DEPT_LINKS = [
  { label: 'Pulse',      href: '/revenue/pulse'     },
  { label: 'Pace',       href: '/revenue/pace'      },
  { label: 'Channels',   href: '/revenue/channels'  },
  { label: 'Rate Plans', href: '/revenue/rateplans' },
  { label: 'Pricing',    href: '/revenue/pricing'   },
  { label: 'Comp Set',   href: '/revenue/compset'   },
  { label: 'Parity',     href: '/revenue/parity'    },
  { label: 'Agents',     href: '/revenue/agents'    },
];

const SEVERITY_DOT: Record<string, string> = {
  high:   '#c0584c',
  medium: '#c4a06b',
  low:    '#7d7565',
};

// ─── helpers ────────────────────────────────────────────────────────────────
function loadLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function saveLS(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* noop */ }
}
function uid() { return Math.random().toString(36).slice(2, 9); }

function todayLabel(): string {
  const d = new Date();
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
}

function menuLinkStyle(): React.CSSProperties {
  return {
    display:        'block',
    padding:        '7px 12px',
    color:          '#d8cca8',
    textDecoration: 'none',
    fontFamily:     "'JetBrains Mono', ui-monospace, monospace",
    fontSize:       11,
    letterSpacing:  '0.12em',
    textTransform:  'uppercase',
    borderRadius:   4,
  };
}
function langFlagStyle(active: boolean): React.CSSProperties {
  return {
    background:   active ? '#1c160d' : 'transparent',
    border:       `1px solid ${active ? '#a8854a' : '#2a261d'}`,
    borderRadius: 4,
    padding:      '3px 8px',
    cursor:       'pointer',
    fontSize:     14,
    lineHeight:   1,
  };
}

function weatherChipStyle(): React.CSSProperties {
  return {
    display:      'flex',
    alignItems:   'center',
    gap:          6,
    background:   'transparent',
    border:       '1px solid #2a261d',
    borderRadius: 999,
    padding:      '4px 10px',
    cursor:       'pointer',
    color:        '#9b907a',
  };
}

// Modal field styles (project + task creation)
const modalLabelStyle: React.CSSProperties = {
  display:        'block',
  fontFamily:     "'JetBrains Mono', ui-monospace, monospace",
  fontSize:       10,
  letterSpacing:  '0.14em',
  textTransform:  'uppercase',
  color:          '#9b907a',
  marginBottom:   4,
  marginTop:      10,
};
const modalInputStyle: React.CSSProperties = {
  width:        '100%',
  boxSizing:    'border-box',
  background:   '#15110b',
  border:       '1px solid #2a261d',
  borderRadius: 8,
  color:        '#efe6d3',
  padding:      '9px 12px',
  fontSize:     13,
  fontFamily:   "'Inter Tight', system-ui, sans-serif",
  outline:      'none',
  marginBottom: 4,
  colorScheme:  'dark',
};
const modalCancelStyle: React.CSSProperties = {
  background:    'transparent',
  border:        '1px solid #2a261d',
  borderRadius:  8,
  color:         '#9b907a',
  padding:       '8px 14px',
  fontSize:      11,
  cursor:        'pointer',
  fontFamily:    "'JetBrains Mono', ui-monospace, monospace",
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
};
const modalSaveStyle: React.CSSProperties = {
  border:        'none',
  borderRadius:  8,
  padding:       '8px 14px',
  fontSize:      11,
  fontFamily:    "'JetBrains Mono', ui-monospace, monospace",
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  fontWeight:    600,
};
const modalOverlayStyle: React.CSSProperties = {
  position:        'fixed',
  inset:           0,
  zIndex:          200,
  background:      'rgba(0,0,0,0.6)',
  display:         'flex',
  alignItems:      'center',
  justifyContent:  'center',
  padding:         24,
};
const modalCardStyle: React.CSSProperties = {
  background:   '#0f0d0a',
  border:       '1px solid #3a3327',
  borderRadius: 12,
  padding:      22,
  width:        '100%',
  boxShadow:    '0 20px 50px rgba(0,0,0,0.6)',
  fontFamily:   "'Inter Tight', system-ui, sans-serif",
};
const modalEyebrowStyle: React.CSSProperties = {
  fontFamily:    "'JetBrains Mono', ui-monospace, monospace",
  fontSize:      10,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  color:         '#a8854a',
  marginBottom:  14,
};
const docChoiceBtnStyle: React.CSSProperties = {
  width:        '100%',
  background:   '#15110b',
  border:       '1px solid #2a261d',
  borderRadius: 10,
  padding:      '14px 16px',
  cursor:       'pointer',
  textAlign:    'center',
  transition:   'border-color 100ms ease',
};
function pillBtnStyle(active: boolean): React.CSSProperties {
  return {
    background:    active ? '#1c160d' : 'transparent',
    border:        `1px solid ${active ? '#a8854a' : '#2a261d'}`,
    borderRadius:  18,
    color:         active ? '#c4a06b' : '#9b907a',
    padding:       '5px 12px',
    fontSize:      11,
    cursor:        'pointer',
    fontFamily:    "'JetBrains Mono', ui-monospace, monospace",
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  };
}

// Small chip that sits inline next to a doc label (schedule, email count, …).
function cardChipStyle(color: string): React.CSSProperties {
  return {
    fontFamily:    "'JetBrains Mono', ui-monospace, monospace",
    fontSize:      9,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color,
    border:        '1px solid #2a261d',
    borderRadius:  999,
    padding:       '1px 6px',
    flexShrink:    0,
  };
}

// 2026-05-08 — projects v1 (PR follow-up to #211).
// Active project lives in localStorage; selecting one tags subsequent
// chats with project_id so agents read the project's KB rows in addition
// to global KB. Picker calls /api/cockpit/projects (GET list, POST create).
const ACTIVE_PROJECT_KEY = 'nk.rev.entry.activeProject.v1';
const LANG_KEY           = 'nk.rev.entry.lang.v1';

// Mock auth — `workspace_users` wiring is a later PR. Owner UUID is in
// the infrastructure memory; for now we hardcode the operator label.
const USER_NAME = 'PBS';

interface ProjectRow {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  dept: string | null;
  status: string;
}

interface AttachedFile {
  name: string;
  size: number;
  path: string;
  public_url: string | null;
}

// ─── component ──────────────────────────────────────────────────────────────
export default function RevenuePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef  = useRef<HTMLInputElement>(null);
  const docFileRef = useRef<HTMLInputElement>(null);
  const [chatFocused, setChatFocused] = useState(false);
  const [taskModal, setTaskModal] = useState(false);
  const [taskDraft, setTaskDraft] = useState({ label: '', due: '', alert: false });
  // Doc-create choice + report builder (PBS 2026-05-08).
  // The builder is type-aware: pick a report type first, then the dimensions
  // for THAT type appear (Pace ≠ Pulse ≠ Channels). Single-select per group.
  const [docChoiceOpen, setDocChoiceOpen] = useState(false);
  const [reportModal,   setReportModal]   = useState(false);
  const [reportType,    setReportType]    = useState<ReportType | ''>('');
  const [reportDims,    setReportDims]    = useState<Record<string, string>>({});
  const [reportSchedule, setReportSchedule] = useState<'once' | 'daily' | 'weekly' | 'monthly'>('once');
  const [reportEmails,  setReportEmails]   = useState<string[]>([]);
  const [emailDraft,    setEmailDraft]     = useState('');
  const [reportEmailTime, setReportEmailTime] = useState('06:00');

  const [greeting,  setGreeting]  = useState('Good morning');
  const [chatValue, setChatValue] = useState('');
  const [attn,      setAttn]      = useState<AttentionItem[]>(DEFAULT_ATTN);
  const [docs,      setDocs]      = useState<DocItem[]>(DEFAULT_DOCS);
  const [tasks,     setTasks]     = useState<TaskItem[]>(DEFAULT_TASKS);

  // Projects state
  const [projects,    setProjects]    = useState<ProjectRow[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectRow | null>(null);
  const [projOpen,    setProjOpen]    = useState(false);
  const [helpOpen,    setHelpOpen]    = useState(false);
  const [creating,    setCreating]    = useState(false);
  // Create-project modal (PBS 2026-05-08): full form replaces the inline
  // single-input "name" so the agent system prompt has goal + description
  // alongside the name.
  const [projModal,   setProjModal]   = useState(false);
  const [projDraft,   setProjDraft]   = useState({ name: '', goal: '', description: '' });

  // File attachments for next send
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [uploading,   setUploading]   = useState(false);

  // Auto-summarise (on-request)
  const [summarising, setSummarising] = useState(false);
  const [summary,     setSummary]     = useState<string | null>(null);

  // Top-bar UI (PBS 2026-05-08 redesign)
  const [dateHover,   setDateHover]   = useState(false);
  const [userOpen,    setUserOpen]    = useState(false);
  const [tempOpen,    setTempOpen]    = useState(false);
  const [airOpen,     setAirOpen]     = useState(false);
  const [lang,        setLangState]   = useState<'en' | 'th'>('en');
  function setLang(next: 'en' | 'th') {
    setLangState(next);
    try { localStorage.setItem(LANG_KEY, next); } catch { /* SSR/quota */ }
    setUserOpen(false);
  }

  useEffect(() => {
    setAttn (loadLS<AttentionItem[]>(ATTN_KEY,  DEFAULT_ATTN));
    setDocs (loadLS<DocItem[]>      (DOCS_KEY,  DEFAULT_DOCS));
    setTasks(loadLS<TaskItem[]>     (TASKS_KEY, DEFAULT_TASKS));
    const h = new Date().getHours();
    if (h >= 12 && h < 17) setGreeting('Good afternoon');
    else if (h >= 17)      setGreeting('Good evening');
    inputRef.current?.focus();

    // Restore language preference
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === 'en' || saved === 'th') setLangState(saved);
    } catch { /* SSR */ }

    // Hydrate projects + active selection
    fetch('/api/cockpit/projects?dept=revenue', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => {
        const list = Array.isArray(j?.projects) ? (j.projects as ProjectRow[]) : [];
        setProjects(list);
        const savedSlug = (typeof window !== 'undefined') ? localStorage.getItem(ACTIVE_PROJECT_KEY) : null;
        if (savedSlug) {
          const match = list.find(p => p.slug === savedSlug);
          if (match) setActiveProject(match);
          else localStorage.removeItem(ACTIVE_PROJECT_KEY);
        }
      })
      .catch(() => { /* silent — projects are optional */ });
  }, []);

  function pickProject(p: ProjectRow | null) {
    setActiveProject(p);
    setProjOpen(false);
    setSummary(null);
    if (p) localStorage.setItem(ACTIVE_PROJECT_KEY, p.slug);
    else   localStorage.removeItem(ACTIVE_PROJECT_KEY);
  }

  function openProjectModal() {
    setProjDraft({ name: '', goal: '', description: '' });
    setProjOpen(false);
    setProjModal(true);
  }
  async function createProject() {
    const name = projDraft.name.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch('/api/cockpit/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          goal: projDraft.goal.trim(),
          description: projDraft.description.trim(),
          dept: 'revenue',
          owner_role: 'revenue_hod',
        }),
      });
      if (!res.ok) return;
      const j = await res.json();
      const created = j?.project as ProjectRow | undefined;
      if (created) {
        setProjects(prev => [created, ...prev]);
        pickProject(created);
        setProjModal(false);
      }
    } finally {
      setCreating(false);
    }
  }

  async function archiveProject(p: ProjectRow) {
    if (!confirm(`Archive "${p.name}"? Archive = hidden from this list.`)) return;
    await fetch(`/api/cockpit/projects/${p.slug}/archive`, { method: 'POST' });
    setProjects(prev => prev.filter(x => x.id !== p.id));
    if (activeProject?.id === p.id) pickProject(null);
  }

  async function summariseProject() {
    if (!activeProject) return;
    setSummarising(true);
    setSummary(null);
    try {
      const res = await fetch(`/api/cockpit/projects/${activeProject.slug}/summarize`, { method: 'POST' });
      const j = await res.json();
      const text = typeof j?.summary === 'string' ? j.summary : (j?.error ?? 'no summary');
      setSummary(text);
      // PBS 2026-05-08: every retro auto-lands in My Docs as a dated entry.
      // The doc opens the project's chat thread (existing route).
      if (typeof j?.summary === 'string' && j.summary.trim()) {
        const stamp = new Date().toISOString().slice(0, 10);
        const newDoc: DocItem = {
          id: uid(),
          label: `Retro · ${activeProject.name} · ${stamp}`,
          href: `/cockpit/chat?project=${activeProject.slug}`,
          uploaded_at: stamp,
          body: j.summary,
        };
        const next = [newDoc, ...docs];
        setDocs(next); saveLS(DOCS_KEY, next);
      }
    } catch (e) {
      setSummary(e instanceof Error ? e.message : 'summarise failed');
    } finally {
      setSummarising(false);
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const out: AttachedFile[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/cockpit/upload', { method: 'POST', body: fd });
        if (res.ok) {
          const j = await res.json();
          out.push({ name: file.name, size: file.size, path: j.path, public_url: j.public_url });
        }
      }
      setAttachments(prev => [...prev, ...out]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function submitChat(e: React.FormEvent) {
    e.preventDefault();
    const q = chatValue.trim();
    if (!q && attachments.length === 0) return;
    let body = q;
    if (attachments.length > 0) {
      const lines = attachments.map(a => `📎 ${a.name} (${(a.size / 1024).toFixed(0)} KB) — ${a.public_url ?? a.path}`);
      body = body ? `${body}\n\n${lines.join('\n')}` : lines.join('\n');
    }
    const params = new URLSearchParams({ q: body, dept: 'revenue' });
    if (activeProject) params.set('project', activeProject.slug);
    router.push(`/cockpit/chat?${params.toString()}`);
  }

  // attention CRUD
  function addAttn(kind: 'leakage' | 'opportunity' = 'leakage') {
    const label = prompt(kind === 'leakage' ? 'What is leaking?' : 'What is the opportunity?');
    if (!label) return;
    const next: AttentionItem[] = [...attn, { id: uid(), label, severity: 'medium' as const, kind }];
    setAttn(next); saveLS(ATTN_KEY, next);
  }
  function delAttn(id: string) {
    const next = attn.filter(a => a.id !== id);
    setAttn(next); saveLS(ATTN_KEY, next);
  }

  // docs — click + opens a choice (PBS 2026-05-08): upload from computer
  // OR build a report. Choice modal then routes to either the file picker
  // or the report builder.
  function openDocChoice() {
    setDocChoiceOpen(true);
  }
  function startReportBuilder() {
    setDocChoiceOpen(false);
    setReportType('');
    setReportDims({});
    setReportSchedule('once');
    setReportEmails([]);
    setEmailDraft('');
    setReportEmailTime('06:00');
    setReportModal(true);
  }
  function addReportEmail(raw: string) {
    const email = raw.trim().toLowerCase();
    if (!email) return;
    if (!/^\S+@\S+\.\S+$/.test(email)) return;       // light validation
    if (reportEmails.includes(email)) return;
    setReportEmails(prev => [...prev, email]);
    setEmailDraft('');
  }
  function removeReportEmail(email: string) {
    setReportEmails(prev => prev.filter(e => e !== email));
  }
  function startUploadFlow() {
    setDocChoiceOpen(false);
    docFileRef.current?.click();
  }
  function setReportDim(groupKey: string, value: string) {
    setReportDims(prev => {
      // Click an already-selected option = clear it.
      if (prev[groupKey] === value) {
        const { [groupKey]: _drop, ...rest } = prev;
        return rest;
      }
      return { ...prev, [groupKey]: value };
    });
  }
  function saveReport() {
    if (!reportType) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const groups = REPORT_DIM_GROUPS[reportType];
    const dimSummary = groups
      .map(g => {
        const v = reportDims[g.key];
        if (!v) return null;
        const opt = g.options.find(o => o.value === v);
        return opt?.label;
      })
      .filter((s): s is string => Boolean(s))
      .join(' · ') || 'defaults';
    const sched = reportSchedule === 'once' ? '' : ` · ↻ ${reportSchedule}`;
    const reportLabel = `${REPORT_LABEL[reportType]} report · ${dimSummary}${sched} · ${stamp}`;
    const queryString = new URLSearchParams(reportDims).toString();
    const href = queryString ? `${REPORT_HREF_BASE[reportType]}?${queryString}` : REPORT_HREF_BASE[reportType];
    const newDoc: DocItem = {
      id: uid(),
      label: reportLabel,
      href,
      uploaded_at: stamp,
      kind: 'report',
      report_type: reportType,
      report_dims: reportDims,
      schedule: reportSchedule,
      next_run: computeNextRun(reportSchedule),
      email_recipients: reportEmails.length > 0 ? reportEmails : undefined,
      email_time:       reportEmails.length > 0 ? reportEmailTime : undefined,
    };
    const next: DocItem[] = [newDoc, ...docs];
    setDocs(next); saveLS(DOCS_KEY, next);
    setReportModal(false);
  }

  // Pick from computer — direct upload via /api/cockpit/upload.
  async function pickDocFiles(files: FileList | null) {
    if (!files?.length) return;
    const out: DocItem[] = [];
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/cockpit/upload', { method: 'POST', body: fd });
      if (!res.ok) continue;
      const j = await res.json();
      out.push({
        id: uid(),
        label: file.name,
        href: j.public_url || j.path,
        size: file.size,
        uploaded_at: new Date().toISOString().slice(0, 10),
      });
    }
    if (out.length === 0) return;
    const next = [...docs, ...out];
    setDocs(next); saveLS(DOCS_KEY, next);
    if (docFileRef.current) docFileRef.current.value = '';
  }
  function delDoc(id: string) {
    const next = docs.filter(d => d.id !== id);
    setDocs(next); saveLS(DOCS_KEY, next);
  }

  // tasks — modal for create with due-date + alert option (PBS 2026-05-08).
  function openTaskModal() {
    setTaskDraft({ label: '', due: '', alert: false });
    setTaskModal(true);
  }
  function saveTask() {
    const label = taskDraft.label.trim();
    if (!label) return;
    const next = [...tasks, {
      id: uid(),
      label,
      done: false,
      created: new Date().toISOString().slice(0, 10),
      due: taskDraft.due || undefined,
      alert: taskDraft.alert,
    }];
    setTasks(next); saveLS(TASKS_KEY, next);
    setTaskModal(false);
  }
  function toggleTask(id: string) {
    const next = tasks.map(t => t.id === id ? { ...t, done: !t.done } : t);
    setTasks(next); saveLS(TASKS_KEY, next);
  }
  function delTask(id: string) {
    const next = tasks.filter(t => t.id !== id);
    setTasks(next); saveLS(TASKS_KEY, next);
  }

  return (
    <div style={{
      minHeight:  '100vh',
      background: '#0a0a0a',
      color:      '#e9e1ce',
      fontFamily: "'Inter Tight', system-ui, sans-serif",
      padding:    '32px 48px 64px',
      position:   'relative',
      display:    'flex',
      flexDirection: 'column',
    }}>

      {/* ── Top row (PBS 2026-05-08 redesign):
       *   • LEFT: horizontal sub-pages strip (replaces "Revenue · The Namkhan" line + ▾ dropdown)
       *   • RIGHT: date (hover → dept KPI tiles) + user dropdown (settings / email / account / lang flags)
       *   The "Good evening, Boss." greeting moves to ABOVE the chat hero (see below).
       * ───────────────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        gap: 16,
        flexWrap: 'wrap',
      }}>
        {/* LEFT — sub-pages strip */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          {DEPT_LINKS.map(d => (
            <a key={d.href} href={d.href} style={{
              color:          '#9b907a',
              textDecoration: 'none',
              fontFamily:     "'JetBrains Mono', ui-monospace, monospace",
              fontSize:       10,
              letterSpacing:  '0.18em',
              textTransform:  'uppercase',
              padding:        '4px 0',
              borderBottom:   '1px solid transparent',
              transition:     'color 100ms ease, border-color 100ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#d8cca8'; e.currentTarget.style.borderBottomColor = '#3a3327'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#9b907a'; e.currentTarget.style.borderBottomColor = 'transparent'; }}>
              {d.label}
            </a>
          ))}
        </div>

        {/* RIGHT — weather widgets + date (hover → KPIs) + user dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* TEMP widget — Luang Prabang. Click → KB-style info card. Placeholder
            * data until weather API is wired (Open-Meteo would be the cheapest). */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setTempOpen(o => !o); setAirOpen(false); setUserOpen(false); }}
              title="Temperature in Luang Prabang"
              aria-label="Temperature"
              style={weatherChipStyle()}
            >
              <span style={{ color: '#c4a06b', fontSize: 12 }}>☀</span>
              <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11 }}>32°</span>
            </button>
            {tempOpen && (
              <KBPopover
                onClose={() => setTempOpen(false)}
                eyebrow="Temperature · Luang Prabang"
                title="32°C · feels 36°"
                rows={[
                  { k: 'Now',         v: '32°C',  d: 'partly cloudy' },
                  { k: 'Today high',  v: '34°C',  d: 'peaks ~14:00 ICT' },
                  { k: 'Tonight low', v: '24°C',  d: 'clear' },
                  { k: 'Tomorrow',    v: '33°C',  d: 'thunderstorms PM' },
                ]}
                footer="preview · Open-Meteo wiring TODO"
              />
            )}
          </div>

          {/* AIR widget — humidity + AQI. Click → KB-style info card. */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setAirOpen(o => !o); setTempOpen(false); setUserOpen(false); }}
              title="Air quality + humidity"
              aria-label="Air"
              style={weatherChipStyle()}
            >
              <span style={{ color: '#c4a06b', fontSize: 12 }}>≈</span>
              <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11 }}>AQI 42</span>
            </button>
            {airOpen && (
              <KBPopover
                onClose={() => setAirOpen(false)}
                eyebrow="Air · Luang Prabang"
                title="AQI 42 · good"
                rows={[
                  { k: 'PM2.5',     v: '11 µg/m³', d: 'WHO guideline' },
                  { k: 'Humidity',  v: '76%',      d: 'high · seasonal' },
                  { k: 'UV index',  v: '8',        d: 'very high · 11–15h' },
                  { k: 'Wind',      v: '6 km/h',   d: 'WSW' },
                ]}
                footer="preview · IQAir wiring TODO"
              />
            )}
          </div>

          {/* Date with hover popover (KPIs are placeholders; wire to live views in a later PR) */}
          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => setDateHover(true)}
            onMouseLeave={() => setDateHover(false)}
          >
            <span style={{
              fontFamily:    "'JetBrains Mono', ui-monospace, monospace",
              fontSize:      10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color:         '#9b907a',
              cursor:        'help',
            }}>
              {todayLabel()}
            </span>
            {dateHover && (
              <div style={{
                position: 'absolute', top: 26, right: 0, zIndex: 60,
                background: '#0f0d0a', border: '1px solid #3a3327', borderRadius: 8,
                padding: 12, minWidth: 360,
                boxShadow: '0 12px 28px rgba(0,0,0,0.6)',
                display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8,
              }}>
                {[
                  { k: 'OCC',     v: '78%',     d: '+4 vs LY' },
                  { k: 'ADR',     v: '$182',    d: '+$6 vs STLY' },
                  { k: 'RevPAR',  v: '$142',    d: '+$11 vs LY' },
                  { k: 'PACE',    v: '−14%',    d: 'next 30d vs STLY' },
                ].map(t => (
                  <div key={t.k} style={{
                    background: '#15110b', border: '1px solid #2a261d', borderRadius: 6,
                    padding: '8px 10px',
                  }}>
                    <div style={{
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                      fontSize: 9, letterSpacing: '0.22em', color: '#7d7565', textTransform: 'uppercase',
                    }}>{t.k}</div>
                    <div style={{
                      fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic',
                      fontSize: 22, color: '#d8cca8', marginTop: 2,
                    }}>{t.v}</div>
                    <div style={{ fontSize: 10, color: '#9b907a', marginTop: 2 }}>{t.d}</div>
                  </div>
                ))}
                <div style={{ gridColumn: '1 / -1', fontSize: 10, color: '#5a5448', textAlign: 'right', fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
                  preview · live wiring TODO
                </div>
              </div>
            )}
          </div>

          {/* User dropdown (mock auth — workspace_users wiring is a later PR) */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setUserOpen(o => !o)} style={{
              background:    'transparent',
              border:        '1px solid #2a261d',
              borderRadius:  6,
              color:         '#c4a06b',
              padding:       '5px 12px',
              cursor:        'pointer',
              fontFamily:    "'JetBrains Mono', ui-monospace, monospace",
              fontSize:      10,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              fontWeight:    500,
              display:       'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: '50%', background: '#a8854a',
                color: '#0a0a0a', fontSize: 9, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>{(USER_NAME[0] ?? '?').toUpperCase()}</span>
              {USER_NAME} ▾
            </button>
            {userOpen && (
              <div style={{
                position: 'absolute', right: 0, top: 36, zIndex: 60,
                background: '#0f0d0a', border: '1px solid #2a261d', borderRadius: 6,
                padding: 6, minWidth: 200, boxShadow: '0 12px 28px rgba(0,0,0,0.6)',
              }}>
                <a href="/settings/property" onClick={() => setUserOpen(false)} style={menuLinkStyle()}>Settings</a>
                <a href="/settings/email-categories" onClick={() => setUserOpen(false)} style={menuLinkStyle()}>Email</a>
                <a href="/cockpit/users" onClick={() => setUserOpen(false)} style={menuLinkStyle()}>Account</a>
                <div style={{ borderTop: '1px solid #2a261d', marginTop: 4, paddingTop: 6, display: 'flex', justifyContent: 'center', gap: 10 }}>
                  <button onClick={() => setLang('en')} title="English" style={langFlagStyle(lang === 'en')}>🇬🇧</button>
                  <button onClick={() => setLang('th')} title="ไทย" style={langFlagStyle(lang === 'th')}>🇹🇭</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── PROJECT BOX (PBS 2026-05-08) ───────────────────────────────────
       * Scopes chat + uploads to a project so the AI uses only global KB +
       * this project's KB. Active project persisted to localStorage.
       * (?) icon opens a small inline help block. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => { setProjOpen(o => !o); setHelpOpen(false); }}
            style={{
              background:    activeProject ? '#1c160d' : 'transparent',
              border:        '1px solid #3a3327',
              borderRadius:  18,
              color:         activeProject ? '#d8cca8' : '#9b907a',
              padding:       '5px 14px',
              cursor:        'pointer',
              fontFamily:    "'JetBrains Mono', ui-monospace, monospace",
              fontSize:      10,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              fontWeight:    500,
              display:       'flex',
              alignItems:    'center',
              gap:           6,
            }}
            title={activeProject ? `Active project: ${activeProject.name}` : 'No project — pick or create one'}
          >
            📁 {activeProject ? activeProject.name : 'No project'} ▾
          </button>
          {projOpen && (
            <div style={{
              position: 'absolute', left: 0, top: 36, zIndex: 60,
              background: '#0f0d0a', border: '1px solid #2a261d', borderRadius: 8,
              padding: 6, minWidth: 280, maxHeight: 360, overflowY: 'auto',
              boxShadow: '0 12px 28px rgba(0,0,0,0.6)',
            }}>
              {projects.length === 0 && (
                <div style={{ padding: '8px 10px', fontSize: 11, color: '#7d7565', fontStyle: 'italic' }}>
                  No projects yet. Create the first one.
                </div>
              )}
              {projects.map(p => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
                  background: activeProject?.id === p.id ? '#1c160d' : 'transparent', borderRadius: 6,
                }}>
                  <button
                    onClick={() => pickProject(p)}
                    style={{
                      flex: 1, textAlign: 'left', background: 'transparent', border: 'none',
                      color: activeProject?.id === p.id ? '#c4a06b' : '#d8cca8', cursor: 'pointer',
                      padding: '4px 6px', fontSize: 12,
                    }}
                  >{p.name}</button>
                  <button
                    onClick={() => archiveProject(p)}
                    style={{ background: 'transparent', border: 'none', color: '#7d7565', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
                    title="Archive (gone)"
                  >×</button>
                </div>
              ))}
              {activeProject && (
                <button
                  onClick={() => pickProject(null)}
                  style={{
                    width: '100%', marginTop: 6, padding: '6px 10px',
                    background: 'transparent', border: '1px dashed #3a3327', borderRadius: 6,
                    color: '#9b907a', cursor: 'pointer', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
                  }}
                >
                  Leave project context
                </button>
              )}
              <div style={{ marginTop: 8, padding: '6px 4px 0', borderTop: '1px solid #2a261d' }}>
                <button
                  onClick={openProjectModal}
                  style={{
                    width: '100%', padding: '7px 10px',
                    background: 'transparent', border: '1px dashed #3a3327', borderRadius: 6,
                    color: '#a8854a', cursor: 'pointer',
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
                  }}
                >＋ New project</button>
              </div>
            </div>
          )}
        </div>

        {/* (?) help icon */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => { setHelpOpen(o => !o); setProjOpen(false); }}
            style={{
              width: 22, height: 22, borderRadius: '50%',
              background: 'transparent', border: '1px solid #3a3327',
              color: '#7d7565', cursor: 'pointer', fontSize: 11, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            }}
            title="What are projects?"
          >?</button>
          {helpOpen && (
            <div style={{
              position: 'absolute', left: 0, top: 30, zIndex: 60,
              background: '#0f0d0a', border: '1px solid #3a3327', borderRadius: 8,
              padding: 14, width: 360, fontSize: 12, color: '#d8cca8', lineHeight: 1.5,
              boxShadow: '0 12px 28px rgba(0,0,0,0.6)',
            }}>
              <div style={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 9,
                letterSpacing: '0.22em', textTransform: 'uppercase', color: '#a8854a', marginBottom: 8,
              }}>Projects = scoped memory</div>
              <p style={{ margin: '0 0 8px' }}>
                When a project is active, every message you send and every file you upload becomes part of that project.
                The AI uses <b>only</b> the global knowledge <b>+ this project&apos;s knowledge</b> — no other project leaks in.
              </p>
              <ul style={{ margin: '0 0 8px 16px', padding: 0 }}>
                <li>HoDs create projects from this menu.</li>
                <li>Click the <b>+</b> in the chat to attach a file (max 25 MB).</li>
                <li>Hit <b>Summarise</b> any time for a fresh retro of the project so far.</li>
                <li>Archive = gone — archived projects are filtered out of this list.</li>
              </ul>
              <button
                onClick={() => setHelpOpen(false)}
                style={{
                  background: 'transparent', border: '1px solid #3a3327', borderRadius: 4,
                  color: '#9b907a', padding: '4px 10px', fontSize: 10, letterSpacing: '0.12em',
                  textTransform: 'uppercase', cursor: 'pointer',
                }}
              >Got it</button>
            </div>
          )}
        </div>

        {activeProject && (
          <button
            onClick={summariseProject}
            disabled={summarising}
            style={{
              background: 'transparent', border: '1px solid #3a3327', borderRadius: 18,
              color: '#9b907a', padding: '5px 12px', cursor: summarising ? 'wait' : 'pointer',
              fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10,
              letterSpacing: '0.16em', textTransform: 'uppercase',
              opacity: summarising ? 0.5 : 1,
            }}
            title="On-request retro"
          >
            {summarising ? 'Summarising…' : '✦ Summarise'}
          </button>
        )}
      </div>

      {summary && (
        <div style={{
          maxWidth: 720, width: '100%', margin: '0 auto 24px',
          padding: 14, background: '#15110b', border: '1px solid #3a3327', borderRadius: 8,
          fontSize: 12, lineHeight: 1.55, color: '#d8cca8', whiteSpace: 'pre-wrap',
        }}>
          <div style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 9,
            letterSpacing: '0.22em', textTransform: 'uppercase', color: '#a8854a',
            display: 'flex', justifyContent: 'space-between', marginBottom: 8,
          }}>
            <span>RETRO · {activeProject?.name}</span>
            <button onClick={() => setSummary(null)} style={{ background: 'transparent', border: 'none', color: '#7d7565', cursor: 'pointer', fontSize: 12 }}>×</button>
          </div>
          {summary}
        </div>
      )}

      {/* ── HERO: greeting + chat in the middle ──────────────────────────── */}
      <div style={{
        flex:           1,
        display:        'flex',
        flexDirection:  'column',
        justifyContent: 'center',
        alignItems:     'center',
        gap:            14,
        marginTop:      -32,
        marginBottom:   56,
      }}>
        {/* greeting (was top-left; PBS moved it here 2026-05-08) */}
        <div style={{
          fontFamily:    "'Fraunces', Georgia, serif",
          fontStyle:     'italic',
          fontWeight:    300,
          fontSize:      'clamp(20px, 2.4vw, 28px)',
          letterSpacing: '-0.01em',
          color:         '#e9e1ce',
          textAlign:     'center',
          margin:        0,
        }}>
          {greeting}, <span style={{ color: '#c4a06b' }}>Boss</span>.
        </div>
        <div style={{
          fontFamily:    "'Fraunces', Georgia, serif",
          fontStyle:     'italic',
          fontWeight:    300,
          fontSize:      'clamp(22px, 3vw, 32px)',
          letterSpacing: '-0.015em',
          color:         '#d8cca8',
          textAlign:     'center',
          maxWidth:      720,
        }}>
          Ask Vector anything about revenue.
        </div>

        <form onSubmit={submitChat} style={{ width: '100%', maxWidth: 680 }}>
          {/* attached-file chips above the pill */}
          {attachments.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {attachments.map((a, i) => (
                <div key={`${a.path}-${i}`} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: '#15110b', border: '1px solid #2a261d', borderRadius: 999,
                  padding: '4px 10px', fontSize: 11, color: '#d8cca8',
                }}>
                  <span>{a.name}</span>
                  <span style={{ color: '#5a5448' }}>{(a.size / 1024).toFixed(0)} KB</span>
                  <button
                    type="button"
                    onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                    aria-label={`Remove ${a.name}`}
                    style={{ background: 'transparent', border: 'none', color: '#7d7565', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}
                  >×</button>
                </div>
              ))}
            </div>
          )}
          {/* Standard 2026 LLM composer — 16px text, 16px radius, single
            * row ~52px tall, subtle brass focus ring. Match the proportions
            * of Claude.ai / ChatGPT input boxes. */}
          <div style={{
            display:      'flex',
            alignItems:   'center',
            border:       `1px solid ${chatFocused ? '#a8854a' : '#3a3327'}`,
            borderRadius: 16,
            background:   '#15110b',
            boxShadow:    chatFocused
              ? '0 0 0 3px rgba(168,133,74,0.12), 0 8px 24px rgba(0,0,0,0.4)'
              : '0 8px 20px rgba(0,0,0,0.35)',
            transition:   'border-color 120ms ease, box-shadow 120ms ease',
            paddingLeft:  4,
            paddingRight: 4,
            height:       52,
          }}>
            <input
              ref={fileRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={e => handleFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              title="Attach files (up to 25 MB each)"
              aria-label="Attach files"
              style={{
                background:   'transparent',
                border:       'none',
                color:        uploading ? '#5a5448' : '#a8854a',
                cursor:       uploading ? 'wait' : 'pointer',
                width:        40,
                height:       40,
                borderRadius: 12,
                fontSize:     20,
                fontWeight:   300,
                lineHeight:   1,
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'center',
              }}
            >
              {uploading ? '↑' : '+'}
            </button>
            <input
              ref={inputRef}
              type="text"
              value={chatValue}
              onChange={e => setChatValue(e.target.value)}
              onFocus={() => setChatFocused(true)}
              onBlur={() => setChatFocused(false)}
              placeholder={activeProject ? `Ask Vector — scoped to "${activeProject.name}"…` : 'Ask anything about revenue…'}
              style={{
                flex:       1,
                background: 'transparent',
                border:     'none',
                outline:    'none',
                color:      '#efe6d3',
                fontFamily: "'Inter Tight', system-ui, sans-serif",
                fontSize:   16,
                lineHeight: 1.4,
                padding:    '0 8px',
                height:     '100%',
              }}
            />
            <button
              type="submit"
              disabled={!chatValue.trim() && attachments.length === 0}
              aria-label="Send"
              style={{
                background:    chatValue.trim() || attachments.length > 0 ? '#a8854a' : '#1c160d',
                border:        'none',
                color:         chatValue.trim() || attachments.length > 0 ? '#0a0a0a' : '#5a5448',
                width:         40,
                height:        40,
                borderRadius:  12,
                cursor:        (chatValue.trim() || attachments.length > 0) ? 'pointer' : 'not-allowed',
                fontSize:      16,
                fontWeight:    600,
                display:       'flex',
                alignItems:    'center',
                justifyContent:'center',
                transition:    'background 100ms ease',
              }}
            >
              ↑
            </button>
          </div>
        </form>

        {/* small chip row immediately below chat */}
        <div style={{
          display:    'flex',
          gap:        8,
          flexWrap:   'wrap',
          justifyContent: 'center',
          maxWidth:   720,
        }}>
          {QUICK_CHIPS.map(c => (
            <a
              key={c.href}
              href={c.href}
              style={{
                background:     'transparent',
                border:         '1px solid #2a261d',
                borderRadius:   18,
                color:          '#9b907a',
                fontFamily:     "'JetBrains Mono', ui-monospace, monospace",
                fontSize:       10,
                letterSpacing:  '0.18em',
                textTransform:  'uppercase',
                fontWeight:     500,
                padding:        '6px 14px',
                textDecoration: 'none',
                whiteSpace:     'nowrap',
                transition:     'border-color 0.15s, color 0.15s',
              }}
            >
              {c.label}
            </a>
          ))}
        </div>
      </div>

      {/* ── containers row (PBS 2026-05-08): "Needs your attention" split
       *   into Leakage + Opportunity. With Docs + Tasks that's 4 cards;
       *   responsive grid auto-wraps to 2×2 on narrower viewports.
       * ───────────────────────────────────────────────────────────────── */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap:                 16,
        maxWidth:            1200,
        margin:              '0 auto',
        width:               '100%',
      }}>

        {/* LEAKAGE */}
        <Container
          title="Leakage"
          onAdd={() => addAttn('leakage')}
        >
          {attn.filter(a => a.kind === 'leakage').map(a => (
            <Row key={a.id} onDelete={() => delAttn(a.id)}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: SEVERITY_DOT[a.severity], flexShrink: 0,
              }} />
              <span style={{ flex: 1, fontSize: 13, color: '#c9bb96', lineHeight: 1.4 }}>
                {a.label}
              </span>
            </Row>
          ))}
          {attn.filter(a => a.kind === 'leakage').length === 0 && <Empty label="No leaks flagged" />}
        </Container>

        {/* OPPORTUNITY */}
        <Container
          title="Opportunity"
          onAdd={() => addAttn('opportunity')}
        >
          {attn.filter(a => a.kind === 'opportunity').map(a => (
            <Row key={a.id} onDelete={() => delAttn(a.id)}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: SEVERITY_DOT[a.severity], flexShrink: 0,
              }} />
              <span style={{ flex: 1, fontSize: 13, color: '#c9bb96', lineHeight: 1.4 }}>
                {a.label}
              </span>
            </Row>
          ))}
          {attn.filter(a => a.kind === 'opportunity').length === 0 && <Empty label="No upside flagged" />}
        </Container>

        {/* REPORTS (renamed from "My docs" 2026-05-08) — uploads + scheduled
          * reports both land here. Recurring reports show a ↻ pill. */}
        <Container
          title="Reports"
          onAdd={openDocChoice}
        >
          <input
            ref={docFileRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={e => pickDocFiles(e.target.files)}
          />
          {docs.map(d => {
            const isRecurring = d.schedule && d.schedule !== 'once';
            const hasEmails = (d.email_recipients?.length ?? 0) > 0;
            return (
              <Row key={d.id} onDelete={() => delDoc(d.id)}>
                <a
                  href={d.href}
                  target={d.href?.startsWith('http') ? '_blank' : undefined}
                  rel={d.href?.startsWith('http') ? 'noreferrer' : undefined}
                  style={{
                    flex:           1,
                    fontSize:       13,
                    color:          '#c9bb96',
                    textDecoration: 'none',
                    lineHeight:     1.4,
                    display:        'flex',
                    alignItems:     'center',
                    gap:            8,
                    flexWrap:       'wrap',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.label}
                  </span>
                  {isRecurring && (
                    <span title={d.next_run ? `Next run ${d.next_run} ICT` : undefined} style={cardChipStyle('#a8854a')}>
                      ↻ {d.schedule}
                    </span>
                  )}
                  {hasEmails && (
                    <span
                      title={`Emails: ${d.email_recipients!.join(', ')}${d.email_time ? ` at ${d.email_time} ICT` : ''}`}
                      style={cardChipStyle('#9b907a')}
                    >
                      ✉ {d.email_recipients!.length}{d.email_time ? ` · ${d.email_time}` : ''}
                    </span>
                  )}
                </a>
              </Row>
            );
          })}
          {docs.length === 0 && <Empty label="No reports yet" />}
        </Container>

        {/* TASKS */}
        <Container
          title="My tasks"
          onAdd={openTaskModal}
        >
          {tasks.map(t => {
            const overdue = !t.done && t.due && t.due < new Date().toISOString().slice(0, 10);
            return (
              <Row key={t.id} onDelete={() => delTask(t.id)}>
                <button
                  onClick={() => toggleTask(t.id)}
                  aria-label={t.done ? 'Mark as not done' : 'Mark as done'}
                  style={{
                    width:           14,
                    height:          14,
                    borderRadius:    3,
                    border:          `1px solid ${t.done ? '#5a5040' : '#7d7565'}`,
                    background:      t.done ? '#a8854a' : 'transparent',
                    cursor:          'pointer',
                    display:         'flex',
                    alignItems:      'center',
                    justifyContent:  'center',
                    flexShrink:      0,
                    padding:         0,
                    fontSize:        10,
                    color:           '#0a0a0a',
                    fontWeight:      700,
                  }}
                >
                  {t.done ? '✓' : ''}
                </button>
                <div style={{
                  flex:           1,
                  fontSize:       13,
                  color:          t.done ? '#7d7565' : '#c9bb96',
                  textDecoration: t.done ? 'line-through' : 'none',
                  lineHeight:     1.4,
                  display:        'flex',
                  alignItems:     'center',
                  gap:            8,
                  flexWrap:       'wrap',
                }}>
                  <span>{t.label}</span>
                  {t.due && (
                    <span style={{
                      fontSize: 11,
                      color: overdue ? '#c0584c' : '#7d7565',
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                      letterSpacing: '0.04em',
                    }}>
                      {overdue ? '⚠ ' : '· '}due {t.due}
                    </span>
                  )}
                  {t.alert && (
                    <span title="Alert on" style={{ fontSize: 11, color: '#a8854a' }}>🔔</span>
                  )}
                </div>
              </Row>
            );
          })}
          {tasks.length === 0 && <Empty label="Nothing on the list" />}
        </Container>
      </div>

      {/* Doc create — choice modal (PBS 2026-05-08): Upload OR Build report. */}
      {docChoiceOpen && (
        <div onClick={() => setDocChoiceOpen(false)} style={modalOverlayStyle}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalCardStyle, maxWidth: 380 }}>
            <div style={modalEyebrowStyle}>Add to My docs</div>
            <button onClick={startUploadFlow} style={docChoiceBtnStyle}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>📎</div>
              <div style={{ fontSize: 13, color: '#d8cca8' }}>Upload from computer</div>
              <div style={{ fontSize: 11, color: '#7d7565', marginTop: 2 }}>md · pdf · xlsx · png · 25 MB max</div>
            </button>
            <button onClick={startReportBuilder} style={{ ...docChoiceBtnStyle, marginTop: 8 }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>📊</div>
              <div style={{ fontSize: 13, color: '#d8cca8' }}>Build a report</div>
              <div style={{ fontSize: 11, color: '#7d7565', marginTop: 2 }}>pace · channels · pricing · comp set · …</div>
            </button>
            <button onClick={() => setDocChoiceOpen(false)} style={{ ...modalCancelStyle, width: '100%', marginTop: 12 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Report builder modal — type-aware dimensions (PBS 2026-05-08).
        * Stage 1: pick report type. Stage 2: dim groups specific to that
        * type (e.g. Pace gets horizon/pickup/compare/granularity; Pulse
        * gets window/compare/segment). Plus schedule (once/daily/weekly/
        * monthly) — recurring schedules show ↻ on the doc card. */}
      {reportModal && (
        <div onClick={() => setReportModal(false)} style={modalOverlayStyle}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalCardStyle, maxWidth: 540 }}>
            <div style={modalEyebrowStyle}>Build a report</div>

            <label style={modalLabelStyle}>Report type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 6 }}>
              {(['pulse','pace','channels','pricing','comp_set','forecast'] as ReportType[]).map(t => (
                <button
                  key={t}
                  onClick={() => { setReportType(t); setReportDims({}); }}
                  style={pillBtnStyle(reportType === t)}
                >{REPORT_LABEL[t]}</button>
              ))}
            </div>
            <button
              onClick={() => { setReportType('all'); setReportDims({}); }}
              style={{ ...pillBtnStyle(reportType === 'all'), width: '100%', marginBottom: 4 }}
            >All — full revenue snapshot</button>

            {reportType && (
              <>
                <div style={{ borderTop: '1px solid #1f1c15', margin: '14px 0 4px' }} />
                <div style={{ fontSize: 11, color: '#7d7565', marginBottom: 8 }}>
                  Narrow down — these are the dimensions {REPORT_LABEL[reportType]} accepts.
                  Click a chip to set, click again to clear (defaults apply).
                </div>
                {REPORT_DIM_GROUPS[reportType].map(group => (
                  <div key={group.key} style={{ marginBottom: 10 }}>
                    <label style={{ ...modalLabelStyle, marginTop: 0, marginBottom: 6 }}>
                      {group.label}
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {group.options.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setReportDim(group.key, opt.value)}
                          style={pillBtnStyle(reportDims[group.key] === opt.value)}
                        >{opt.label}</button>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Schedule — once / daily / weekly / monthly */}
                <div style={{ borderTop: '1px solid #1f1c15', margin: '8px 0 6px' }} />
                <label style={modalLabelStyle}>Schedule</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {SCHEDULE_OPTIONS.map(s => (
                    <button
                      key={s.value}
                      onClick={() => setReportSchedule(s.value)}
                      style={pillBtnStyle(reportSchedule === s.value)}
                    >{s.label}</button>
                  ))}
                </div>
                {reportSchedule !== 'once' && (
                  <div style={{ fontSize: 11, color: '#7d7565', marginTop: 6 }}>
                    Next run: <span style={{ color: '#c4a06b' }}>{computeNextRun(reportSchedule)}</span> ICT
                  </div>
                )}

                {/* Email delivery (PBS 2026-05-08): recipients + time */}
                <div style={{ borderTop: '1px solid #1f1c15', margin: '12px 0 6px' }} />
                <label style={modalLabelStyle}>
                  Email delivery <span style={{ color: '#5a5448', textTransform: 'none', letterSpacing: 0 }}>(optional — leave empty to keep in Reports only)</span>
                </label>

                {/* recipient chips */}
                {reportEmails.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {reportEmails.map(e => (
                      <span key={e} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: '#15110b', border: '1px solid #2a261d', borderRadius: 999,
                        padding: '3px 10px', fontSize: 11, color: '#d8cca8',
                      }}>
                        ✉ {e}
                        <button
                          onClick={() => removeReportEmail(e)}
                          aria-label={`Remove ${e}`}
                          style={{ background: 'transparent', border: 'none', color: '#7d7565', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}
                        >×</button>
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <input
                    type="email"
                    value={emailDraft}
                    onChange={e => setEmailDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addReportEmail(emailDraft);
                      }
                      if (e.key === 'Backspace' && !emailDraft && reportEmails.length > 0) {
                        removeReportEmail(reportEmails[reportEmails.length - 1]);
                      }
                    }}
                    placeholder="name@thenamkhan.com — Enter to add"
                    style={{ ...modalInputStyle, marginBottom: 0, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => addReportEmail(emailDraft)}
                    disabled={!emailDraft.trim()}
                    style={{
                      ...modalSaveStyle,
                      background: emailDraft.trim() ? '#a8854a' : '#1c160d',
                      color:      emailDraft.trim() ? '#0a0a0a' : '#5a5448',
                      cursor:     emailDraft.trim() ? 'pointer' : 'not-allowed',
                    }}
                  >Add</button>
                </div>

                {reportEmails.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <label style={{ fontSize: 11, color: '#9b907a', fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                      Send at
                    </label>
                    <input
                      type="time"
                      value={reportEmailTime}
                      onChange={e => setReportEmailTime(e.target.value)}
                      style={{
                        background: '#15110b', border: '1px solid #2a261d', borderRadius: 6,
                        color: '#efe6d3', padding: '6px 10px', fontSize: 12, fontFamily: 'inherit',
                        outline: 'none', colorScheme: 'dark',
                      }}
                    />
                    <span style={{ fontSize: 11, color: '#7d7565' }}>ICT · matches the schedule above</span>
                  </div>
                )}
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button onClick={() => setReportModal(false)} style={modalCancelStyle}>Cancel</button>
              <button
                onClick={saveReport}
                disabled={!reportType}
                style={{
                  ...modalSaveStyle,
                  background: reportType ? '#a8854a' : '#1c160d',
                  color:      reportType ? '#0a0a0a' : '#5a5448',
                  cursor:     reportType ? 'pointer' : 'not-allowed',
                }}
              >{reportSchedule === 'once' ? 'Generate' : `Schedule ${reportSchedule}`}</button>
            </div>
          </div>
        </div>
      )}

      {/* Project creation modal (PBS 2026-05-08): name + goal + description.
        * Goal + description are injected into the agent system prompt later
        * so Vector / Felix know what the project is for. */}
      {projModal && (
        <div
          onClick={() => setProjModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#0f0d0a', border: '1px solid #3a3327', borderRadius: 12,
              padding: 22, width: '100%', maxWidth: 460,
              boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
              fontFamily: "'Inter Tight', system-ui, sans-serif",
            }}
          >
            <div style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
              color: '#a8854a', marginBottom: 14,
            }}>New project</div>

            <label style={modalLabelStyle}>Name</label>
            <input
              autoFocus
              value={projDraft.name}
              onChange={e => setProjDraft(d => ({ ...d, name: e.target.value }))}
              placeholder="e.g. Long-weekend BAR ladder"
              style={modalInputStyle}
            />

            <label style={modalLabelStyle}>Goal</label>
            <input
              value={projDraft.goal}
              onChange={e => setProjDraft(d => ({ ...d, goal: e.target.value }))}
              placeholder="What outcome are we chasing?"
              style={modalInputStyle}
            />

            <label style={modalLabelStyle}>What about <span style={{ color: '#5a5448', textTransform: 'none', letterSpacing: 0 }}>(background)</span></label>
            <textarea
              value={projDraft.description}
              onChange={e => setProjDraft(d => ({ ...d, description: e.target.value }))}
              placeholder="Why now? What's the situation? Anything the AI should know up-front?"
              rows={4}
              style={{ ...modalInputStyle, resize: 'vertical', minHeight: 80, fontFamily: 'inherit' }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button onClick={() => setProjModal(false)} style={modalCancelStyle}>Cancel</button>
              <button
                onClick={createProject}
                disabled={creating || !projDraft.name.trim()}
                style={{
                  ...modalSaveStyle,
                  background: projDraft.name.trim() ? '#a8854a' : '#1c160d',
                  color:      projDraft.name.trim() ? '#0a0a0a' : '#5a5448',
                  cursor:     creating ? 'wait' : (projDraft.name.trim() ? 'pointer' : 'not-allowed'),
                  opacity:    creating ? 0.7 : 1,
                }}
              >{creating ? 'Creating…' : 'Create project'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Task creation modal (PBS 2026-05-08) */}
      {taskModal && (
        <div
          onClick={() => setTaskModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#0f0d0a', border: '1px solid #3a3327', borderRadius: 12,
              padding: 20, width: '100%', maxWidth: 420,
              boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
              fontFamily: "'Inter Tight', system-ui, sans-serif",
            }}
          >
            <div style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
              color: '#a8854a', marginBottom: 12,
            }}>New task</div>

            <input
              autoFocus
              value={taskDraft.label}
              onChange={e => setTaskDraft(d => ({ ...d, label: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') saveTask(); }}
              placeholder="What needs doing…"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#15110b', border: '1px solid #2a261d', borderRadius: 8,
                color: '#efe6d3', padding: '10px 12px', fontSize: 14,
                fontFamily: 'inherit', outline: 'none', marginBottom: 12,
              }}
            />

            <label style={{ display: 'block', fontSize: 11, color: '#9b907a', marginBottom: 4, fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Due date <span style={{ color: '#5a5448' }}>(optional)</span>
            </label>
            <input
              type="date"
              value={taskDraft.due}
              onChange={e => setTaskDraft(d => ({ ...d, due: e.target.value }))}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#15110b', border: '1px solid #2a261d', borderRadius: 8,
                color: '#efe6d3', padding: '8px 12px', fontSize: 13,
                fontFamily: 'inherit', outline: 'none', marginBottom: 12,
                colorScheme: 'dark',
              }}
            />

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#c9bb96', cursor: 'pointer', marginBottom: 16 }}>
              <input
                type="checkbox"
                checked={taskDraft.alert}
                onChange={e => setTaskDraft(d => ({ ...d, alert: e.target.checked }))}
                style={{ accentColor: '#a8854a', width: 16, height: 16 }}
              />
              <span>Alert me when due</span>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setTaskModal(false)}
                style={{
                  background: 'transparent', border: '1px solid #2a261d', borderRadius: 8,
                  color: '#9b907a', padding: '8px 14px', fontSize: 12, cursor: 'pointer',
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: '0.14em', textTransform: 'uppercase',
                }}
              >Cancel</button>
              <button
                onClick={saveTask}
                disabled={!taskDraft.label.trim()}
                style={{
                  background: taskDraft.label.trim() ? '#a8854a' : '#1c160d',
                  border: 'none', borderRadius: 8,
                  color: taskDraft.label.trim() ? '#0a0a0a' : '#5a5448',
                  padding: '8px 14px', fontSize: 12,
                  cursor: taskDraft.label.trim() ? 'pointer' : 'not-allowed',
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600,
                }}
              >Save task</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── small primitives ───────────────────────────────────────────────────── */

function Container({
  title, onAdd, children,
}: { title: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      background:    '#0f0d0a',
      border:        '1px solid #1f1c15',
      borderRadius:  12,
      padding:       '12px 14px 14px',
      display:       'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
        marginBottom:   8,
        paddingBottom:  6,
        borderBottom:   '1px solid #1f1c15',
      }}>
        <h2 style={{
          fontFamily:    "'JetBrains Mono', ui-monospace, monospace",
          fontSize:      10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          fontWeight:    600,
          color:         '#a8854a',
          margin:        0,
        }}>
          {title}
        </h2>
        <button
          onClick={onAdd}
          aria-label="Add"
          style={{
            background:    'transparent',
            border:        '1px solid #2a261d',
            borderRadius:  4,
            color:         '#a8854a',
            cursor:        'pointer',
            fontSize:      13,
            lineHeight:    1,
            width:         20,
            height:        20,
            padding:       0,
            display:       'flex',
            alignItems:    'center',
            justifyContent:'center',
          }}
        >
          +
        </button>
      </div>
      <div style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           6,
      }}>
        {children}
      </div>
    </div>
  );
}

function Row({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          10,
      padding:      '7px 8px',
      borderRadius: 6,
      background:   'transparent',
      transition:   'background 0.12s',
    }}>
      {children}
      <button
        onClick={onDelete}
        aria-label="Delete"
        style={{
          background:   'transparent',
          border:       'none',
          color:        '#5a5040',
          cursor:       'pointer',
          fontSize:     14,
          lineHeight:   1,
          padding:      '2px 4px',
          flexShrink:   0,
        }}
      >
        ×
      </button>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div style={{
      fontFamily:    "'Fraunces', Georgia, serif",
      fontStyle:     'italic',
      fontSize:      12,
      color:         '#5a5040',
      padding:       '12px 4px',
      textAlign:     'center',
    }}>
      {label}
    </div>
  );
}

// KB-landing-style info popover (shared by weather widgets, date hover, etc.)
// 4-up tile grid with eyebrow + scope title + small footer.
function KBPopover({
  onClose, eyebrow, title, rows, footer,
}: {
  onClose: () => void;
  eyebrow: string;
  title: string;
  rows: { k: string; v: string; d: string }[];
  footer?: string;
}) {
  return (
    <div style={{
      position: 'absolute', top: 32, right: 0, zIndex: 60,
      background: '#0f0d0a', border: '1px solid #3a3327', borderRadius: 10,
      padding: 14, minWidth: 320, boxShadow: '0 12px 28px rgba(0,0,0,0.6)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#a8854a',
        }}>{eyebrow}</div>
        <button onClick={onClose} aria-label="Close" style={{
          background: 'transparent', border: 'none', color: '#7d7565', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0,
        }}>×</button>
      </div>
      <div style={{
        fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic',
        fontSize: 22, color: '#d8cca8', marginBottom: 12,
      }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        {rows.map(r => (
          <div key={r.k} style={{
            background: '#15110b', border: '1px solid #2a261d', borderRadius: 6, padding: '8px 10px',
          }}>
            <div style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 9, letterSpacing: '0.18em', color: '#7d7565', textTransform: 'uppercase',
            }}>{r.k}</div>
            <div style={{
              fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic',
              fontSize: 18, color: '#d8cca8', marginTop: 2,
            }}>{r.v}</div>
            <div style={{ fontSize: 10, color: '#9b907a', marginTop: 2 }}>{r.d}</div>
          </div>
        ))}
      </div>
      {footer && (
        <div style={{
          marginTop: 10, paddingTop: 8, borderTop: '1px solid #1f1c15',
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 9, letterSpacing: '0.16em', color: '#5a5448', textAlign: 'right',
        }}>{footer}</div>
      )}
    </div>
  );
}
