'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const DEPT_CHIPS = [
  { label: 'Revenue',    href: '/revenue-v2' },
  { label: 'Sales',      href: '/sales' },
  { label: 'Marketing',  href: '/marketing' },
  { label: 'Operations', href: '/operations' },
  { label: 'Guest',      href: '/guest' },
  { label: 'Finance',    href: '/finance' },
  { label: 'IT',         href: '/it' },
];

const STUB_ALERTS = [
  { id: 1, message: 'Occupancy below target for next 3 nights — Revenue review needed.' },
  { id: 2, message: 'Guest complaint escalation pending Operations sign-off.' },
  { id: 3, message: 'Monthly P&L variance >10% flagged by Finance.' },
  { id: 4, message: 'Marketing campaign approval overdue (2 days).' },
  { id: 5, message: 'IT: SSL certificate renewal due in 7 days.' },
];

const DOCS_KEY  = 'nk.entry.docs.home.v1';
const TASKS_KEY = 'nk.entry.tasks.home.v1';

interface NoteItem { id: number; text: string }

function useLocalList(key: string, seed: string[]): [NoteItem[], (t: string) => void, (id: number) => void] {
  const [items, setItems] = useState<NoteItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        setItems(JSON.parse(stored) as NoteItem[]);
      } else {
        const seeded = seed.map((text, i) => ({ id: i + 1, text }));
        setItems(seeded);
        localStorage.setItem(key, JSON.stringify(seeded));
      }
    } catch {
      setItems([]);
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = (text: string) => {
    setItems(prev => {
      const next = [...prev, { id: Date.now(), text }];
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  };
  const remove = (id: number) => {
    setItems(prev => {
      const next = prev.filter(i => i.id !== id);
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  };
  return [items, add, remove];
}

export default function HomePage() {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const [chatInput, setChatInput]   = useState('');
  const [deptOpen, setDeptOpen]     = useState(false);
  const [docInput, setDocInput]     = useState('');
  const [taskInput, setTaskInput]   = useState('');

  const [docs,  addDoc,  removeDoc]  = useLocalList(DOCS_KEY,  ['Design doc v3', 'Revenue roadmap Q3']);
  const [tasks, addTask, removeTask] = useLocalList(TASKS_KEY, ['Review nightly KPI report', 'Sign off Marketing brief']);

  const handleChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const q = encodeURIComponent(chatInput.trim());
    window.location.href = `/architect/chat?q=${q}`;
  };

  return (
    <main style={{
      minHeight: '100vh',
      background: '#000',
      color: '#fff',
      fontFamily: "'Inter', sans-serif",
      padding: '48px 32px 80px',
      maxWidth: 1100,
      margin: '0 auto',
    }}>

      {/* Greeting */}
      <p style={{
        fontFamily: "'Fraunces', serif",
        fontStyle: 'italic',
        fontSize: 28,
        fontWeight: 300,
        marginBottom: 32,
        color: '#e8e0d0',
      }}>
        {greeting}, Boss (Paul Bauer).
      </p>

      {/* Ask-anything chat */}
      <form onSubmit={handleChat} style={{ marginBottom: 32, display: 'flex', gap: 8 }}>
        <input
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          placeholder="Ask anything across the property…"
          style={{
            flex: 1,
            background: '#111',
            border: '1px solid #333',
            borderRadius: 8,
            color: '#fff',
            fontSize: 15,
            padding: '12px 16px',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          style={{
            background: '#c9a96e',
            color: '#000',
            border: 'none',
            borderRadius: 8,
            padding: '12px 24px',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Ask →
        </button>
      </form>

      {/* Quick-page chip row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 40 }}>
        {DEPT_CHIPS.map(chip => (
          <Link key={chip.label} href={chip.href} style={{
            background: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: 20,
            padding: '7px 18px',
            color: '#c9a96e',
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
            letterSpacing: '0.03em',
            transition: 'background 0.15s',
          }}>
            {chip.label}
          </Link>
        ))}
      </div>

      {/* My Docs + My Tasks two-column */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 40 }}>
        {/* My Docs */}
        <div style={{ background: '#0d0d0d', border: '1px solid #222', borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.08em', color: '#888', marginBottom: 14, textTransform: 'uppercase' }}>My Docs</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {docs.map(d => (
              <li key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1a1a1a', fontSize: 14 }}>
                <span>{d.text}</span>
                <button onClick={() => removeDoc(d.id)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16 }}>×</button>
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <input
              value={docInput}
              onChange={e => setDocInput(e.target.value)}
              placeholder="Add doc…"
              onKeyDown={e => { if (e.key === 'Enter' && docInput.trim()) { addDoc(docInput.trim()); setDocInput(''); } }}
              style={{ flex: 1, background: '#111', border: '1px solid #2a2a2a', borderRadius: 6, color: '#fff', fontSize: 13, padding: '7px 10px' }}
            />
            <button onClick={() => { if (docInput.trim()) { addDoc(docInput.trim()); setDocInput(''); } }}
              style={{ background: '#1e1e1e', border: '1px solid #333', borderRadius: 6, color: '#c9a96e', padding: '7px 12px', cursor: 'pointer', fontSize: 13 }}>+</button>
          </div>
        </div>

        {/* My Tasks */}
        <div style={{ background: '#0d0d0d', border: '1px solid #222', borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.08em', color: '#888', marginBottom: 14, textTransform: 'uppercase' }}>My Tasks</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {tasks.map(t => (
              <li key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1a1a1a', fontSize: 14 }}>
                <span>{t.text}</span>
                <button onClick={() => removeTask(t.id)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16 }}>×</button>
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <input
              value={taskInput}
              onChange={e => setTaskInput(e.target.value)}
              placeholder="Add task…"
              onKeyDown={e => { if (e.key === 'Enter' && taskInput.trim()) { addTask(taskInput.trim()); setTaskInput(''); } }}
              style={{ flex: 1, background: '#111', border: '1px solid #2a2a2a', borderRadius: 6, color: '#fff', fontSize: 13, padding: '7px 10px' }}
            />
            <button onClick={() => { if (taskInput.trim()) { addTask(taskInput.trim()); setTaskInput(''); } }}
              style={{ background: '#1e1e1e', border: '1px solid #333', borderRadius: 6, color: '#c9a96e', padding: '7px 12px', cursor: 'pointer', fontSize: 13 }}>+</button>
          </div>
        </div>
      </div>

      {/* Cross-dept Needs Your Attention */}
      <div style={{ background: '#0d0d0d', border: '1px solid #222', borderRadius: 12, padding: 20, marginBottom: 32 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.08em', color: '#888', marginBottom: 14, textTransform: 'uppercase' }}>
          Needs Your Attention
        </h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {STUB_ALERTS.map((alert, i) => (
            <li key={alert.id} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '10px 0',
              borderBottom: i < STUB_ALERTS.length - 1 ? '1px solid #1a1a1a' : 'none',
              fontSize: 14,
            }}>
              <span style={{
                minWidth: 8, height: 8, borderRadius: '50%',
                background: '#c9a96e', marginTop: 5, display: 'block',
              }} />
              <span style={{ color: '#ccc' }}>{alert.message}</span>
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
            padding: '10px 20px',
            fontSize: 14,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Departments ▾
        </button>
        {deptOpen && (
          <div style={{
            position: 'absolute',
            bottom: '110%',
            left: 0,
            background: '#111',
            border: '1px solid #333',
            borderRadius: 8,
            minWidth: 180,
            zIndex: 50,
            overflow: 'hidden',
          }}>
            {DEPT_CHIPS.map(chip => (
              <Link
                key={chip.label}
                href={chip.href}
                onClick={() => setDeptOpen(false)}
                style={{
                  display: 'block',
                  padding: '10px 16px',
                  color: '#e0d8c8',
                  textDecoration: 'none',
                  fontSize: 14,
                  borderBottom: '1px solid #1a1a1a',
                }}
              >
                {chip.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
