'use client';

import { useState, useEffect } from 'react';

const DEPT_CHIPS = [
  { label: 'Revenue', href: '/revenue' },
  { label: 'Sales', href: '/sales' },
  { label: 'Marketing', href: '/marketing' },
  { label: 'Operations', href: '/operations' },
  { label: 'Guest', href: '/guest' },
  { label: 'Finance', href: '/finance' },
  { label: 'IT', href: '/it' },
];

const OPS_CHIPS = [
  { label: 'Daily Ops', href: '/operations/daily' },
  { label: 'Maintenance', href: '/operations/maintenance' },
  { label: 'Housekeeping', href: '/operations/housekeeping' },
  { label: 'F&B', href: '/operations/fnb' },
  { label: 'Staff', href: '/operations/staff' },
  { label: 'Incidents', href: '/operations/incidents' },
];

const STUB_ALERTS = [
  { id: 1, label: 'Maintenance request #14 — Room 7 A/C unresolved (2 days)', severity: 'high' },
  { id: 2, label: 'Housekeeping: 3 rooms past checkout not yet cleared', severity: 'medium' },
  { id: 3, label: 'F&B stock: Lao Beer inventory below par level', severity: 'medium' },
  { id: 4, label: 'Staff shift gap: Friday evening — 1 post uncovered', severity: 'low' },
  { id: 5, label: 'Incident log: pool area slippery surface report open', severity: 'high' },
];

const SEVERITY_COLOR: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#6b7280',
};

const LS_DOCS_KEY = 'nk.entry.docs.operations.v1';
const LS_TASKS_KEY = 'nk.entry.tasks.operations.v1';

const DEFAULT_DOCS = [
  'SOP — Room Maintenance Protocol',
  'F&B Daily Checklist',
  'Housekeeping Standards Manual',
];
const DEFAULT_TASKS = [
  'Review open maintenance tickets',
  'Sign off weekly housekeeping audit',
  'Check staff roster for weekend',
];

export default function OperationsEntryPage() {
  const [chatInput, setChatInput] = useState('');
  const [docs, setDocs] = useState<string[]>(DEFAULT_DOCS);
  const [tasks, setTasks] = useState<string[]>(DEFAULT_TASKS);
  const [newDoc, setNewDoc] = useState('');
  const [newTask, setNewTask] = useState('');
  const [deptOpen, setDeptOpen] = useState(false);

  useEffect(() => {
    try {
      const d = localStorage.getItem(LS_DOCS_KEY);
      const t = localStorage.getItem(LS_TASKS_KEY);
      if (d) setDocs(JSON.parse(d));
      if (t) setTasks(JSON.parse(t));
    } catch {}
  }, []);

  const saveDocs = (next: string[]) => {
    setDocs(next);
    localStorage.setItem(LS_DOCS_KEY, JSON.stringify(next));
  };
  const saveTasks = (next: string[]) => {
    setTasks(next);
    localStorage.setItem(LS_TASKS_KEY, JSON.stringify(next));
  };

  const addDoc = () => {
    if (!newDoc.trim()) return;
    saveDocs([...docs, newDoc.trim()]);
    setNewDoc('');
  };
  const addTask = () => {
    if (!newTask.trim()) return;
    saveTasks([...tasks, newTask.trim()]);
    setNewTask('');
  };
  const removeDoc = (i: number) => saveDocs(docs.filter((_, idx) => idx !== i));
  const removeTask = (i: number) => saveTasks(tasks.filter((_, idx) => idx !== i));

  const handleChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    window.location.href = `/cockpit?q=${encodeURIComponent(chatInput)}&role=ops_lead`;
  };

  return (
    <main style={{
      minHeight: '100vh',
      background: '#000',
      color: '#fff',
      fontFamily: 'Inter, sans-serif',
      padding: '0 0 64px 0',
    }}>
      {/* Top nav bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 32px',
        borderBottom: '1px solid #1a1a1a',
      }}>
        <span style={{ fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 700, letterSpacing: 1 }}>N</span>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setDeptOpen(o => !o)}
            style={{
              background: '#111',
              border: '1px solid #333',
              color: '#fff',
              borderRadius: 8,
              padding: '8px 18px',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Departments ▾
          </button>
          {deptOpen && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: '110%',
              background: '#111',
              border: '1px solid #333',
              borderRadius: 8,
              zIndex: 100,
              minWidth: 160,
              overflow: 'hidden',
            }}>
              {DEPT_CHIPS.map(d => (
                <a
                  key={d.href}
                  href={d.href}
                  style={{
                    display: 'block',
                    padding: '10px 18px',
                    color: '#fff',
                    textDecoration: 'none',
                    fontSize: 14,
                    borderBottom: '1px solid #1a1a1a',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#222')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {d.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px 0' }}>

        {/* Greeting */}
        <p style={{
          fontFamily: 'Fraunces, serif',
          fontStyle: 'italic',
          fontSize: 28,
          fontWeight: 400,
          color: '#fff',
          marginBottom: 32,
        }}>
          Good morning, Boss (Paul Bauer).
        </p>

        {/* Ask-anything chat */}
        <form onSubmit={handleChat} style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Ask anything about Operations…"
              style={{
                flex: 1,
                background: '#111',
                border: '1px solid #333',
                borderRadius: 8,
                color: '#fff',
                padding: '12px 16px',
                fontSize: 15,
                outline: 'none',
              }}
            />
            <button
              type="submit"
              style={{
                background: '#fff',
                color: '#000',
                border: 'none',
                borderRadius: 8,
                padding: '12px 22px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 15,
              }}
            >
              Ask
            </button>
          </div>
        </form>

        {/* Dept chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {DEPT_CHIPS.map(c => (
            <a
              key={c.href}
              href={c.href}
              style={{
                background: c.label === 'Operations' ? '#fff' : '#111',
                color: c.label === 'Operations' ? '#000' : '#aaa',
                border: '1px solid #333',
                borderRadius: 20,
                padding: '6px 16px',
                fontSize: 13,
                fontWeight: 500,
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              {c.label}
            </a>
          ))}
        </div>

        {/* Ops section chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 40 }}>
          {OPS_CHIPS.map(c => (
            <a
              key={c.href}
              href={c.href}
              style={{
                background: '#0a1a0a',
                color: '#4ade80',
                border: '1px solid #1a3a1a',
                borderRadius: 20,
                padding: '5px 14px',
                fontSize: 12,
                fontWeight: 500,
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              {c.label}
            </a>
          ))}
        </div>

        {/* My Docs + My Tasks */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 40 }}>

          {/* My Docs */}
          <div style={{ background: '#0d0d0d', border: '1px solid #1f1f1f', borderRadius: 12, padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>My Docs</h3>
            {docs.map((doc, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1a1a1a' }}>
                <span style={{ fontSize: 14, color: '#fff' }}>{doc}</span>
                <button onClick={() => removeDoc(i)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input
                value={newDoc}
                onChange={e => setNewDoc(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addDoc()}
                placeholder="Add doc…"
                style={{ flex: 1, background: '#111', border: '1px solid #333', borderRadius: 6, color: '#fff', padding: '6px 10px', fontSize: 13 }}
              />
              <button onClick={addDoc} style={{ background: '#222', border: '1px solid #333', color: '#fff', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>+</button>
            </div>
          </div>

          {/* My Tasks */}
          <div style={{ background: '#0d0d0d', border: '1px solid #1f1f1f', borderRadius: 12, padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>My Tasks</h3>
            {tasks.map((task, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1a1a1a' }}>
                <span style={{ fontSize: 14, color: '#fff' }}>{task}</span>
                <button onClick={() => removeTask(i)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTask()}
                placeholder="Add task…"
                style={{ flex: 1, background: '#111', border: '1px solid #333', borderRadius: 6, color: '#fff', padding: '6px 10px', fontSize: 13 }}
              />
              <button onClick={addTask} style={{ background: '#222', border: '1px solid #333', color: '#fff', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>+</button>
            </div>
          </div>
        </div>

        {/* Needs your attention */}
        <div style={{ background: '#0d0d0d', border: '1px solid #1f1f1f', borderRadius: 12, padding: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Needs Your Attention</h3>
          {STUB_ALERTS.map(alert => (
            <div key={alert.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 0',
              borderBottom: '1px solid #1a1a1a',
            }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: SEVERITY_COLOR[alert.severity],
                flexShrink: 0,
                display: 'inline-block',
              }} />
              <span style={{ fontSize: 14, color: '#e5e5e5' }}>{alert.label}</span>
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}
