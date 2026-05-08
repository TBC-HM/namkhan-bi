'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StoredItem {
  id: string;
  text: string;
  done: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DOCS_KEY = 'nk.entry.docs.guest.v1';
const TASKS_KEY = 'nk.entry.tasks.guest.v1';

const DEPT_CHIPS: { label: string; href: string }[] = [
  { label: 'Pulse', href: '/guest/pulse' },
  { label: 'Reviews', href: '/guest/reviews' },
  { label: 'Feedback', href: '/guest/feedback' },
  { label: 'Loyalty', href: '/guest/loyalty' },
  { label: 'Profiles', href: '/guest/profiles' },
];

const ATTENTION_STUBS = [
  { id: '1', label: 'Review response pending', meta: 'TripAdvisor · 2d ago', color: '#e5a000' },
  { id: '2', label: 'Guest complaint unresolved', meta: 'Room 12 · 1d ago', color: '#e55353' },
  { id: '3', label: 'NPS score dip this week', meta: '7-day avg 7.2 → 6.8', color: '#e5a000' },
];

// ─── Inline editable list ─────────────────────────────────────────────────────

function EditableList({ storageKey, placeholder }: { storageKey: string; placeholder: string }) {
  const [items, setItems] = useState<StoredItem[]>([]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setItems(JSON.parse(raw) as StoredItem[]);
    } catch {
      // ignore
    }
  }, [storageKey]);

  function save(next: StoredItem[]) {
    setItems(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  }

  function add() {
    const t = draft.trim();
    if (!t) return;
    save([...items, { id: Date.now().toString(), text: t, done: false }]);
    setDraft('');
  }

  function toggle(id: string) {
    save(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  }

  function remove(id: string) {
    save(items.filter((i) => i.id !== id));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item) => (
        <div
          key={item.id}
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#d1d5db' }}
        >
          <input
            type="checkbox"
            checked={item.done}
            onChange={() => toggle(item.id)}
            style={{ accentColor: '#fbbf24', cursor: 'pointer' }}
          />
          <span style={{ flex: 1, textDecoration: item.done ? 'line-through' : 'none', opacity: item.done ? 0.5 : 1 }}>
            {item.text}
          </span>
          <button
            onClick={() => remove(item.id)}
            style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 11, padding: 0 }}
          >
            ×
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          placeholder={placeholder}
          style={{
            flex: 1,
            background: '#1a1a1a',
            border: '1px solid #2d2d2d',
            borderRadius: 6,
            color: '#d1d5db',
            fontSize: 12,
            padding: '4px 8px',
            outline: 'none',
          }}
        />
        <button
          onClick={add}
          style={{
            background: '#1f2937',
            border: '1px solid #374151',
            borderRadius: 6,
            color: '#9ca3af',
            cursor: 'pointer',
            fontSize: 12,
            padding: '4px 10px',
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}

// ─── Ask-anything chat box ────────────────────────────────────────────────────

function ChatBox() {
  const [query, setQuery] = useState('');

  function submit() {
    const q = query.trim();
    if (!q) return;
    const url = `/cockpit/chat?role=guest_manager&q=${encodeURIComponent(q)}`;
    window.location.href = url;
  }

  return (
    <div
      style={{
        background: '#111',
        border: '1px solid #2d2d2d',
        borderRadius: 10,
        padding: '12px 16px',
        display: 'flex',
        gap: 10,
        alignItems: 'center',
      }}
    >
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        placeholder="Ask anything about guests, reviews, satisfaction…"
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          color: '#e5e7eb',
          fontSize: 14,
          outline: 'none',
          fontFamily: 'inherit',
        }}
      />
      <button
        onClick={submit}
        style={{
          background: '#fbbf24',
          border: 'none',
          borderRadius: 6,
          color: '#000',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: 13,
          padding: '6px 14px',
        }}
      >
        Ask
      </button>
    </div>
  );
}

// ─── Dept dropdown ────────────────────────────────────────────────────────────

function DeptDropdown() {
  const [open, setOpen] = useState(false);

  const ALL_DEPTS = [
    { label: 'Revenue', href: '/revenue' },
    { label: 'Sales', href: '/sales' },
    { label: 'Marketing', href: '/marketing' },
    { label: 'Operations', href: '/operations' },
    { label: 'Guest', href: '/guest' },
    { label: 'Finance', href: '/finance' },
    { label: 'IT', href: '/it' },
  ];

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: '#1a1a1a',
          border: '1px solid #2d2d2d',
          borderRadius: 8,
          color: '#9ca3af',
          cursor: 'pointer',
          fontSize: 13,
          padding: '6px 14px',
        }}
      >
        Departments ▾
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '110%',
            left: 0,
            background: '#141414',
            border: '1px solid #2d2d2d',
            borderRadius: 8,
            minWidth: 160,
            zIndex: 50,
            overflow: 'hidden',
          }}
        >
          {ALL_DEPTS.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              style={{
                display: 'block',
                padding: '8px 16px',
                color: '#d1d5db',
                textDecoration: 'none',
                fontSize: 13,
              }}
              onClick={() => setOpen(false)}
            >
              {d.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GuestEntryPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#e5e7eb',
        fontFamily: "'Inter', sans-serif",
        padding: '40px 48px',
        boxSizing: 'border-box',
      }}
    >
      {/* Greeting */}
      <h1
        style={{
          fontFamily: "'Fraunces', serif",
          fontStyle: 'italic',
          fontWeight: 300,
          fontSize: 28,
          color: '#f9fafb',
          marginBottom: 28,
          letterSpacing: '-0.02em',
        }}
      >
        Good morning, Boss (Paul Bauer).
      </h1>

      {/* Chat box */}
      <div style={{ maxWidth: 720, marginBottom: 32 }}>
        <ChatBox />
      </div>

      {/* Quick-page chips */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 36 }}>
        {DEPT_CHIPS.map((chip) => (
          <Link
            key={chip.href}
            href={chip.href}
            style={{
              background: '#1a1a1a',
              border: '1px solid #2d2d2d',
              borderRadius: 20,
              color: '#d1d5db',
              fontSize: 13,
              fontWeight: 500,
              padding: '6px 16px',
              textDecoration: 'none',
              transition: 'border-color 0.15s',
            }}
          >
            {chip.label}
          </Link>
        ))}
      </div>

      {/* My Docs + My Tasks */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 24,
          marginBottom: 36,
          maxWidth: 900,
        }}
      >
        {/* My Docs */}
        <div
          style={{
            background: '#111',
            border: '1px solid #1f1f1f',
            borderRadius: 10,
            padding: 20,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
            My Docs
          </div>
          <EditableList storageKey={DOCS_KEY} placeholder="Add a doc link or note…" />
        </div>

        {/* My Tasks */}
        <div
          style={{
            background: '#111',
            border: '1px solid #1f1f1f',
            borderRadius: 10,
            padding: 20,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
            My Tasks
          </div>
          <EditableList storageKey={TASKS_KEY} placeholder="Add a task…" />
        </div>
      </div>

      {/* Needs your attention */}
      <div style={{ maxWidth: 900, marginBottom: 36 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#6b7280',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          Needs your attention
        </div>
        <div
          style={{
            background: '#111',
            border: '1px solid #1f1f1f',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          {ATTENTION_STUBS.map((item, idx) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '13px 20px',
                borderBottom: idx < ATTENTION_STUBS.length - 1 ? '1px solid #1a1a1a' : 'none',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: item.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1, fontSize: 13, color: '#e5e7eb' }}>{item.label}</span>
              <span style={{ fontSize: 11, color: '#4b5563' }}>{item.meta}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Dept dropdown */}
      <DeptDropdown />
    </main>
  );
}
