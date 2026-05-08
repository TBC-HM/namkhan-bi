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

const REVENUE_CHIPS = [
  { label: 'Pulse', href: '/revenue/pulse' },
  { label: 'Compset', href: '/revenue/compset' },
  { label: 'Parity', href: '/revenue/parity' },
  { label: 'Forecast', href: '/revenue/forecast' },
  { label: 'Channels', href: '/revenue/channels' },
];

const STUB_ALERTS = [
  { id: 1, label: 'OCC below 60% for next 7 days — action needed', severity: 'high' },
  { id: 2, label: 'Booking.com rate parity breach detected', severity: 'high' },
  { id: 3, label: 'Compset data stale — last refresh >24 h', severity: 'medium' },
  { id: 4, label: 'ADR trending −12% vs same period LY', severity: 'medium' },
  { id: 5, label: 'Channel mix: OTA share >70% — review direct strategy', severity: 'low' },
];

const DOCS_KEY = 'nk.entry.docs.revenue.v1';
const TASKS_KEY = 'nk.entry.tasks.revenue.v1';

const DEFAULT_DOCS = [
  'Revenue Strategy 2026',
  'Rate Plan Matrix',
  'Channel Distribution Guide',
];

const DEFAULT_TASKS = [
  'Review weekend rate laddering',
  'Update compset tracking list',
  'Prepare monthly RevPAR report',
];

export default function RevenuePage() {
  const [chatInput, setChatInput] = useState('');
  const [docs, setDocs] = useState<string[]>(DEFAULT_DOCS);
  const [tasks, setTasks] = useState<string[]>(DEFAULT_TASKS);
  const [newDoc, setNewDoc] = useState('');
  const [newTask, setNewTask] = useState('');
  const [deptOpen, setDeptOpen] = useState(false);

  useEffect(() => {
    try {
      const d = localStorage.getItem(DOCS_KEY);
      const t = localStorage.getItem(TASKS_KEY);
      if (d) setDocs(JSON.parse(d) as string[]);
      if (t) setTasks(JSON.parse(t) as string[]);
    } catch {
      // ignore
    }
  }, []);

  function saveDocs(next: string[]) {
    setDocs(next);
    localStorage.setItem(DOCS_KEY, JSON.stringify(next));
  }

  function saveTasks(next: string[]) {
    setTasks(next);
    localStorage.setItem(TASKS_KEY, JSON.stringify(next));
  }

  function addDoc() {
    if (!newDoc.trim()) return;
    saveDocs([...docs, newDoc.trim()]);
    setNewDoc('');
  }

  function addTask() {
    if (!newTask.trim()) return;
    saveTasks([...tasks, newTask.trim()]);
    setNewTask('');
  }

  function removeDoc(i: number) {
    saveDocs(docs.filter((_, idx) => idx !== i));
  }

  function removeTask(i: number) {
    saveTasks(tasks.filter((_, idx) => idx !== i));
  }

  function handleChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    window.location.href = `/cockpit?q=${encodeURIComponent(chatInput)}&role=revenue`;
  }

  const severityColor: Record<string, string> = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#6b7280',
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#000',
        color: '#fff',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '40px 32px',
        boxSizing: 'border-box',
        maxWidth: 1200,
        margin: '0 auto',
      }}
    >
      {/* Greeting */}
      <p
        style={{
          fontFamily: 'Fraunces, Georgia, serif',
          fontStyle: 'italic',
          fontSize: 28,
          fontWeight: 400,
          color: '#fff',
          marginBottom: 32,
          letterSpacing: '-0.01em',
        }}
      >
        Good morning, Boss (Paul Bauer).
      </p>

      {/* Ask-anything chat */}
      <form onSubmit={handleChat} style={{ marginBottom: 32 }}>
        <div
          style={{
            display: 'flex',
            gap: 8,
            background: '#111',
            border: '1px solid #333',
            borderRadius: 10,
            padding: '10px 14px',
            alignItems: 'center',
          }}
        >
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            placeholder="Ask anything about Revenue…"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#fff',
              fontSize: 15,
            }}
          />
          <button
            type="submit"
            style={{
              background: '#FFD700',
              color: '#000',
              border: 'none',
              borderRadius: 6,
              padding: '6px 16px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Ask
          </button>
        </div>
      </form>

      {/* Revenue page chips */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 32 }}>
        {REVENUE_CHIPS.map(chip => (
          <a
            key={chip.href}
            href={chip.href}
            style={{
              background: '#111',
              border: '1px solid #333',
              borderRadius: 20,
              padding: '6px 18px',
              color: '#FFD700',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
              letterSpacing: '0.02em',
              transition: 'border-color 0.15s',
            }}
          >
            {chip.label}
          </a>
        ))}
      </div>

      {/* My Docs + My Tasks */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 24,
          marginBottom: 32,
        }}
      >
        {/* My Docs */}
        <div
          style={{
            background: '#0a0a0a',
            border: '1px solid #222',
            borderRadius: 12,
            padding: 20,
          }}
        >
          <h3 style={{ margin: '0 0 14px', fontSize: 14, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            My Docs
          </h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {docs.map((d, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #1a1a1a' }}>
                <span style={{ fontSize: 14, color: '#e5e5e5' }}>📄 {d}</span>
                <button onClick={() => removeDoc(i)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <input
              value={newDoc}
              onChange={e => setNewDoc(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addDoc()}
              placeholder="Add doc…"
              style={{ flex: 1, background: '#111', border: '1px solid #333', borderRadius: 6, padding: '5px 10px', color: '#fff', fontSize: 13 }}
            />
            <button onClick={addDoc} style={{ background: '#222', border: '1px solid #444', borderRadius: 6, color: '#FFD700', padding: '5px 12px', cursor: 'pointer', fontSize: 13 }}>+</button>
          </div>
        </div>

        {/* My Tasks */}
        <div
          style={{
            background: '#0a0a0a',
            border: '1px solid #222',
            borderRadius: 12,
            padding: 20,
          }}
        >
          <h3 style={{ margin: '0 0 14px', fontSize: 14, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            My Tasks
          </h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {tasks.map((t, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #1a1a1a' }}>
                <span style={{ fontSize: 14, color: '#e5e5e5' }}>☐ {t}</span>
                <button onClick={() => removeTask(i)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <input
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTask()}
              placeholder="Add task…"
              style={{ flex: 1, background: '#111', border: '1px solid #333', borderRadius: 6, padding: '5px 10px', color: '#fff', fontSize: 13 }}
            />
            <button onClick={addTask} style={{ background: '#222', border: '1px solid #444', borderRadius: 6, color: '#FFD700', padding: '5px 12px', cursor: 'pointer', fontSize: 13 }}>+</button>
          </div>
        </div>
      </div>

      {/* Needs-your-attention */}
      <div
        style={{
          background: '#0a0a0a',
          border: '1px solid #222',
          borderRadius: 12,
          padding: 20,
          marginBottom: 32,
        }}
      >
        <h3 style={{ margin: '0 0 14px', fontSize: 14, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Needs Your Attention
        </h3>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {STUB_ALERTS.map(alert => (
            <li
              key={alert.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '9px 0',
                borderBottom: '1px solid #1a1a1a',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: severityColor[alert.severity],
                  flexShrink: 0,
                  display: 'inline-block',
                }}
              />
              <span style={{ fontSize: 14, color: '#e5e5e5' }}>{alert.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Department dropdown */}
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button
          onClick={() => setDeptOpen(o => !o)}
          style={{
            background: '#111',
            border: '1px solid #333',
            borderRadius: 8,
            color: '#fff',
            padding: '8px 20px',
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          Departments ▾
        </button>
        {deptOpen && (
          <ul
            style={{
              position: 'absolute',
              bottom: '110%',
              left: 0,
              background: '#111',
              border: '1px solid #333',
              borderRadius: 8,
              listStyle: 'none',
              margin: 0,
              padding: '6px 0',
              minWidth: 160,
              zIndex: 100,
            }}
          >
            {DEPT_CHIPS.map(dept => (
              <li key={dept.href}>
                <a
                  href={dept.href}
                  style={{
                    display: 'block',
                    padding: '8px 18px',
                    color: dept.href === '/revenue' ? '#FFD700' : '#e5e5e5',
                    textDecoration: 'none',
                    fontSize: 14,
                    fontWeight: dept.href === '/revenue' ? 600 : 400,
                  }}
                >
                  {dept.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
