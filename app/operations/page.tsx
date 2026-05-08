'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/* ──────────────────────────────────────────────────────────────────────────
 * /operations — entry page
 * Layout (PBS spec 2026-05-08):
 *   • greeting top-left, italic Fraunces, modest size
 *   • Operations ▾ dept dropdown top-right
 *   • CHAT in the middle as hero
 *   • small chip row immediately below chat
 *   • 3 containers in a row (Action items / My Docs / My Tasks)
 *     with + add and × delete per row, persisted to localStorage
 *   • black background, brass + paper accents (brand)
 * ────────────────────────────────────────────────────────────────────────── */

interface AttentionItem { id: string; label: string; severity: 'high' | 'medium' | 'low' }
interface DocItem       { id: string; label: string; href: string }
interface TaskItem      { id: string; label: string; done: boolean }

const ATTN_KEY  = 'nk.ops.entry.attention.v2';
const DOCS_KEY  = 'nk.ops.entry.docs.v2';
const TASKS_KEY = 'nk.ops.entry.tasks.v2';

const DEFAULT_ATTN: AttentionItem[] = [
  { id: 'a1', label: 'OTA parity breach — BDC $142 vs direct $158',  severity: 'high'   },
  { id: 'a2', label: 'Pace −14 % vs STLY for next 30 days',           severity: 'medium' },
  { id: 'a3', label: 'Compset data stale — last sync 48 h ago',      severity: 'low'    },
];

const DEFAULT_DOCS: DocItem[] = [
  { id: 'd1', label: 'Revenue Strategy 2025',      href: '/operations/strategy'    },
  { id: 'd2', label: 'Channel Mix Report — Apr 26', href: '/operations/channel-mix' },
  { id: 'd3', label: 'BAR Rate Grid',               href: '/operations/bar'         },
];

const DEFAULT_TASKS: TaskItem[] = [
  { id: 't1', label: 'Review OTA parity alerts',     done: false },
  { id: 't2', label: 'Update BAR for long weekend',  done: false },
  { id: 't3', label: 'Sign off on group quote #12',  done: false },
];

// 2026-05-08 (ticket #328 follow-up): chips + dropdown rewired to /operations sub-pages.
const QUICK_CHIPS = [
  { label: 'Snapshot',   href: '/operations'             },
  { label: 'Staff',      href: '/operations/staff'       },
  { label: 'F&B',        href: '/operations/restaurant'  },
  { label: 'Spa',        href: '/operations/spa'         },
  { label: 'Activities', href: '/operations/activities'  },
  { label: 'Inventory',  href: '/operations/inventory'   },
];

const DEPT_LINKS = [
  { label: 'Snapshot',           href: '/operations'                 },
  { label: 'Staff',              href: '/operations/staff'           },
  { label: 'F&B',                href: '/operations/restaurant'      },
  { label: 'Spa',                href: '/operations/spa'             },
  { label: 'Activities',         href: '/operations/activities'      },
  { label: 'Inventory',          href: '/operations/inventory'       },
  { label: 'Catalog cleanup',    href: '/operations/catalog-cleanup' },
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

// ─── component ──────────────────────────────────────────────────────────────
export default function RevenuePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [greeting,  setGreeting]  = useState('Good morning');
  const [chatValue, setChatValue] = useState('');
  const [attn,      setAttn]      = useState<AttentionItem[]>(DEFAULT_ATTN);
  const [docs,      setDocs]      = useState<DocItem[]>(DEFAULT_DOCS);
  const [tasks,     setTasks]     = useState<TaskItem[]>(DEFAULT_TASKS);
  const [deptOpen,  setDeptOpen]  = useState(false);

  useEffect(() => {
    setAttn (loadLS<AttentionItem[]>(ATTN_KEY,  DEFAULT_ATTN));
    setDocs (loadLS<DocItem[]>      (DOCS_KEY,  DEFAULT_DOCS));
    setTasks(loadLS<TaskItem[]>     (TASKS_KEY, DEFAULT_TASKS));
    const h = new Date().getHours();
    if (h >= 12 && h < 17) setGreeting('Good afternoon');
    else if (h >= 17)      setGreeting('Good evening');
    inputRef.current?.focus();
  }, []);

  function submitChat(e: React.FormEvent) {
    e.preventDefault();
    const q = chatValue.trim();
    if (!q) return;
    router.push(`/cockpit/chat?q=${encodeURIComponent(q)}&dept=operations`);
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
    const href = prompt('Link URL', '/operations/') || '/operations/';
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
        marginBottom:  56,
      }}>
        Operations · The Namkhan
      </div>

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
          Ask Forge anything about operations.
        </div>

        <form onSubmit={submitChat} style={{ width: '100%', maxWidth: 720 }}>
          <div style={{
            display:      'flex',
            border:       '1px solid #3a3327',
            borderRadius: 14,
            overflow:     'hidden',
            background:   '#15110b',
            boxShadow:    '0 12px 32px rgba(0,0,0,0.45)',
          }}>
            <input
              ref={inputRef}
              type="text"
              value={chatValue}
              onChange={e => setChatValue(e.target.value)}
              placeholder="e.g. how are we doing today?"
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
