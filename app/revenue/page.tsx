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
interface DocItem       { id: string; label: string; href: string }
interface TaskItem      { id: string; label: string; done: boolean }

const ATTN_KEY  = 'nk.rev.entry.attention.v2';
const DOCS_KEY  = 'nk.rev.entry.docs.v2';
const TASKS_KEY = 'nk.rev.entry.tasks.v2';

const DEFAULT_ATTN: AttentionItem[] = [
  { id: 'a1', label: 'OTA parity breach — BDC $142 vs direct $158',  severity: 'high'   },
  { id: 'a2', label: 'Pace −14 % vs STLY for next 30 days',           severity: 'medium' },
  { id: 'a3', label: 'Compset data stale — last sync 48 h ago',      severity: 'low'    },
];

const DEFAULT_DOCS: DocItem[] = [
  { id: 'd1', label: 'Revenue Strategy 2025',      href: '/revenue/strategy'    },
  { id: 'd2', label: 'Channel Mix Report — Apr 26', href: '/revenue/channel-mix' },
  { id: 'd3', label: 'BAR Rate Grid',               href: '/revenue/bar'         },
];

const DEFAULT_TASKS: TaskItem[] = [
  { id: 't1', label: 'Review OTA parity alerts',     done: false },
  { id: 't2', label: 'Update BAR for long weekend',  done: false },
  { id: 't3', label: 'Sign off on group quote #12',  done: false },
];

const QUICK_CHIPS = [
  { label: 'Pulse',    href: '/revenue/pulse'    },
  { label: 'Compset',  href: '/revenue/compset'  },
  { label: 'Parity',   href: '/revenue/parity'   },
  { label: 'Pace',     href: '/revenue/pace'     },
  { label: 'Channels', href: '/revenue/channels' },
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

// 2026-05-08 — projects v1 (PR follow-up to #211).
// Active project lives in localStorage; selecting one tags subsequent
// chats with project_id so agents read the project's KB rows in addition
// to global KB. Picker calls /api/cockpit/projects (GET list, POST create).
const ACTIVE_PROJECT_KEY = 'nk.rev.entry.activeProject.v1';

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

  const [greeting,  setGreeting]  = useState('Good morning');
  const [chatValue, setChatValue] = useState('');
  const [attn,      setAttn]      = useState<AttentionItem[]>(DEFAULT_ATTN);
  const [docs,      setDocs]      = useState<DocItem[]>(DEFAULT_DOCS);
  const [tasks,     setTasks]     = useState<TaskItem[]>(DEFAULT_TASKS);
  const [deptOpen,  setDeptOpen]  = useState(false);

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

  useEffect(() => {
    setAttn (loadLS<AttentionItem[]>(ATTN_KEY,  DEFAULT_ATTN));
    setDocs (loadLS<DocItem[]>      (DOCS_KEY,  DEFAULT_DOCS));
    setTasks(loadLS<TaskItem[]>     (TASKS_KEY, DEFAULT_TASKS));
    const h = new Date().getHours();
    if (h >= 12 && h < 17) setGreeting('Good afternoon');
    else if (h >= 17)      setGreeting('Good evening');
    inputRef.current?.focus();

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

  // docs CRUD
  function addDoc() {
    const label = prompt('Doc title');
    if (!label) return;
    const href = prompt('Link URL', '/revenue/') || '/revenue/';
    const next = [...docs, { id: uid(), label, href }];
    setDocs(next); saveLS(DOCS_KEY, next);
  }
  function delDoc(id: string) {
    const next = docs.filter(d => d.id !== id);
    setDocs(next); saveLS(DOCS_KEY, next);
  }

  // tasks CRUD
  function addTask() {
    const label = prompt('New task');
    if (!label) return;
    const next = [...tasks, { id: uid(), label, done: false }];
    setTasks(next); saveLS(TASKS_KEY, next);
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

      {/* ── Top row: greeting (left) + dept dropdown (right) ──────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
      }}>
        <h1 style={{
          fontFamily:  "'Fraunces', Georgia, serif",
          fontStyle:   'italic',
          fontWeight:  300,
          fontSize:    'clamp(20px, 2.4vw, 28px)',
          letterSpacing: '-0.01em',
          color:       '#e9e1ce',
          margin:      0,
        }}>
          {greeting}, <span style={{ color: '#c4a06b' }}>Boss</span>.
        </h1>

        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setDeptOpen(o => !o)}
            style={{
              background:    'transparent',
              border:        '1px solid #2a261d',
              borderRadius:  6,
              color:         '#c4a06b',
              padding:       '6px 14px',
              cursor:        'pointer',
              fontFamily:    "'JetBrains Mono', ui-monospace, monospace",
              fontSize:      10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              fontWeight:    500,
            }}
          >
            Sub-pages ▾
          </button>
          {deptOpen && (
            <ul style={{
              position:     'absolute',
              right:        0,
              top:          36,
              background:   '#0f0d0a',
              border:       '1px solid #2a261d',
              borderRadius: 6,
              listStyle:    'none',
              margin:       0,
              padding:      '4px 0',
              minWidth:     160,
              zIndex:       50,
              boxShadow:    '0 8px 24px rgba(0,0,0,0.6)',
            }}>
              {DEPT_LINKS.map(d => (
                <li key={d.href}>
                  <a
                    href={d.href}
                    onClick={() => setDeptOpen(false)}
                    style={{
                      display:        'block',
                      padding:        '8px 18px',
                      color:          '#9b907a',
                      textDecoration: 'none',
                      fontFamily:     "'JetBrains Mono', ui-monospace, monospace",
                      fontSize:       10,
                      letterSpacing:  '0.18em',
                      textTransform:  'uppercase',
                    }}
                  >
                    {d.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* sub-eyebrow (department) */}
      <div style={{
        fontFamily:    "'JetBrains Mono', ui-monospace, monospace",
        fontSize:      10,
        letterSpacing: '0.28em',
        textTransform: 'uppercase',
        color:         '#7d7565',
        marginBottom:  16,
      }}>
        Revenue · The Namkhan
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
                <li>HoD creates projects from this menu.</li>
                <li>Click <b>＋ Attach</b> in the chat to upload a file (max 25 MB).</li>
                <li>Press <b>Summarise</b> any time to get a fresh retro of the project so far.</li>
                <li>Archive = gone. The list filters archived projects out.</li>
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

      {/* ── HERO: chat in the middle ─────────────────────────────────────── */}
      <div style={{
        flex:           1,
        display:        'flex',
        flexDirection:  'column',
        justifyContent: 'center',
        alignItems:     'center',
        gap:            22,
        marginTop:      -32,
        marginBottom:   56,
      }}>
        <div style={{
          fontFamily:    "'Fraunces', Georgia, serif",
          fontStyle:     'italic',
          fontWeight:    300,
          fontSize:      'clamp(24px, 3.4vw, 38px)',
          letterSpacing: '-0.015em',
          color:         '#d8cca8',
          textAlign:     'center',
          maxWidth:      720,
        }}>
          Ask Vector anything about revenue.
        </div>

        <form onSubmit={submitChat} style={{ width: '100%', maxWidth: 720 }}>
          {/* attached file chips (above the input pill) */}
          {attachments.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
              {attachments.map((a, i) => (
                <div key={`${a.path}-${i}`} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: '#15110b', border: '1px solid #3a3327', borderRadius: 12,
                  padding: '3px 8px', fontSize: 11, color: '#d8cca8',
                }}>
                  <span>📎 {a.name}</span>
                  <span style={{ color: '#7d7565' }}>· {(a.size / 1024).toFixed(0)} KB</span>
                  <button
                    type="button"
                    onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                    style={{ background: 'transparent', border: 'none', color: '#7d7565', cursor: 'pointer', fontSize: 13, padding: '0 2px' }}
                  >×</button>
                </div>
              ))}
            </div>
          )}
          <div style={{
            display:      'flex',
            alignItems:   'stretch',
            border:       '1px solid #3a3327',
            borderRadius: 14,
            overflow:     'hidden',
            background:   '#15110b',
            boxShadow:    '0 12px 32px rgba(0,0,0,0.45)',
          }}>
            {/* + paperclip — file upload trigger (PBS 2026-05-08) */}
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
              style={{
                background: 'transparent',
                border:     'none',
                borderRight:'1px solid #2a261d',
                color:      uploading ? '#5a5448' : '#a8854a',
                cursor:     uploading ? 'wait' : 'pointer',
                padding:    '0 16px',
                fontSize:   18,
                fontWeight: 300,
              }}
            >
              {uploading ? '↑' : '+'}
            </button>
            <input
              ref={inputRef}
              type="text"
              value={chatValue}
              onChange={e => setChatValue(e.target.value)}
              placeholder={activeProject ? `Ask Vector — scoped to "${activeProject.name}"…` : 'e.g. how are we pacing for next weekend?'}
              style={{
                flex:       1,
                background: 'transparent',
                border:     'none',
                outline:    'none',
                color:      '#efe6d3',
                fontFamily: "'Inter Tight', system-ui, sans-serif",
                fontSize:   15,
                padding:    '16px 20px',
              }}
            />
            <button
              type="submit"
              style={{
                background:    '#a8854a',
                border:        'none',
                color:         '#0a0a0a',
                padding:       '0 22px',
                cursor:        'pointer',
                fontFamily:    "'JetBrains Mono', ui-monospace, monospace",
                fontSize:      11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                fontWeight:    600,
              }}
            >
              Ask ↵
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
          onAdd={addDoc}
        >
          {docs.map(d => (
            <Row key={d.id} onDelete={() => delDoc(d.id)}>
              <a
                href={d.href}
                style={{
                  flex:           1,
                  fontSize:       13,
                  color:          '#c9bb96',
                  textDecoration: 'none',
                  lineHeight:     1.4,
                }}
              >
                {d.label}
              </a>
            </Row>
          ))}
          {docs.length === 0 && <Empty label="No docs pinned" />}
        </Container>

        {/* TASKS */}
        <Container
          title="My tasks"
          onAdd={addTask}
        >
          {tasks.map(t => (
            <Row key={t.id} onDelete={() => delTask(t.id)}>
              <button
                onClick={() => toggleTask(t.id)}
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
              <span style={{
                flex:           1,
                fontSize:       13,
                color:          t.done ? '#7d7565' : '#c9bb96',
                textDecoration: t.done ? 'line-through' : 'none',
                lineHeight:     1.4,
              }}>
                {t.label}
              </span>
            </Row>
          ))}
          {tasks.length === 0 && <Empty label="Nothing on the list" />}
        </Container>
      </div>
    </div>
  );
}

/* ─── small primitives ───────────────────────────────────────────────────── */

function Container({
  title, onAdd, children,
}: { title: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      background:   '#0f0d0a',
      border:       '1px solid #1f1c15',
      borderRadius: 12,
      padding:      '14px 16px 16px',
      display:      'flex',
      flexDirection: 'column',
      minHeight:    180,
    }}>
      <div style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
        marginBottom:   12,
        paddingBottom:  10,
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
            background:   'transparent',
            border:       '1px solid #2a261d',
            borderRadius: 4,
            color:        '#a8854a',
            cursor:       'pointer',
            fontSize:     14,
            lineHeight:   1,
            width:        22,
            height:       22,
            padding:      0,
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
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
