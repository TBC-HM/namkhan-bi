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

interface AttentionItem { id: string; label: string; severity: 'high' | 'medium' | 'low' }
interface DocItem       { id: string; label: string; href: string; size?: number; uploaded_at?: string }
interface TaskItem      { id: string; label: string; done: boolean; created?: string; due?: string; alert?: boolean }

const ATTN_KEY  = 'nk.rev.entry.attention.v2';
const DOCS_KEY  = 'nk.rev.entry.docs.v2';
const TASKS_KEY = 'nk.rev.entry.tasks.v2';

const DEFAULT_ATTN: AttentionItem[] = [
  { id: 'a1', label: 'OTA parity breach — BDC $142 vs direct $158', severity: 'high'   },
  { id: 'a2', label: 'Pace −14% vs STLY for next 30 days',          severity: 'medium' },
  { id: 'a3', label: 'Comp set data stale — last sync 48h ago',     severity: 'low'    },
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
  const [newProjName, setNewProjName] = useState('');

  // File attachments for next send
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [uploading,   setUploading]   = useState(false);

  // Auto-summarise (on-request)
  const [summarising, setSummarising] = useState(false);
  const [summary,     setSummary]     = useState<string | null>(null);

  // Top-bar UI (PBS 2026-05-08 redesign)
  const [dateHover,   setDateHover]   = useState(false);
  const [userOpen,    setUserOpen]    = useState(false);
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

  async function createProject() {
    const name = newProjName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch('/api/cockpit/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, dept: 'revenue', owner_role: 'revenue_hod' }),
      });
      if (!res.ok) return;
      const j = await res.json();
      const created = j?.project as ProjectRow | undefined;
      if (created) {
        setProjects(prev => [created, ...prev]);
        pickProject(created);
        setNewProjName('');
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
      setSummary(typeof j?.summary === 'string' ? j.summary : (j?.error ?? 'no summary'));
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
  function addAttn() {
    const label = prompt('New attention item');
    if (!label) return;
    const next = [...attn, { id: uid(), label, severity: 'medium' as const }];
    setAttn(next); saveLS(ATTN_KEY, next);
  }
  function delAttn(id: string) {
    const next = attn.filter(a => a.id !== id);
    setAttn(next); saveLS(ATTN_KEY, next);
  }

  // docs — pick from computer (PBS 2026-05-08): no more URL prompts.
  // Click + → file picker → upload to /api/cockpit/upload → add to docs.
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

        {/* RIGHT — date (hover → KPIs) + user dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
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
              <div style={{ marginTop: 8, padding: '8px 6px 4px', borderTop: '1px solid #2a261d', display: 'flex', gap: 6 }}>
                <input
                  value={newProjName}
                  onChange={e => setNewProjName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') createProject(); }}
                  placeholder="New project name…"
                  style={{
                    flex: 1, background: '#15110b', border: '1px solid #3a3327', borderRadius: 4,
                    color: '#efe6d3', padding: '5px 8px', fontSize: 12, fontFamily: 'inherit', outline: 'none',
                  }}
                />
                <button
                  onClick={createProject}
                  disabled={creating || !newProjName.trim()}
                  style={{
                    background: '#a8854a', border: 'none', borderRadius: 4, color: '#0a0a0a',
                    padding: '0 10px', fontSize: 11, fontWeight: 600, cursor: creating ? 'wait' : 'pointer',
                    opacity: creating || !newProjName.trim() ? 0.5 : 1,
                  }}
                >＋ New</button>
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

      {/* ── 3 containers in a row at bottom ──────────────────────────────── */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap:                 20,
        maxWidth:            1200,
        margin:              '0 auto',
        width:               '100%',
      }}>

        {/* ATTENTION */}
        <Container
          title="Needs your attention"
          onAdd={addAttn}
        >
          {attn.map(a => (
            <Row key={a.id} onDelete={() => delAttn(a.id)}>
              <span style={{
                width:        7,
                height:       7,
                borderRadius: '50%',
                background:   SEVERITY_DOT[a.severity],
                flexShrink:   0,
              }} />
              <span style={{ flex: 1, fontSize: 13, color: '#c9bb96', lineHeight: 1.4 }}>
                {a.label}
              </span>
            </Row>
          ))}
          {attn.length === 0 && <Empty label="All clear" />}
        </Container>

        {/* DOCS */}
        <Container
          title="My docs"
          onAdd={() => docFileRef.current?.click()}
        >
          <input
            ref={docFileRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={e => pickDocFiles(e.target.files)}
          />
          {docs.map(d => (
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
                  overflow:       'hidden',
                  textOverflow:   'ellipsis',
                  whiteSpace:     'nowrap',
                }}
              >
                {d.label}
                {d.uploaded_at && (
                  <span style={{ color: '#5a5448', marginLeft: 8, fontSize: 11 }}>
                    {d.uploaded_at}
                  </span>
                )}
              </a>
            </Row>
          ))}
          {docs.length === 0 && <Empty label="No docs pinned" />}
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
