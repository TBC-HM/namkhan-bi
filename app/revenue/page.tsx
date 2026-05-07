'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// ─── Types ───────────────────────────────────────────────────────────────────
interface DocItem  { id: string; label: string; href: string }
interface TaskItem { id: string; label: string; done: boolean }

const DOCS_KEY  = 'nk.entry.docs.revenue.v1';
const TASKS_KEY = 'nk.entry.tasks.revenue.v1';

const DEFAULT_DOCS: DocItem[] = [
  { id: '1', label: 'Revenue Strategy 2025',       href: '/revenue/strategy'    },
  { id: '2', label: 'Channel Mix Report — Apr 26',  href: '/revenue/channel-mix' },
  { id: '3', label: 'BAR Rate Grid',                href: '/revenue/bar'         },
];

const DEFAULT_TASKS: TaskItem[] = [
  { id: '1', label: 'Review OTA parity alerts',     done: false },
  { id: '2', label: 'Update BAR for long weekend',  done: false },
  { id: '3', label: 'Sign off on group quote #12',  done: false },
];

const QUICK_CHIPS = [
  { label: 'Pulse',    href: '/revenue/pulse'       },
  { label: 'Compset',  href: '/revenue/compset'     },
  { label: 'Parity',   href: '/revenue/parity'      },
  { label: 'Pace',     href: '/revenue/pace'        },
  { label: 'Channels', href: '/revenue/channels'    },
  { label: 'Forecast', href: '/revenue/forecast'    },
];

const ATTENTION_ITEMS = [
  { id: '1', label: 'OTA parity breach — Booking.com $142 vs direct $158', severity: 'high'   },
  { id: '2', label: 'Pace is −14 % vs STLY for next 30 days',              severity: 'medium' },
  { id: '3', label: 'Compset data stale — last sync 48 h ago',             severity: 'low'    },
];

const DEPT_LINKS = [
  { label: 'Overview',    href: '/overview'    },
  { label: 'Revenue',     href: '/revenue'     },
  { label: 'Sales',       href: '/sales'       },
  { label: 'Marketing',   href: '/marketing'   },
  { label: 'Operations',  href: '/operations'  },
  { label: 'Finance',     href: '/finance'     },
  { label: 'Guest',       href: '/guest'       },
];

const severityColor: Record<string, string> = {
  high:   '#ef4444',
  medium: '#f59e0b',
  low:    '#6b7280',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function loadLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function RevenuePage() {
  const router = useRouter();

  const [greeting, setGreeting] = useState('Good morning');
  const [chatValue, setChatValue] = useState('');
  const [docs,  setDocs]  = useState<DocItem[]>(DEFAULT_DOCS);
  const [tasks, setTasks] = useState<TaskItem[]>(DEFAULT_TASKS);
  const [deptOpen, setDeptOpen] = useState(false);

  // Hydrate from localStorage after mount
  useEffect(() => {
    setDocs(loadLS<DocItem[]>(DOCS_KEY, DEFAULT_DOCS));
    setTasks(loadLS<TaskItem[]>(TASKS_KEY, DEFAULT_TASKS));

    const h = new Date().getHours();
    if (h >= 12 && h < 17) setGreeting('Good afternoon');
    else if (h >= 17)       setGreeting('Good evening');
  }, []);

  // Persist tasks on toggle
  function toggleTask(id: string) {
    setTasks(prev => {
      const next = prev.map(t => t.id === id ? { ...t, done: !t.done } : t);
      localStorage.setItem(TASKS_KEY, JSON.stringify(next));
      return next;
    });
  }

  function handleChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatValue.trim()) return;
    void router.push(`/cockpit/chat?q=${encodeURIComponent(chatValue.trim())}&dept=revenue`);
  }

  return (
    <div style={{
      minHeight:       '100vh',
      background:      '#000',
      color:           '#fff',
      fontFamily:      'Inter, sans-serif',
      padding:         '48px 40px 80px',
      boxSizing:       'border-box',
      position:        'relative',
    }}>

      {/* ── Dept dropdown (top-right) ──────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: 24, right: 40, zIndex: 50 }}>
        <button
          onClick={() => setDeptOpen(o => !o)}
          style={{
            background:   'transparent',
            border:       '1px solid #333',
            borderRadius: 8,
            color:        '#aaa',
            padding:      '6px 14px',
            cursor:       'pointer',
            fontSize:     13,
          }}
        >
          Revenue ▾
        </button>
        {deptOpen && (
          <ul style={{
            position:     'absolute',
            right:        0,
            top:          36,
            background:   '#111',
            border:       '1px solid #333',
            borderRadius: 8,
            listStyle:    'none',
            margin:       0,
            padding:      '6px 0',
            minWidth:     140,
          }}>
            {DEPT_LINKS.map(d => (
              <li key={d.href}>
                <a
                  href={d.href}
                  style={{
                    display:  'block',
                    padding:  '7px 18px',
                    color:    '#ccc',
                    textDecoration: 'none',
                    fontSize: 13,
                  }}
                  onClick={() => setDeptOpen(false)}
                >
                  {d.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── 1. Greeting ───────────────────────────────────────────────────── */}
      <h1 style={{
        fontFamily:  'Fraunces, Georgia, serif',
        fontStyle:   'italic',
        fontWeight:  400,
        fontSize:    'clamp(28px, 4vw, 48px)',
        margin:      '0 0 36px',
        letterSpacing: '-0.5px',
      }}>
        {greeting}, Boss (Paul Bauer).
      </h1>

      {/* ── 2. Ask-anything chat box ──────────────────────────────────────── */}
      <form onSubmit={handleChat} style={{ marginBottom: 32, maxWidth: 640 }}>
        <div style={{
          display:      'flex',
          border:       '1px solid #333',
          borderRadius: 12,
          overflow:     'hidden',
          background:   '#0d0d0d',
        }}>
          <input
            type="text"
            value={chatValue}
            onChange={e => setChatValue(e.target.value)}
            placeholder="Ask anything about Revenue…"
            style={{
              flex:        1,
              background:  'transparent',
              border:      'none',
              outline:     'none',
              color:       '#fff',
              fontSize:    15,
              padding:     '14px 18px',
            }}
          />
          <button
            type="submit"
            style={{
              background:  '#1a1a1a',
              border:      'none',
              borderLeft:  '1px solid #333',
              color:       '#888',
              padding:     '0 20px',
              cursor:      'pointer',
              fontSize:    18,
            }}
          >
            ↵
          </button>
        </div>
      </form>

      {/* ── 3. Quick-page chip row ────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 48 }}>
        {QUICK_CHIPS.map(c => (
          <a
            key={c.href}
            href={c.href}
            style={{
              background:   '#111',
              border:       '1px solid #2a2a2a',
              borderRadius: 20,
              color:        '#ccc',
              fontSize:     13,
              padding:      '7px 18px',
              textDecoration: 'none',
              whiteSpace:   'nowrap',
              transition:   'border-color 0.15s',
            }}
          >
            {c.label}
          </a>
        ))}
      </div>

      {/* ── 4. Two-column: My Docs / My Tasks ────────────────────────────── */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: '1fr 1fr',
        gap:                 32,
        marginBottom:        48,
        maxWidth:            960,
      }}>

        {/* My Docs */}
        <div>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: '#666', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 16px' }}>
            My Docs
          </h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {docs.map(doc => (
              <li key={doc.id}>
                <a
                  href={doc.href}
                  style={{
                    display:      'flex',
                    alignItems:   'center',
                    gap:          10,
                    background:   '#0d0d0d',
                    border:       '1px solid #1e1e1e',
                    borderRadius: 8,
                    padding:      '10px 14px',
                    color:        '#ddd',
                    textDecoration: 'none',
                    fontSize:     14,
                  }}
                >
                  <span style={{ color: '#555', fontSize: 16 }}>📄</span>
                  {doc.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* My Tasks */}
        <div>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: '#666', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 16px' }}>
            My Tasks
          </h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tasks.map(task => (
              <li key={task.id}>
                <button
                  onClick={() => toggleTask(task.id)}
                  style={{
                    display:      'flex',
                    alignItems:   'center',
                    gap:          10,
                    width:        '100%',
                    background:   '#0d0d0d',
                    border:       '1px solid #1e1e1e',
                    borderRadius: 8,
                    padding:      '10px 14px',
                    color:        task.done ? '#555' : '#ddd',
                    fontSize:     14,
                    cursor:       'pointer',
                    textAlign:    'left',
                    textDecoration: task.done ? 'line-through' : 'none',
                    transition:   'color 0.15s',
                  }}
                >
                  <span style={{
                    width:        18,
                    height:       18,
                    borderRadius: 4,
                    border:       `1px solid ${task.done ? '#3a3a3a' : '#555'}`,
                    background:   task.done ? '#1a1a1a' : 'transparent',
                    display:      'flex',
                    alignItems:   'center',
                    justifyContent: 'center',
                    flexShrink:   0,
                    fontSize:     11,
                  }}>
                    {task.done ? '✓' : ''}
                  </span>
                  {task.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── 5. Dept dropdown already rendered top-right ───────────────────── */}

      {/* ── 6. Needs-your-attention ───────────────────────────────────────── */}
      <div style={{ maxWidth: 960 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: '#666', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 16px' }}>
          Needs your attention
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ATTENTION_ITEMS.map(item => (
            <div
              key={item.id}
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          12,
                background:   '#0d0d0d',
                border:       `1px solid #1e1e1e`,
                borderLeft:   `3px solid ${severityColor[item.severity]}`,
                borderRadius: 8,
                padding:      '12px 16px',
                fontSize:     14,
                color:        '#ccc',
              }}
            >
              <span style={{
                width:        8,
                height:       8,
                borderRadius: '50%',
                background:   severityColor[item.severity],
                flexShrink:   0,
              }} />
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
