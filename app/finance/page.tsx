'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const DEPT_CHIPS = [
  { label: 'Revenue', href: '/revenue' },
  { label: 'Sales', href: '/sales' },
  { label: 'Marketing', href: '/marketing' },
  { label: 'Operations', href: '/operations' },
  { label: 'Guest', href: '/guest' },
  { label: 'Finance', href: '/finance' },
  { label: 'IT', href: '/it' },
];

const FINANCE_CHIPS = [
  { label: 'P&L', href: '/finance/pl' },
  { label: 'USALI', href: '/finance/usali' },
  { label: 'Ledger', href: '/finance/ledger' },
  { label: 'Budget', href: '/finance/budget' },
  { label: 'Payroll', href: '/finance/payroll' },
  { label: 'Reports', href: '/finance/reports' },
];

const STUB_ATTENTION = [
  { id: 1, text: 'Month-end P&L not yet reconciled', severity: 'high' },
  { id: 2, text: 'Payroll upload pending approval', severity: 'medium' },
  { id: 3, text: 'USALI report due in 3 days', severity: 'medium' },
];

const DOC_KEY = 'nk.entry.docs.finance.v1';
const TASK_KEY = 'nk.entry.tasks.finance.v1';

function useLocalList(key: string, initial: string[]) {
  const [items, setItems] = useState<string[]>(initial);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) setItems(JSON.parse(stored) as string[]);
    } catch {
      // ignore parse errors
    }
  }, [key]);

  function add(val: string) {
    const next = [val, ...items].slice(0, 10);
    setItems(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
  }

  function remove(idx: number) {
    const next = items.filter((_, i) => i !== idx);
    setItems(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
  }

  return { items, add, remove };
}

export default function FinancePage() {
  const [chatInput, setChatInput] = useState('');
  const [deptOpen, setDeptOpen] = useState(false);
  const [newDoc, setNewDoc] = useState('');
  const [newTask, setNewTask] = useState('');

  const docs = useLocalList(DOC_KEY, ['USALI Template v3', 'Budget FY2025']);
  const tasks = useLocalList(TASK_KEY, ['Reconcile April P&L', 'Submit payroll by Friday']);

  function handleChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const q = encodeURIComponent(chatInput.trim());
    window.location.href = `/cockpit?role=finance&q=${q}`;
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: '#000',
      color: '#fff',
      fontFamily: 'var(--font-sans, system-ui, sans-serif)',
      padding: '48px 32px 80px',
      maxWidth: 1100,
      margin: '0 auto',
    }}>

      {/* Greeting */}
      <h1 style={{
        fontFamily: 'Fraunces, Georgia, serif',
        fontStyle: 'italic',
        fontSize: 'clamp(1.6rem, 3vw, 2.4rem)',
        fontWeight: 300,
        color: '#fff',
        marginBottom: 32,
      }}>
        Good morning, Boss (Paul Bauer).
      </h1>

      {/* Chat box */}
      <form onSubmit={handleChat} style={{ marginBottom: 36, display: 'flex', gap: 10 }}>
        <input
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          placeholder="Ask anything about Finance…"
          style={{
            flex: 1,
            background: '#111',
            border: '1px solid #333',
            borderRadius: 8,
            padding: '12px 16px',
            color: '#fff',
            fontSize: 15,
            outline: 'none',
          }}
        />
        <button type="submit" style={{
          background: '#fff',
          color: '#000',
          border: 'none',
          borderRadius: 8,
          padding: '12px 24px',
          fontWeight: 600,
          cursor: 'pointer',
          fontSize: 14,
        }}>Ask</button>
      </form>

      {/* Finance quick chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 36 }}>
        {FINANCE_CHIPS.map(c => (
          <Link key={c.href} href={c.href} style={{
            background: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: 20,
            padding: '6px 16px',
            color: '#ccc',
            fontSize: 13,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            transition: 'border-color 0.15s',
          }}>
            {c.label}
          </Link>
        ))}
      </div>

      {/* My Docs / My Tasks */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 40 }}>
        {/* My Docs */}
        <div style={{ background: '#0d0d0d', border: '1px solid #222', borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>My Docs</h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {docs.items.map((d, i) => (
              <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1a1a1a', fontSize: 14, color: '#ddd' }}>
                <span>{d}</span>
                <button onClick={() => docs.remove(i)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input
              value={newDoc}
              onChange={e => setNewDoc(e.target.value)}
              placeholder="Add doc…"
              onKeyDown={e => { if (e.key === 'Enter' && newDoc.trim()) { docs.add(newDoc.trim()); setNewDoc(''); } }}
              style={{ flex: 1, background: '#111', border: '1px solid #2a2a2a', borderRadius: 6, padding: '6px 10px', color: '#fff', fontSize: 13 }}
            />
            <button onClick={() => { if (newDoc.trim()) { docs.add(newDoc.trim()); setNewDoc(''); } }} style={{ background: '#222', border: '1px solid #333', borderRadius: 6, color: '#aaa', padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>+</button>
          </div>
        </div>

        {/* My Tasks */}
        <div style={{ background: '#0d0d0d', border: '1px solid #222', borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>My Tasks</h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {tasks.items.map((t, i) => (
              <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1a1a1a', fontSize: 14, color: '#ddd' }}>
                <span>{t}</span>
                <button onClick={() => tasks.remove(i)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              placeholder="Add task…"
              onKeyDown={e => { if (e.key === 'Enter' && newTask.trim()) { tasks.add(newTask.trim()); setNewTask(''); } }}
              style={{ flex: 1, background: '#111', border: '1px solid #2a2a2a', borderRadius: 6, padding: '6px 10px', color: '#fff', fontSize: 13 }}
            />
            <button onClick={() => { if (newTask.trim()) { tasks.add(newTask.trim()); setNewTask(''); } }} style={{ background: '#222', border: '1px solid #333', borderRadius: 6, color: '#aaa', padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>+</button>
          </div>
        </div>
      </div>

      {/* Needs your attention */}
      <div style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Needs your attention</h2>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {STUB_ATTENTION.map(item => (
            <li key={item.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              marginBottom: 8,
              background: '#0d0d0d',
              border: '1px solid #1f1f1f',
              borderRadius: 8,
              fontSize: 14,
              color: '#ddd',
            }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: item.severity === 'high' ? '#ef4444' : '#f59e0b',
                flexShrink: 0,
              }} />
              {item.text}
            </li>
          ))}
        </ul>
      </div>

      {/* Dept dropdown */}
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button
          onClick={() => setDeptOpen(o => !o)}
          style={{
            background: '#111',
            border: '1px solid #333',
            borderRadius: 8,
            color: '#aaa',
            padding: '10px 20px',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Departments ▾
        </button>
        {deptOpen && (
          <ul style={{
            position: 'absolute',
            bottom: '110%',
            left: 0,
            background: '#111',
            border: '1px solid #333',
            borderRadius: 8,
            listStyle: 'none',
            margin: 0,
            padding: '8px 0',
            minWidth: 160,
            zIndex: 50,
          }}>
            {DEPT_CHIPS.map(d => (
              <li key={d.href}>
                <Link
                  href={d.href}
                  onClick={() => setDeptOpen(false)}
                  style={{ display: 'block', padding: '8px 16px', color: d.href === '/finance' ? '#fff' : '#aaa', textDecoration: 'none', fontSize: 14 }}
                >
                  {d.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
