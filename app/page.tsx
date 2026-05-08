'use client';

// app/page.tsx — HOME = ARCHITECT entry page
// 2026-05-08: rebuilt to match the dept-entry-page pattern (greeting +
// hero chat + chips + Sub-pages dropdown + 3 containers). The architect
// orchestrates the 6 dept HoDs + IT cockpit, so chips and dropdown
// surface those 7 surfaces. Chat composer routes into the cockpit chat
// addressed to Felix (role=lead).
//
// Replaces the prior 21-line ChatShell-only home — that one was
// functionally the architect chat but visually didn't match the dept
// entry pages PBS shipped today.

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface AttentionItem { id: string; label: string; severity: 'high' | 'medium' | 'low' }
interface DocItem       { id: string; label: string; href: string }
interface TaskItem      { id: string; label: string; done: boolean }

const ATTN_KEY  = 'nk.arch.entry.attention.v2';
const DOCS_KEY  = 'nk.arch.entry.docs.v2';
const TASKS_KEY = 'nk.arch.entry.tasks.v2';

const DEFAULT_ATTN: AttentionItem[] = [
  { id: 'a1', label: 'Agent fleet health — Captain Kit triages every chat', severity: 'medium' },
  { id: 'a2', label: 'Open cockpit tickets need triage',                    severity: 'medium' },
  { id: 'a3', label: 'Deploy queue — staging → main approvals',             severity: 'low'    },
];

const DEFAULT_DOCS: DocItem[] = [
  { id: 'd1', label: 'Cockpit overview',  href: '/cockpit'            },
  { id: 'd2', label: 'Tasks board',       href: '/cockpit/tasks'      },
  { id: 'd3', label: 'Knowledge base',    href: '/knowledge'          },
];

const DEFAULT_TASKS: TaskItem[] = [
  { id: 't1', label: 'Review pending PRs',         done: false },
  { id: 't2', label: 'Approve staging deploys',    done: false },
  { id: 't3', label: 'Triage open tickets',        done: false },
];

// Chips + dropdown surface the 7 dept entry pages the architect orchestrates.
const QUICK_CHIPS = [
  { label: 'Revenue',    href: '/revenue'    },
  { label: 'Sales',      href: '/sales'      },
  { label: 'Marketing',  href: '/marketing'  },
  { label: 'Operations', href: '/operations' },
  { label: 'Finance',    href: '/finance'    },
  { label: 'Guest',      href: '/guest'      },
  { label: 'IT',         href: '/it'         },
];

const DEPT_LINKS = [
  { label: 'Revenue',    href: '/revenue'    },
  { label: 'Sales',      href: '/sales'      },
  { label: 'Marketing',  href: '/marketing'  },
  { label: 'Operations', href: '/operations' },
  { label: 'Finance',    href: '/finance'    },
  { label: 'Guest',      href: '/guest'      },
  { label: 'IT',         href: '/it'         },
  { label: 'Cockpit',    href: '/cockpit'    },
  { label: 'Overview',   href: '/overview'   },
];

const SEVERITY_DOT: Record<string, string> = {
  high:   '#c0584c',
  medium: '#c4a06b',
  low:    '#7d7565',
};

function loadLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function saveLS<T>(key: string, value: T) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota / SSR */ }
}
function uid() { return Math.random().toString(36).slice(2, 9); }

export default function ArchitectHome() {
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
    router.push(`/cockpit/chat?q=${encodeURIComponent(q)}&dept=architect`);
  }

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
  function addDoc() {
    const label = prompt('Doc title');
    if (!label) return;
    const href = prompt('Link URL', '/') || '/';
    const next = [...docs, { id: uid(), label, href }];
    setDocs(next); saveLS(DOCS_KEY, next);
  }
  function delDoc(id: string) {
    const next = docs.filter(d => d.id !== id);
    setDocs(next); saveLS(DOCS_KEY, next);
  }
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

      {/* Top row: greeting (left) + Sub-pages dropdown (right) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
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
              position: 'absolute', right: 0, top: 36,
              background: '#0f0d0a', border: '1px solid #2a261d', borderRadius: 6,
              listStyle: 'none', margin: 0, padding: '4px 0', minWidth: 160,
              zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            }}>
              {DEPT_LINKS.map(d => (
                <li key={d.href}>
                  <a href={d.href} onClick={() => setDeptOpen(false)} style={{
                    display: 'block', padding: '8px 18px', color: '#9b907a',
                    textDecoration: 'none',
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
                  }}>
                    {d.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* sub-eyebrow */}
      <div style={{
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase',
        color: '#7d7565', marginBottom: 40,
      }}>
        Architect · The Namkhan
      </div>

      {/* Hero chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 720, width: '100%', margin: '0 auto', alignItems: 'stretch' }}>
        <div style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontSize: 'clamp(28px, 3.4vw, 44px)', fontWeight: 300, lineHeight: 1.15,
          letterSpacing: '-0.01em', textAlign: 'center', marginBottom: 6,
        }}>
          What needs the <span style={{ fontStyle: 'italic', color: '#c4a06b' }}>architect</span>?
        </div>
        <div style={{ fontSize: 13, color: '#9b907a', textAlign: 'center', marginBottom: 24 }}>
          Ask Felix anything — he routes to the right HoD.
        </div>
        <form onSubmit={submitChat} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: '#13110d', border: '1px solid #2a261d',
            borderRadius: 12, padding: '10px 14px',
          }}>
            <input
              ref={inputRef}
              value={chatValue}
              onChange={e => setChatValue(e.target.value)}
              placeholder="e.g. ship the dept-page redesign"
              style={{
                flex: 1, background: 'transparent', border: 'none',
                color: '#e9e1ce', fontSize: 14, outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            <button type="submit" style={{
              background: '#c4a06b', color: '#0a0a0a', border: 'none',
              borderRadius: 6, padding: '6px 16px', cursor: 'pointer',
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
              fontWeight: 600,
            }}>
              Ask
            </button>
          </div>

          {/* Chip row directly under chat */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
            {QUICK_CHIPS.map(c => (
              <a key={c.href} href={c.href} style={{
                padding: '4px 10px', background: '#13110d', border: '1px solid #2a261d',
                borderRadius: 14, color: '#9b907a', textDecoration: 'none',
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase',
              }}>
                {c.label}
              </a>
            ))}
          </div>
        </form>
      </div>

      {/* 3-container row: Action items / My Docs / My Tasks */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16,
        marginTop: 56, maxWidth: 1100, width: '100%', marginLeft: 'auto', marginRight: 'auto',
      }}>
        <div style={cardStyle()}>
          <div style={cardHeader()}>
            <span>ACTION ITEMS</span>
            <button onClick={addAttn} style={iconBtn()}>+</button>
          </div>
          <ul style={listReset()}>
            {attn.map(a => (
              <li key={a.id} style={listRow()}>
                <span style={{ color: SEVERITY_DOT[a.severity], marginRight: 8 }}>●</span>
                <span style={{ flex: 1 }}>{a.label}</span>
                <button onClick={() => delAttn(a.id)} style={iconBtn()}>×</button>
              </li>
            ))}
            {attn.length === 0 && <li style={emptyRow()}>nothing flagged</li>}
          </ul>
        </div>

        <div style={cardStyle()}>
          <div style={cardHeader()}>
            <span>MY DOCS</span>
            <button onClick={addDoc} style={iconBtn()}>+</button>
          </div>
          <ul style={listReset()}>
            {docs.map(d => (
              <li key={d.id} style={listRow()}>
                <a href={d.href} style={{ flex: 1, color: '#e9e1ce', textDecoration: 'none' }}>{d.label}</a>
                <button onClick={() => delDoc(d.id)} style={iconBtn()}>×</button>
              </li>
            ))}
            {docs.length === 0 && <li style={emptyRow()}>no docs pinned</li>}
          </ul>
        </div>

        <div style={cardStyle()}>
          <div style={cardHeader()}>
            <span>MY TASKS</span>
            <button onClick={addTask} style={iconBtn()}>+</button>
          </div>
          <ul style={listReset()}>
            {tasks.map(t => (
              <li key={t.id} style={listRow()}>
                <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} style={{ marginRight: 8, accentColor: '#c4a06b' }} />
                <span style={{ flex: 1, textDecoration: t.done ? 'line-through' : 'none', color: t.done ? '#7d7565' : '#e9e1ce' }}>{t.label}</span>
                <button onClick={() => delTask(t.id)} style={iconBtn()}>×</button>
              </li>
            ))}
            {tasks.length === 0 && <li style={emptyRow()}>no tasks</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

const cardStyle  = (): React.CSSProperties => ({
  background: '#13110d', border: '1px solid #2a261d', borderRadius: 10,
  padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10,
});
const cardHeader = (): React.CSSProperties => ({
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontSize: 9, letterSpacing: '0.22em', color: '#7d7565',
});
const listReset  = (): React.CSSProperties => ({ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 });
const listRow    = (): React.CSSProperties => ({ display: 'flex', alignItems: 'center', fontSize: 13, color: '#e9e1ce' });
const emptyRow   = (): React.CSSProperties => ({ fontSize: 12, color: '#7d7565', fontStyle: 'italic' });
const iconBtn    = (): React.CSSProperties => ({
  background: 'transparent', border: 'none', color: '#7d7565', cursor: 'pointer',
  padding: '0 6px', fontSize: 14,
});
