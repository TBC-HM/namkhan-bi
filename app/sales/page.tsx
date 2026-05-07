'use client';

import { useState, useEffect } from 'react';

const SALES_CHIPS = [
  { label: 'Leads', href: '/sales/leads' },
  { label: 'B2B Contracts', href: '/sales/contracts' },
  { label: 'Proposals', href: '/sales/proposals' },
  { label: 'Email Cockpit', href: '/sales/email' },
  { label: 'Pipeline', href: '/sales/pipeline' },
];

const DEPT_LINKS = [
  { label: 'Revenue', href: '/revenue' },
  { label: 'Sales', href: '/sales' },
  { label: 'Marketing', href: '/marketing' },
  { label: 'Operations', href: '/operations' },
  { label: 'Guest', href: '/guest' },
  { label: 'Finance', href: '/finance' },
  { label: 'IT', href: '/it' },
];

const STUB_ATTENTION = [
  { id: 1, text: 'B2B contract renewal due — Lao Airlines (expires in 7 days)' },
  { id: 2, text: '3 new leads uncontacted for >48 hours' },
  { id: 3, text: 'Proposal #NK-2026-041 awaiting PBS signature' },
];

interface NoteItem {
  id: string;
  text: string;
}

const LOCAL_DOCS_KEY = 'nk.entry.docs.sales.v1';
const LOCAL_TASKS_KEY = 'nk.entry.tasks.sales.v1';

function useLocalList(key: string) {
  const [items, setItems] = useState<NoteItem[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setItems(JSON.parse(raw) as NoteItem[]);
    } catch {}
  }, [key]);
  const save = (next: NoteItem[]) => {
    setItems(next);
    localStorage.setItem(key, JSON.stringify(next));
  };
  const add = (text: string) => {
    if (!text.trim()) return;
    save([...items, { id: Date.now().toString(), text: text.trim() }]);
  };
  const remove = (id: string) => save(items.filter(i => i.id !== id));
  return { items, add, remove };
}

function NoteList({ storageKey, placeholder }: { storageKey: string; placeholder: string }) {
  const { items, add, remove } = useLocalList(storageKey);
  const [draft, setDraft] = useState('');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.length === 0 && (
        <p style={{ color: '#555', fontSize: 11, fontFamily: 'var(--mono, JetBrains Mono)', margin: 0 }}>
          — nothing yet —
        </p>
      )}
      {items.map(it => (
        <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111', borderRadius: 4, padding: '6px 10px' }}>
          <span style={{ color: '#ccc', fontSize: 12 }}>{it.text}</span>
          <button onClick={() => remove(it.id)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { add(draft); setDraft(''); } }}
          placeholder={placeholder}
          style={{ flex: 1, background: '#111', border: '1px solid #222', borderRadius: 4, color: '#eee', fontSize: 12, padding: '5px 8px', outline: 'none' }}
        />
        <button
          onClick={() => { add(draft); setDraft(''); }}
          style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, color: '#aaa', cursor: 'pointer', fontSize: 12, padding: '5px 10px' }}
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function SalesPage() {
  const [chatInput, setChatInput] = useState('');
  const [deptOpen, setDeptOpen] = useState(false);

  const handleChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const q = encodeURIComponent(chatInput.trim());
    window.location.href = `/cockpit/chat?role=sales&q=${q}`;
  };

  return (
    <main style={{
      minHeight: '100vh',
      background: '#000',
      color: '#eee',
      fontFamily: 'Inter Tight, sans-serif',
      padding: '48px 32px 80px',
      maxWidth: 1200,
      margin: '0 auto',
    }}>
      {/* Greeting */}
      <h1 style={{
        fontFamily: 'Fraunces, Georgia, serif',
        fontStyle: 'italic',
        fontSize: 30,
        fontWeight: 400,
        letterSpacing: '-0.01em',
        color: '#fff',
        margin: '0 0 32px',
      }}>
        Good morning, Boss (Paul Bauer).
      </h1>

      {/* Chat box */}
      <form onSubmit={handleChat} style={{ display: 'flex', gap: 8, marginBottom: 36 }}>
        <input
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          placeholder="Ask anything about sales…"
          style={{
            flex: 1,
            background: '#0d0d0d',
            border: '1px solid #222',
            borderRadius: 6,
            color: '#eee',
            fontSize: 13,
            padding: '10px 14px',
            outline: 'none',
          }}
        />
        <button type="submit" style={{
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: 6,
          color: '#ccc',
          cursor: 'pointer',
          fontSize: 13,
          padding: '10px 18px',
        }}>
          Ask →
        </button>
      </form>

      {/* Quick-page chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 36 }}>
        {SALES_CHIPS.map(chip => (
          <a
            key={chip.href}
            href={chip.href}
            style={{
              background: '#111',
              border: '1px solid #222',
              borderRadius: 20,
              color: '#ccc',
              fontSize: 12,
              padding: '5px 14px',
              textDecoration: 'none',
              letterSpacing: '0.03em',
            }}
          >
            {chip.label}
          </a>
        ))}
      </div>

      {/* My Docs + My Tasks */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 40 }}>
        <section style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 8, padding: 20 }}>
          <h2 style={{ fontSize: 11, letterSpacing: '0.18em', color: '#555', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace', margin: '0 0 14px' }}>
            MY DOCS
          </h2>
          <NoteList storageKey={LOCAL_DOCS_KEY} placeholder="Add a doc link or note…" />
        </section>
        <section style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 8, padding: 20 }}>
          <h2 style={{ fontSize: 11, letterSpacing: '0.18em', color: '#555', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace', margin: '0 0 14px' }}>
            MY TASKS
          </h2>
          <NoteList storageKey={LOCAL_TASKS_KEY} placeholder="Add a task…" />
        </section>
      </div>

      {/* Needs-your-attention */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 11, letterSpacing: '0.18em', color: '#555', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace', margin: '0 0 14px' }}>
          NEEDS YOUR ATTENTION
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {STUB_ATTENTION.map(item => (
            <div key={item.id} style={{
              background: '#0d0d0d',
              border: '1px solid #1e1e1e',
              borderLeft: '3px solid #444',
              borderRadius: 6,
              padding: '10px 14px',
              fontSize: 13,
              color: '#ccc',
            }}>
              {item.text}
            </div>
          ))}
        </div>
      </section>

      {/* Dept dropdown */}
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button
          onClick={() => setDeptOpen(o => !o)}
          style={{
            background: '#111',
            border: '1px solid #2a2a2a',
            borderRadius: 6,
            color: '#bbb',
            cursor: 'pointer',
            fontSize: 13,
            padding: '8px 16px',
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
            border: '1px solid #222',
            borderRadius: 6,
            minWidth: 160,
            zIndex: 50,
            overflow: 'hidden',
          }}>
            {DEPT_LINKS.map(d => (
              <a
                key={d.href}
                href={d.href}
                style={{
                  display: 'block',
                  color: d.href === '/sales' ? '#fff' : '#aaa',
                  fontSize: 13,
                  padding: '9px 14px',
                  textDecoration: 'none',
                  background: d.href === '/sales' ? '#1a1a1a' : 'transparent',
                }}
              >
                {d.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
