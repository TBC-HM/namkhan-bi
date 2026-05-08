'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const REVENUE_CHIPS = [
  { label: 'Pulse', href: '/revenue/pulse' },
  { label: 'Pace', href: '/revenue/pace' },
  { label: 'Channels', href: '/revenue/channels' },
  { label: 'Rate Plans', href: '/revenue/rate-plans' },
  { label: 'Pricing', href: '/revenue/pricing' },
  { label: 'Comp Set', href: '/revenue/compset' },
];

const DEPT_LINKS = [
  { label: 'Pulse', href: '/revenue/pulse' },
  { label: 'Pace', href: '/revenue/pace' },
  { label: 'Channels', href: '/revenue/channels' },
  { label: 'Rate Plans', href: '/revenue/rate-plans' },
  { label: 'Pricing', href: '/revenue/pricing' },
  { label: 'Comp Set', href: '/revenue/compset' },
];

const DOCS_KEY = 'nk.entry.docs.revenue.v1';
const TASKS_KEY = 'nk.entry.tasks.revenue.v1';

interface DocItem { id: string; title: string }
interface TaskItem { id: string; text: string; done: boolean }

function getHour() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function RevenuePage() {
  const [chatValue, setChatValue] = useState('');
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [newTask, setNewTask] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    try {
      const d = localStorage.getItem(DOCS_KEY);
      if (d) setDocs(JSON.parse(d) as DocItem[]);
    } catch { /* ignore */ }
    try {
      const t = localStorage.getItem(TASKS_KEY);
      if (t) setTasks(JSON.parse(t) as TaskItem[]);
    } catch { /* ignore */ }
  }, []);

  function saveDocs(next: DocItem[]) {
    setDocs(next);
    localStorage.setItem(DOCS_KEY, JSON.stringify(next));
  }

  function saveTasks(next: TaskItem[]) {
    setTasks(next);
    localStorage.setItem(TASKS_KEY, JSON.stringify(next));
  }

  function removeDoc(id: string) {
    saveDocs(docs.filter((d) => d.id !== id));
  }

  function addTask() {
    const text = newTask.trim();
    if (!text) return;
    saveTasks([...tasks, { id: Date.now().toString(), text, done: false }]);
    setNewTask('');
  }

  function toggleTask(id: string) {
    saveTasks(tasks.map((t) => t.id === id ? { ...t, done: !t.done } : t));
  }

  function removeTask(id: string) {
    saveTasks(tasks.filter((t) => t.id !== id));
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: '#000',
      color: '#fff',
      fontFamily: 'var(--font-mono, monospace)',
      display: 'flex',
      flexDirection: 'column',
      padding: '0',
    }}>
      {/* ── Nav bar ── */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 32px',
        borderBottom: '1px solid #1a1a1a',
      }}>
        {/* Left: brand */}
        <span style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontSize: 22, color: '#C9A84C' }}>
          N ▾
        </span>

        {/* Center: Home */}
        <Link href="/architect" style={{ color: '#888', fontSize: 13, letterSpacing: '0.08em', textDecoration: 'none' }}>
          Home
        </Link>

        {/* Right: dept dropdown + ND badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative' }}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            style={{
              background: 'none', border: '1px solid #C9A84C', color: '#C9A84C',
              padding: '4px 12px', borderRadius: 4, cursor: 'pointer',
              fontSize: 12, fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.1em',
            }}
          >
            REVENUE ▾
          </button>
          {dropdownOpen && (
            <div style={{
              position: 'absolute', top: 36, right: 0,
              background: '#111', border: '1px solid #333',
              borderRadius: 6, overflow: 'hidden', zIndex: 50, minWidth: 160,
            }}>
              {DEPT_LINKS.map((l) => (
                <Link key={l.href} href={l.href} style={{
                  display: 'block', padding: '10px 16px',
                  color: '#ccc', fontSize: 12, textDecoration: 'none',
                  letterSpacing: '0.08em',
                }}
                  onClick={() => setDropdownOpen(false)}
                >
                  {l.label.toUpperCase()}
                </Link>
              ))}
            </div>
          )}
          <span style={{
            background: '#C00', color: '#fff', borderRadius: 6,
            padding: '4px 10px', fontSize: 12, fontWeight: 700, letterSpacing: '0.05em',
          }}>ND</span>
        </div>
      </nav>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '56px 32px 48px', maxWidth: 900, margin: '0 auto', width: '100%' }}>

        {/* 1. Greeting */}
        <p style={{
          fontFamily: 'Fraunces, serif', fontStyle: 'italic',
          fontSize: 36, color: '#fff', marginBottom: 40, textAlign: 'center',
        }}>
          {getHour()}, Boss (Paul Bauer).
        </p>

        {/* 2. Chat box */}
        <div style={{
          width: '100%', background: '#111', borderRadius: 12,
          border: '1px solid #2a2a2a', padding: '16px 20px',
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32,
        }}>
          <button style={{
            background: 'none', border: '1px solid #333', color: '#666',
            borderRadius: 6, width: 32, height: 32, cursor: 'pointer', fontSize: 18, flexShrink: 0,
          }}>+</button>
          <input
            value={chatValue}
            onChange={(e) => setChatValue(e.target.value)}
            placeholder="Ask anything…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: '#fff', fontSize: 15, fontFamily: 'inherit',
            }}
          />
          <button style={{
            background: '#C9A84C', border: 'none', color: '#000',
            borderRadius: 6, width: 32, height: 32, cursor: 'pointer', fontSize: 16, flexShrink: 0,
            fontWeight: 700,
          }}>↑</button>
        </div>

        {/* 3. Quick-page chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 48, justifyContent: 'center' }}>
          {REVENUE_CHIPS.map((chip) => (
            <Link key={chip.href} href={chip.href} style={{
              border: '1px solid #C9A84C', color: '#C9A84C',
              padding: '6px 16px', borderRadius: 4, fontSize: 11,
              fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.12em',
              textDecoration: 'none', textTransform: 'uppercase',
            }}>
              {chip.label}
            </Link>
          ))}
        </div>

        {/* 4. Two-column block: My Docs / My Tasks */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, width: '100%', marginBottom: 48 }}>

          {/* My Docs */}
          <div style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 10, padding: 24 }}>
            <h3 style={{ fontSize: 11, letterSpacing: '0.14em', color: '#888', marginBottom: 16, textTransform: 'uppercase' }}>My Docs</h3>
            {docs.length === 0 ? (
              <p style={{ fontSize: 12, color: '#444', lineHeight: 1.7 }}>
                No saved docs yet. Ask &ldquo;save daily pace report&rdquo; in the chat — it lands here.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {docs.map((doc) => (
                  <li key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1a1a1a' }}>
                    <span style={{ fontSize: 13, color: '#ccc' }}>{doc.title}</span>
                    <button
                      onClick={() => removeDoc(doc.id)}
                      style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
                    >×</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* My Tasks */}
          <div style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 10, padding: 24 }}>
            <h3 style={{ fontSize: 11, letterSpacing: '0.14em', color: '#888', marginBottom: 16, textTransform: 'uppercase' }}>My Tasks</h3>
            {tasks.length === 0 && (
              <p style={{ fontSize: 12, color: '#444', lineHeight: 1.7, marginBottom: 16 }}>
                No tasks yet. Add reminders here — auto-tasks (e.g. &ldquo;PR #N awaiting review&rdquo;) also drop in.
              </p>
            )}
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px' }}>
              {tasks.map((task) => (
                <li key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #1a1a1a' }}>
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => toggleTask(task.id)}
                    style={{ accentColor: '#C9A84C', cursor: 'pointer' }}
                  />
                  <span style={{ flex: 1, fontSize: 13, color: task.done ? '#444' : '#ccc', textDecoration: task.done ? 'line-through' : 'none' }}>
                    {task.text}
                  </span>
                  <button
                    onClick={() => removeTask(task.id)}
                    style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
                  >×</button>
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addTask(); }}
                placeholder="Add a task…"
                style={{
                  flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a',
                  borderRadius: 5, padding: '6px 10px', color: '#fff', fontSize: 12,
                  fontFamily: 'inherit', outline: 'none',
                }}
              />
              <button
                onClick={addTask}
                style={{
                  background: '#C9A84C', border: 'none', color: '#000',
                  borderRadius: 5, padding: '6px 14px', cursor: 'pointer',
                  fontSize: 14, fontWeight: 700,
                }}
              >+</button>
            </div>
          </div>
        </div>

        {/* 6. Needs-your-attention placeholder */}
        <div style={{ width: '100%', background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 10, padding: 24 }}>
          <h3 style={{ fontSize: 11, letterSpacing: '0.14em', color: '#888', marginBottom: 16, textTransform: 'uppercase' }}>Needs Your Attention</h3>
          <p style={{ fontSize: 12, color: '#444' }}>No open items — all clear.</p>
        </div>

      </div>
    </main>
  );
}
