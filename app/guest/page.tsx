'use client';

import { useEffect, useState } from 'react';

/* ─── constants ─── */
const DEPT_CHIPS = [
  { label: 'Revenue',    href: '/revenue' },
  { label: 'Sales',      href: '/sales' },
  { label: 'Marketing',  href: '/marketing' },
  { label: 'Operations', href: '/operations' },
  { label: 'Guest',      href: '/guest' },
  { label: 'Finance',    href: '/finance' },
  { label: 'IT',         href: '/it' },
];

const STUB_ATTENTION = [
  { id: 1, text: 'Late check-out request pending — Villa 3' },
  { id: 2, text: 'Guest complaint: pool noise after 22:00' },
  { id: 3, text: 'Welcome amenity not delivered — Bungalow 7' },
];

const DOC_KEY  = 'nk.entry.docs.guest.v1';
const TASK_KEY = 'nk.entry.tasks.guest.v1';

type ListItem = { id: number; text: string; done: boolean };

function useLocalList(key: string, stubs: string[]): [ListItem[], (id: number) => void, (text: string) => void] {
  const [items, setItems] = useState<ListItem[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem(key);
    if (raw) {
      try { setItems(JSON.parse(raw) as ListItem[]); return; } catch { /* fall through */ }
    }
    const defaults = stubs.map((text, i) => ({ id: i + 1, text, done: false }));
    setItems(defaults);
    localStorage.setItem(key, JSON.stringify(defaults));
  }, [key, stubs]);

  function toggle(id: number) {
    setItems(prev => {
      const next = prev.map(it => it.id === id ? { ...it, done: !it.done } : it);
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }

  function add(text: string) {
    setItems(prev => {
      const next = [...prev, { id: Date.now(), text, done: false }];
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }

  return [items, toggle, add];
}

/* ─── page ─── */
export default function GuestPage() {
  const [chat, setChat]   = useState('');
  const [deptOpen, setDeptOpen] = useState(false);
  const [newDoc,  setNewDoc]  = useState('');
  const [newTask, setNewTask] = useState('');

  const docStubs  = ['Guest satisfaction report Q1', 'VIP arrivals brief', 'Complaint resolution log'];
  const taskStubs = ['Review NPS scores', 'Follow up on pool complaint', 'Prepare welcome packs for VIPs'];

  const [docs,  toggleDoc,  addDoc]  = useLocalList(DOC_KEY,  docStubs);
  const [tasks, toggleTask, addTask] = useLocalList(TASK_KEY, taskStubs);

  function handleChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chat.trim()) return;
    window.location.href = `/chat?role=guest&q=${encodeURIComponent(chat)}`;
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <main style={{
      minHeight: '100vh',
      background: '#000',
      color: '#fff',
      fontFamily: 'Inter, sans-serif',
      padding: '40px 48px',
      boxSizing: 'border-box',
    }}>

      {/* ── Greeting ── */}
      <p style={{
        fontFamily: "'Fraunces', serif",
        fontStyle: 'italic',
        fontSize: 28,
        fontWeight: 300,
        margin: '0 0 32px',
        color: '#f5f0e8',
      }}>
        {greeting}, Boss (Paul Bauer).
      </p>

      {/* ── Chat box ── */}
      <form onSubmit={handleChat} style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={chat}
            onChange={e => setChat(e.target.value)}
            placeholder="Ask anything about Guests…"
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
          <button type="submit" style={{
            background: '#fff',
            color: '#000',
            border: 'none',
            borderRadius: 8,
            padding: '12px 24px',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 15,
          }}>Ask</button>
        </div>
      </form>

      {/* ── Chip row ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 36 }}>
        {DEPT_CHIPS.map(chip => (
          <a
            key={chip.href}
            href={chip.href}
            style={{
              background: chip.href === '/guest' ? '#fff' : '#1a1a1a',
              color:      chip.href === '/guest' ? '#000' : '#ccc',
              border: '1px solid #333',
              borderRadius: 20,
              padding: '6px 18px',
              fontSize: 13,
              fontWeight: 500,
              textDecoration: 'none',
              transition: 'background 0.15s',
            }}
          >
            {chip.label}
          </a>
        ))}
      </div>

      {/* ── Two-column: Docs + Tasks ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 36 }}>

        {/* My Docs */}
        <div style={{ background: '#0d0d0d', border: '1px solid #222', borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.08em', color: '#888', textTransform: 'uppercase', margin: '0 0 14px' }}>
            My Docs
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px' }}>
            {docs.map(d => (
              <li key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #1a1a1a' }}>
                <input
                  type="checkbox"
                  checked={d.done}
                  onChange={() => toggleDoc(d.id)}
                  style={{ accentColor: '#fff', cursor: 'pointer' }}
                />
                <span style={{ fontSize: 14, color: d.done ? '#555' : '#ddd', textDecoration: d.done ? 'line-through' : 'none' }}>
                  {d.text}
                </span>
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={newDoc}
              onChange={e => setNewDoc(e.target.value)}
              placeholder="Add doc…"
              style={{ flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, color: '#fff', padding: '6px 10px', fontSize: 13 }}
              onKeyDown={e => { if (e.key === 'Enter' && newDoc.trim()) { addDoc(newDoc.trim()); setNewDoc(''); } }}
            />
            <button
              onClick={() => { if (newDoc.trim()) { addDoc(newDoc.trim()); setNewDoc(''); } }}
              style={{ background: '#222', color: '#fff', border: '1px solid #333', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}
            >+</button>
          </div>
        </div>

        {/* My Tasks */}
        <div style={{ background: '#0d0d0d', border: '1px solid #222', borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.08em', color: '#888', textTransform: 'uppercase', margin: '0 0 14px' }}>
            My Tasks
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px' }}>
            {tasks.map(t => (
              <li key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #1a1a1a' }}>
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => toggleTask(t.id)}
                  style={{ accentColor: '#fff', cursor: 'pointer' }}
                />
                <span style={{ fontSize: 14, color: t.done ? '#555' : '#ddd', textDecoration: t.done ? 'line-through' : 'none' }}>
                  {t.text}
                </span>
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              placeholder="Add task…"
              style={{ flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, color: '#fff', padding: '6px 10px', fontSize: 13 }}
              onKeyDown={e => { if (e.key === 'Enter' && newTask.trim()) { addTask(newTask.trim()); setNewTask(''); } }}
            />
            <button
              onClick={() => { if (newTask.trim()) { addTask(newTask.trim()); setNewTask(''); } }}
              style={{ background: '#222', color: '#fff', border: '1px solid #333', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}
            >+</button>
          </div>
        </div>
      </div>

      {/* ── Needs your attention ── */}
      <div style={{ background: '#0d0d0d', border: '1px solid #2a1a1a', borderRadius: 12, padding: 20, marginBottom: 32 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.08em', color: '#c0392b', textTransform: 'uppercase', margin: '0 0 14px' }}>
          ⚠ Needs Your Attention
        </h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {STUB_ATTENTION.map(item => (
            <li key={item.id} style={{
              padding: '10px 0',
              borderBottom: '1px solid #1a1a1a',
              fontSize: 14,
              color: '#e0d0d0',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <span style={{ color: '#c0392b', fontSize: 16 }}>●</span>
              {item.text}
            </li>
          ))}
        </ul>
      </div>

      {/* ── Department dropdown ── */}
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button
          onClick={() => setDeptOpen(o => !o)}
          style={{
            background: '#111',
            color: '#fff',
            border: '1px solid #333',
            borderRadius: 8,
            padding: '10px 20px',
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
          <ul style={{
            position: 'absolute',
            bottom: '110%',
            left: 0,
            background: '#111',
            border: '1px solid #333',
            borderRadius: 8,
            listStyle: 'none',
            padding: '6px 0',
            margin: 0,
            minWidth: 160,
            zIndex: 100,
          }}>
            {DEPT_CHIPS.map(chip => (
              <li key={chip.href}>
                <a
                  href={chip.href}
                  style={{
                    display: 'block',
                    padding: '8px 18px',
                    color: '#ccc',
                    textDecoration: 'none',
                    fontSize: 14,
                  }}
                >
                  {chip.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

    </main>
  );
}
