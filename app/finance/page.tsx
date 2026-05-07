'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

/* ─── types ─────────────────────────────────────────── */
interface ListItem { id: string; text: string; done: boolean }

/* ─── constants ──────────────────────────────────────── */
const DEPT_CHIPS = [
  { label: 'Revenue',    href: '/revenue' },
  { label: 'Sales',      href: '/sales' },
  { label: 'Marketing',  href: '/marketing' },
  { label: 'Operations', href: '/operations' },
  { label: 'Guest',      href: '/guest' },
  { label: 'Finance',    href: '/finance' },
  { label: 'IT',         href: '/it' },
];

const FINANCE_CHIPS = [
  { label: 'P&L',          href: '/finance/pl' },
  { label: 'Cash Flow',     href: '/finance/cash-flow' },
  { label: 'Accounts',      href: '/finance/accounts' },
  { label: 'Budget',        href: '/finance/budget' },
  { label: 'Payroll',       href: '/finance/payroll' },
  { label: 'GL Entries',    href: '/finance/gl' },
];

const ATTENTION_STUBS = [
  { id: '1', label: 'Month-end close due in 3 days', dept: 'Finance', severity: 'high' },
  { id: '2', label: 'Unpaid supplier invoices: 4 items pending > 30 days', dept: 'Finance', severity: 'medium' },
  { id: '3', label: 'Payroll run scheduled for tomorrow — review hours', dept: 'Finance', severity: 'medium' },
];

const DOCS_KEY  = 'nk.entry.docs.finance.v1';
const TASKS_KEY = 'nk.entry.tasks.finance.v1';

/* ─── helpers ────────────────────────────────────────── */
function loadList(key: string, defaults: ListItem[]): ListItem[] {
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as ListItem[]) : defaults;
  } catch {
    return defaults;
  }
}

function saveList(key: string, items: ListItem[]): void {
  try { localStorage.setItem(key, JSON.stringify(items)); } catch { /* ignore */ }
}

/* ─── sub-components ─────────────────────────────────── */
function EditableList({
  storageKey,
  defaults,
  placeholder,
}: {
  storageKey: string;
  defaults: ListItem[];
  placeholder: string;
}) {
  const [items, setItems] = useState<ListItem[]>([]);
  const [draft,  setDraft]  = useState('');

  useEffect(() => {
    setItems(loadList(storageKey, defaults));
  }, [storageKey, defaults]);

  function persist(next: ListItem[]) {
    setItems(next);
    saveList(storageKey, next);
  }

  function add() {
    const text = draft.trim();
    if (!text) return;
    persist([...items, { id: Date.now().toString(), text, done: false }]);
    setDraft('');
  }

  function toggle(id: string) {
    persist(items.map(i => i.id === id ? { ...i, done: !i.done } : i));
  }

  function remove(id: string) {
    persist(items.filter(i => i.id !== id));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(item => (
        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={item.done}
            onChange={() => toggle(item.id)}
            style={{ accentColor: '#d4af37', cursor: 'pointer' }}
          />
          <span style={{
            flex: 1,
            fontSize: 13,
            color: item.done ? '#555' : '#e0e0e0',
            textDecoration: item.done ? 'line-through' : 'none',
          }}>
            {item.text}
          </span>
          <button
            onClick={() => remove(item.id)}
            style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
            aria-label="Remove"
          >×</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder={placeholder}
          style={{
            flex: 1, background: '#111', border: '1px solid #333', borderRadius: 6,
            color: '#ccc', fontSize: 13, padding: '6px 10px',
          }}
        />
        <button
          onClick={add}
          style={{
            background: '#d4af37', border: 'none', borderRadius: 6,
            color: '#000', fontWeight: 700, fontSize: 13, padding: '6px 12px', cursor: 'pointer',
          }}
        >+</button>
      </div>
    </div>
  );
}

/* ─── dept dropdown ──────────────────────────────────── */
function DeptDropdown() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: '#111', border: '1px solid #333', borderRadius: 8,
          color: '#ccc', fontSize: 13, padding: '8px 14px', cursor: 'pointer',
        }}
      >
        Departments ▾
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '110%', left: 0, background: '#111',
          border: '1px solid #333', borderRadius: 8, zIndex: 50,
          minWidth: 160, boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
        }}>
          {DEPT_CHIPS.map(d => (
            <Link
              key={d.href}
              href={d.href}
              onClick={() => setOpen(false)}
              style={{
                display: 'block', padding: '10px 16px', color: '#ccc',
                fontSize: 13, textDecoration: 'none',
              }}
            >
              {d.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── page ───────────────────────────────────────────── */
export default function FinanceEntryPage() {
  const [chatDraft, setChatDraft] = useState('');

  function handleChatSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = chatDraft.trim();
    if (!q) return;
    window.location.href = `/cockpit?role=finance&q=${encodeURIComponent(q)}`;
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: '#000',
      color: '#e0e0e0',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '48px 40px 80px',
      maxWidth: 1100,
      margin: '0 auto',
    }}>

      {/* ── greeting ── */}
      <p style={{
        fontFamily: 'Fraunces, Georgia, serif',
        fontStyle: 'italic',
        fontSize: 28,
        color: '#f5f5f5',
        marginBottom: 32,
        fontWeight: 300,
      }}>
        Good morning, Boss (Paul Bauer).
      </p>

      {/* ── chat box ── */}
      <form onSubmit={handleChatSubmit} style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', gap: 10, maxWidth: 680 }}>
          <input
            value={chatDraft}
            onChange={e => setChatDraft(e.target.value)}
            placeholder="Ask anything about Finance…"
            style={{
              flex: 1, background: '#0d0d0d', border: '1px solid #2a2a2a',
              borderRadius: 10, color: '#e0e0e0', fontSize: 15,
              padding: '12px 16px', outline: 'none',
            }}
          />
          <button
            type="submit"
            style={{
              background: '#d4af37', border: 'none', borderRadius: 10,
              color: '#000', fontWeight: 700, fontSize: 14,
              padding: '12px 20px', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Ask →
          </button>
        </div>
      </form>

      {/* ── quick-page chips (Finance sub-pages) ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 32 }}>
        {FINANCE_CHIPS.map(chip => (
          <Link
            key={chip.href}
            href={chip.href}
            style={{
              background: '#111', border: '1px solid #2a2a2a', borderRadius: 20,
              color: '#ccc', fontSize: 13, padding: '7px 16px',
              textDecoration: 'none', transition: 'border-color 0.15s',
            }}
          >
            {chip.label}
          </Link>
        ))}
      </div>

      {/* ── My Docs + My Tasks (two-column) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 24,
        marginBottom: 36,
      }}>
        {/* My Docs */}
        <section style={{
          background: '#0d0d0d', border: '1px solid #1e1e1e',
          borderRadius: 12, padding: 24,
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
            My Docs
          </h2>
          <EditableList
            storageKey={DOCS_KEY}
            defaults={[
              { id: 'd1', text: 'Q1 P&L Report', done: false },
              { id: 'd2', text: 'Annual Budget 2025', done: false },
              { id: 'd3', text: 'Cash Flow Projection', done: false },
            ]}
            placeholder="Add document…"
          />
        </section>

        {/* My Tasks */}
        <section style={{
          background: '#0d0d0d', border: '1px solid #1e1e1e',
          borderRadius: 12, padding: 24,
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
            My Tasks
          </h2>
          <EditableList
            storageKey={TASKS_KEY}
            defaults={[
              { id: 't1', text: 'Review month-end close checklist', done: false },
              { id: 't2', text: 'Approve supplier payment batch', done: false },
              { id: 't3', text: 'Sign off payroll', done: false },
            ]}
            placeholder="Add task…"
          />
        </section>
      </div>

      {/* ── Needs Your Attention ── */}
      <section style={{
        background: '#0d0d0d', border: '1px solid #1e1e1e',
        borderRadius: 12, padding: 24, marginBottom: 32,
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
          Needs Your Attention
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ATTENTION_STUBS.map(item => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px', background: '#111', borderRadius: 8,
              border: `1px solid ${item.severity === 'high' ? '#5c2a2a' : '#2a2a1e'}`,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: item.severity === 'high' ? '#e05252' : '#d4af37',
              }} />
              <span style={{ flex: 1, fontSize: 14, color: '#ddd' }}>{item.label}</span>
              <span style={{ fontSize: 11, color: '#555', flexShrink: 0 }}>{item.dept}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── dept dropdown ── */}
      <DeptDropdown />
    </main>
  );
}
