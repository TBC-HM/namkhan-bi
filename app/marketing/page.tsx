'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DocItem {
  id: string;
  title: string;
  href: string;
}

interface TaskItem {
  id: string;
  label: string;
  done: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DOCS_KEY = 'nk.entry.docs.marketing.v1';
const TASKS_KEY = 'nk.entry.tasks.marketing.v1';

const DEFAULT_DOCS: DocItem[] = [
  { id: 'd1', title: 'Brand Guidelines', href: '/marketing/brand' },
  { id: 'd2', title: 'Content Library', href: '/marketing/content' },
  { id: 'd3', title: 'Campaign Tracker', href: '/marketing/campaigns' },
];

const DEFAULT_TASKS: TaskItem[] = [
  { id: 't1', label: 'Review Q2 campaign assets', done: false },
  { id: 't2', label: 'Update Instagram content calendar', done: false },
  { id: 't3', label: 'Approve new hero image for SLH', done: false },
];

const QUICK_CHIPS = [
  { label: 'Campaigns', href: '/marketing/campaigns' },
  { label: 'Content', href: '/marketing/content' },
  { label: 'Assets', href: '/marketing/assets' },
  { label: 'Analytics', href: '/marketing/analytics' },
  { label: 'Social', href: '/marketing/social' },
  { label: 'Brand', href: '/marketing/brand' },
];

const DEPT_ITEMS = [
  { label: 'Campaigns', href: '/marketing/campaigns' },
  { label: 'Content Library', href: '/marketing/content' },
  { label: 'Asset DAM', href: '/marketing/assets' },
  { label: 'Analytics', href: '/marketing/analytics' },
  { label: 'Social Media', href: '/marketing/social' },
  { label: 'Brand Hub', href: '/marketing/brand' },
];

const ATTENTION_ITEMS = [
  { id: 'a1', label: 'SLH asset submission deadline — 3 days remaining', href: '/marketing/assets' },
  { id: 'a2', label: 'Instagram post scheduled but image missing', href: '/marketing/social' },
  { id: 'a3', label: 'Campaign performance report overdue', href: '/marketing/analytics' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getHour(): number {
  return new Date().getHours();
}

function greeting(): string {
  const h = getHour();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DeptDropdown({ dept, items }: { dept: string; items: { label: string; href: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.25)',
          color: '#fff',
          padding: '6px 16px',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 14,
          letterSpacing: '0.04em',
        }}
      >
        {dept} ▾
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '110%',
            left: 0,
            background: '#111',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8,
            padding: '6px 0',
            zIndex: 100,
            minWidth: 180,
          }}
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              style={{
                display: 'block',
                padding: '8px 18px',
                color: '#e2e8f0',
                textDecoration: 'none',
                fontSize: 14,
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.07)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = 'transparent')}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MarketingEntryPage() {
  const [chatInput, setChatInput] = useState('');
  const [docs, setDocs] = useState<DocItem[]>(DEFAULT_DOCS);
  const [tasks, setTasks] = useState<TaskItem[]>(DEFAULT_TASKS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDocs(loadFromStorage<DocItem[]>(DOCS_KEY, DEFAULT_DOCS));
    setTasks(loadFromStorage<TaskItem[]>(TASKS_KEY, DEFAULT_TASKS));
    setMounted(true);
  }, []);

  function toggleTask(id: string) {
    setTasks((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
      localStorage.setItem(TASKS_KEY, JSON.stringify(next));
      return next;
    });
  }

  function handleChatSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setChatInput('');
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#000',
        color: '#fff',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '48px 40px 80px',
        boxSizing: 'border-box',
      }}
    >
      {/* ── Greeting ── */}
      <p
        style={{
          fontFamily: '"Fraunces", Georgia, serif',
          fontStyle: 'italic',
          fontSize: 28,
          fontWeight: 300,
          marginBottom: 32,
          color: '#f8f4ee',
        }}
      >
        {greeting()}, Boss (Paul Bauer).
      </p>

      {/* ── Chat box ── */}
      <form onSubmit={handleChatSubmit} style={{ marginBottom: 32 }}>
        <div
          style={{
            display: 'flex',
            gap: 10,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            padding: '10px 14px',
            maxWidth: 680,
          }}
        >
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask anything about marketing…"
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
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              padding: '6px 14px',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Ask
          </button>
        </div>
      </form>

      {/* ── Quick chips ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 40 }}>
        {QUICK_CHIPS.map((chip) => (
          <Link
            key={chip.href}
            href={chip.href}
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: 20,
              color: '#e2e8f0',
              padding: '5px 16px',
              fontSize: 13,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {chip.label}
          </Link>
        ))}
      </div>

      {/* ── Two-column: My Docs | My Tasks ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 28,
          marginBottom: 40,
          maxWidth: 860,
        }}
      >
        {/* My Docs */}
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            padding: '20px 22px',
          }}
        >
          <h2 style={{ fontSize: 13, letterSpacing: '0.08em', color: '#94a3b8', marginBottom: 14, textTransform: 'uppercase' }}>
            My Docs
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {docs.map((doc) => (
              <li key={doc.id} style={{ marginBottom: 10 }}>
                <Link
                  href={doc.href}
                  style={{ color: '#e2e8f0', textDecoration: 'none', fontSize: 14 }}
                >
                  📄 {doc.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* My Tasks */}
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            padding: '20px 22px',
          }}
        >
          <h2 style={{ fontSize: 13, letterSpacing: '0.08em', color: '#94a3b8', marginBottom: 14, textTransform: 'uppercase' }}>
            My Tasks
          </h2>
          {mounted && (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {tasks.map((task) => (
                <li
                  key={task.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, cursor: 'pointer' }}
                  onClick={() => toggleTask(task.id)}
                >
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      border: '1px solid rgba(255,255,255,0.3)',
                      background: task.done ? 'rgba(255,255,255,0.3)' : 'transparent',
                      flexShrink: 0,
                      display: 'inline-block',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 14,
                      color: task.done ? '#64748b' : '#e2e8f0',
                      textDecoration: task.done ? 'line-through' : 'none',
                    }}
                  >
                    {task.label}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Department dropdown ── */}
      <div style={{ marginBottom: 40 }}>
        <DeptDropdown dept="Marketing" items={DEPT_ITEMS} />
      </div>

      {/* ── Needs-your-attention ── */}
      <div style={{ maxWidth: 680 }}>
        <h2
          style={{
            fontSize: 13,
            letterSpacing: '0.08em',
            color: '#94a3b8',
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          Needs Your Attention
        </h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ATTENTION_ITEMS.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'rgba(255,200,50,0.06)',
                  border: '1px solid rgba(255,200,50,0.18)',
                  borderRadius: 8,
                  padding: '10px 16px',
                  color: '#fcd34d',
                  textDecoration: 'none',
                  fontSize: 14,
                }}
              >
                <span>⚠</span>
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
