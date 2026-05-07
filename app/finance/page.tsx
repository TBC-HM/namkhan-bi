'use client';

import { useState, useEffect } from 'react';

// ─── Finance quick-page chips ───────────────────────────────────────────────
const CHIPS = [
  { label: 'P&L',           href: '/finance/pnl' },
  { label: 'Cash Flow',     href: '/finance/cash-flow' },
  { label: 'Budget vs Act', href: '/finance/budget' },
  { label: 'AP / AR',       href: '/finance/ap-ar' },
  { label: 'Payroll',       href: '/finance/payroll' },
  { label: 'Tax & Compliance', href: '/finance/tax' },
];

// ─── Needs-your-attention stubs ─────────────────────────────────────────────
const ATTENTION_ITEMS = [
  { id: 1, label: 'Q1 bank reconciliation overdue by 3 days' },
  { id: 2, label: 'Supplier invoice #INV-2847 pending approval (฿ 148,000)' },
  { id: 3, label: 'Payroll run due Friday — headcount change flagged' },
];

const LS_DOCS  = 'nk.entry.docs.finance.v1';
const LS_TASKS = 'nk.entry.tasks.finance.v1';

interface DocItem  { id: number; text: string }
interface TaskItem { id: number; text: string; done: boolean }

function useLSState<T>(key: string, init: T) {
  const [val, setVal] = useState<T>(init);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setVal(JSON.parse(raw) as T);
    } catch { /* ignore */ }
  }, [key]);
  const save = (v: T) => {
    setVal(v);
    try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ }
  };
  return [val, save] as const;
}

export default function FinancePage() {
  const [chatInput, setChatInput] = useState('');
  const [docs,  setDocs]  = useLSState<DocItem[]>(LS_DOCS,  []);
  const [tasks, setTasks] = useLSState<TaskItem[]>(LS_TASKS, []);
  const [newDoc,  setNewDoc]  = useState('');
  const [newTask, setNewTask] = useState('');

  const addDoc = () => {
    if (!newDoc.trim()) return;
    setDocs([...docs, { id: Date.now(), text: newDoc.trim() }]);
    setNewDoc('');
  };

  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks([...tasks, { id: Date.now(), text: newTask.trim(), done: false }]);
    setNewTask('');
  };

  const toggleTask = (id: number) =>
    setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));

  return (
    <main style={{
      minHeight: '100vh',
      background: '#000',
      color: '#fff',
      fontFamily: 'Inter, sans-serif',
      padding: '48px 40px',
      boxSizing: 'border-box',
    }}>

      {/* ── Greeting ── */}
      <p style={{
        fontFamily: "'Fraunces', Georgia, serif",
        fontStyle: 'italic',
        fontSize: 28,
        fontWeight: 300,
        marginBottom: 32,
        color: '#f5f0e8',
      }}>
        Good morning, Boss (Paul Bauer).
      </p>

      {/* ── Ask-anything chat box ── */}
      <div style={{ marginBottom: 32, maxWidth: 680 }}>
        <div style={{
          display: 'flex',
          gap: 8,
          background: '#111',
          border: '1px solid #333',
          borderRadius: 12,
          padding: '10px 14px',
          alignItems: 'center',
        }}>
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            placeholder="Ask anything about Finance…"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#fff',
              fontSize: 15,
            }}
            onKeyDown={e => { if (e.key === 'Enter') setChatInput(''); }}
          />
          <button
            onClick={() => setChatInput('')}
            style={{
              background: '#fff',
              color: '#000',
              border: 'none',
              borderRadius: 8,
              padding: '6px 16px',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Ask
          </button>
        </div>
      </div>

      {/* ── Quick-page chips ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 40 }}>
        {CHIPS.map(c => (
          <a
            key={c.href}
            href={c.href}
            style={{
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: 20,
              padding: '6px 16px',
              fontSize: 13,
              color: '#ccc',
              textDecoration: 'none',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#333')}
          >
            {c.label}
          </a>
        ))}
      </div>

      {/* ── Two-column: My Docs · My Tasks ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 24,
        marginBottom: 40,
        maxWidth: 900,
      }}>
        {/* My Docs */}
        <div style={{
          background: '#0d0d0d',
          border: '1px solid #222',
          borderRadius: 12,
          padding: 20,
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
            My Docs
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px' }}>
            {docs.length === 0 && (
              <li style={{ color: '#555', fontSize: 13 }}>No docs pinned yet.</li>
            )}
            {docs.map(d => (
              <li key={d.id} style={{
                fontSize: 14,
                color: '#ddd',
                padding: '6px 0',
                borderBottom: '1px solid #1a1a1a',
              }}>
                📄 {d.text}
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={newDoc}
              onChange={e => setNewDoc(e.target.value)}
              placeholder="Add doc link or note…"
              style={{
                flex: 1, background: '#1a1a1a', border: '1px solid #333',
                borderRadius: 6, padding: '5px 10px', color: '#fff', fontSize: 13,
                outline: 'none',
              }}
              onKeyDown={e => { if (e.key === 'Enter') addDoc(); }}
            />
            <button onClick={addDoc} style={{
              background: '#222', border: '1px solid #444', borderRadius: 6,
              color: '#fff', padding: '5px 12px', cursor: 'pointer', fontSize: 13,
            }}>+</button>
          </div>
        </div>

        {/* My Tasks */}
        <div style={{
          background: '#0d0d0d',
          border: '1px solid #222',
          borderRadius: 12,
          padding: 20,
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
            My Tasks
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px' }}>
            {tasks.length === 0 && (
              <li style={{ color: '#555', fontSize: 13 }}>No tasks yet.</li>
            )}
            {tasks.map(t => (
              <li key={t.id} style={{
                fontSize: 14,
                color: t.done ? '#555' : '#ddd',
                padding: '6px 0',
                borderBottom: '1px solid #1a1a1a',
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                textDecoration: t.done ? 'line-through' : 'none',
                cursor: 'pointer',
              }}
                onClick={() => toggleTask(t.id)}
              >
                <span style={{
                  width: 16, height: 16, borderRadius: 4,
                  border: '1px solid #444',
                  background: t.done ? '#fff' : 'transparent',
                  display: 'inline-block', flexShrink: 0,
                }} />
                {t.text}
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              placeholder="Add a task…"
              style={{
                flex: 1, background: '#1a1a1a', border: '1px solid #333',
                borderRadius: 6, padding: '5px 10px', color: '#fff', fontSize: 13,
                outline: 'none',
              }}
              onKeyDown={e => { if (e.key === 'Enter') addTask(); }}
            />
            <button onClick={addTask} style={{
              background: '#222', border: '1px solid #444', borderRadius: 6,
              color: '#fff', padding: '5px 12px', cursor: 'pointer', fontSize: 13,
            }}>+</button>
          </div>
        </div>
      </div>

      {/* ── Needs Your Attention ── */}
      <div style={{ maxWidth: 900 }}>
        <h2 style={{
          fontSize: 14, fontWeight: 600, color: '#888',
          textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
        }}>
          Needs Your Attention
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ATTENTION_ITEMS.map(item => (
            <div key={item.id} style={{
              background: '#0d0d0d',
              border: '1px solid #2a1a00',
              borderLeft: '3px solid #f59e0b',
              borderRadius: 8,
              padding: '10px 16px',
              fontSize: 14,
              color: '#e5c97e',
            }}>
              ⚠ {item.label}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
