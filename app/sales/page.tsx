'use client';

import { useState, useEffect } from 'react';

/* ─────────────────────────────────────────────
   SALES ENTRY PAGE  —  ticket #183 / slice #159
   Full-viewport black, pattern mirrors revenue-v2
───────────────────────────────────────────────── */

const SALES_CHIPS = [
  { label: 'Leads', href: '/sales/leads' },
  { label: 'B2B Contracts', href: '/sales/contracts' },
  { label: 'Proposals', href: '/sales/proposals' },
  { label: 'Email Cockpit', href: '/sales/email' },
  { label: 'Pipeline', href: '/sales/pipeline' },
];

const ATTENTION_ITEMS = [
  { id: 1, text: 'Proposal #P-2024-031 awaiting sign-off', badge: 'Pending' },
  { id: 2, text: '3 new inbound leads from SLH referral', badge: 'New' },
  { id: 3, text: 'B2B contract renewal due in 7 days — Vientiane Corp', badge: 'Due Soon' },
];

const DOCS_DEFAULT = [
  { id: 'd1', title: 'Sales Playbook 2025', href: '/docs/sales-playbook' },
  { id: 'd2', title: 'Rate Card — Corporate', href: '/docs/rate-card-corp' },
  { id: 'd3', title: 'SLH Partner Guidelines', href: '/docs/slh-guidelines' },
];

const TASKS_DEFAULT = [
  { id: 't1', title: 'Follow up: Mekong Travel Group quote', done: false },
  { id: 't2', title: 'Update proposal template for long-stay', done: false },
  { id: 't3', title: 'Log call with Vientiane Gov delegation', done: false },
];

const LS_DOCS_KEY = 'nk.entry.docs.sales.v1';
const LS_TASKS_KEY = 'nk.entry.tasks.sales.v1';

interface Task { id: string; title: string; done: boolean }
interface Doc  { id: string; title: string; href: string }

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function SalesEntryPage() {
  const [chat, setChat]       = useState('');
  const [docs, setDocs]       = useState<Doc[]>(DOCS_DEFAULT);
  const [tasks, setTasks]     = useState<Task[]>(TASKS_DEFAULT);
  const [dept, setDept]       = useState('Sales');
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const storedDocs  = localStorage.getItem(LS_DOCS_KEY);
      const storedTasks = localStorage.getItem(LS_TASKS_KEY);
      if (storedDocs)  setDocs(JSON.parse(storedDocs)  as Doc[]);
      if (storedTasks) setTasks(JSON.parse(storedTasks) as Task[]);
    } catch { /* ignore parse errors */ }
    setHydrated(true);
  }, []);

  // Persist tasks to localStorage on change
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(LS_TASKS_KEY, JSON.stringify(tasks));
  }, [tasks, hydrated]);

  function toggleTask(id: string) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }

  function handleChatSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!chat.trim()) return;
    // Placeholder: route to cockpit chat with pre-filled query
    window.location.href = `/cockpit/chat?q=${encodeURIComponent(chat)}&dept=sales`;
  }

  const DEPTS = ['Sales', 'Revenue', 'Operations', 'Marketing', 'Finance', 'Guest'];

  return (
    <div style={styles.viewport}>

      {/* ── TOP NAV BAR ── */}
      <header style={styles.topBar}>
        <span style={styles.brand}>N</span>
        <nav style={styles.deptNav}>
          <select
            value={dept}
            onChange={e => setDept(e.target.value)}
            style={styles.deptSelect}
            aria-label="Department"
          >
            {DEPTS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </nav>
      </header>

      {/* ── MAIN BODY ── */}
      <main style={styles.main}>

        {/* 1. Greeting */}
        <h1 style={styles.greeting}>
          {getGreeting()}, Boss (Paul Bauer).
        </h1>

        {/* 2. Ask-anything chat box */}
        <form onSubmit={handleChatSubmit} style={styles.chatForm}>
          <input
            type="text"
            value={chat}
            onChange={e => setChat(e.target.value)}
            placeholder="Ask anything about sales, leads, or contracts…"
            style={styles.chatInput}
            aria-label="Ask anything"
          />
          <button type="submit" style={styles.chatBtn} aria-label="Send">
            ↵
          </button>
        </form>

        {/* 3. Quick-page chip row */}
        <div style={styles.chipRow} role="navigation" aria-label="Sales pages">
          {SALES_CHIPS.map(chip => (
            <a key={chip.href} href={chip.href} style={styles.chip}>
              {chip.label}
            </a>
          ))}
        </div>

        {/* 4. Two-column: My Docs · My Tasks */}
        <div style={styles.twoCol}>

          {/* LEFT — My Docs */}
          <section style={styles.panel}>
            <h2 style={styles.panelTitle}>My Docs</h2>
            <ul style={styles.list}>
              {docs.map(doc => (
                <li key={doc.id} style={styles.listItem}>
                  <a href={doc.href} style={styles.docLink}>{doc.title}</a>
                </li>
              ))}
            </ul>
          </section>

          {/* RIGHT — My Tasks */}
          <section style={styles.panel}>
            <h2 style={styles.panelTitle}>My Tasks</h2>
            <ul style={styles.list}>
              {tasks.map(task => (
                <li key={task.id} style={styles.listItem}>
                  <label style={styles.taskLabel}>
                    <input
                      type="checkbox"
                      checked={task.done}
                      onChange={() => toggleTask(task.id)}
                      style={styles.checkbox}
                    />
                    <span style={{ ...styles.taskText, textDecoration: task.done ? 'line-through' : 'none', opacity: task.done ? 0.45 : 1 }}>
                      {task.title}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* 5. Dept dropdown — already in top bar, but inline fallback label shown */}
        {/* (DeptDropdown shared component not yet confirmed in repo — inlined above) */}

        {/* 6. Needs-your-attention list */}
        <section style={styles.attentionSection} aria-label="Needs your attention">
          <h2 style={styles.panelTitle}>Needs Your Attention</h2>
          <ul style={styles.attentionList}>
            {ATTENTION_ITEMS.map(item => (
              <li key={item.id} style={styles.attentionItem}>
                <span style={styles.attentionText}>{item.text}</span>
                <span style={styles.attentionBadge}>{item.badge}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

/* ─── Styles ─────────────────────────────────── */
const styles: Record<string, React.CSSProperties> = {
  viewport: {
    minHeight: '100vh',
    background: '#000',
    color: '#fff',
    fontFamily: "'Inter', sans-serif",
    display: 'flex',
    flexDirection: 'column',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 24px',
    borderBottom: '1px solid #1a1a1a',
    background: '#000',
    position: 'sticky',
    top: 0,
    zIndex: 50,
  },
  brand: {
    fontFamily: "'Fraunces', serif",
    fontStyle: 'italic',
    fontSize: 28,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '-0.02em',
  },
  deptNav: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  deptSelect: {
    background: '#111',
    color: '#fff',
    border: '1px solid #333',
    borderRadius: 6,
    padding: '6px 12px',
    fontSize: 14,
    cursor: 'pointer',
    outline: 'none',
  },
  main: {
    flex: 1,
    maxWidth: 900,
    margin: '0 auto',
    padding: '48px 24px 80px',
    width: '100%',
  },
  greeting: {
    fontFamily: "'Fraunces', serif",
    fontStyle: 'italic',
    fontWeight: 600,
    fontSize: 32,
    marginBottom: 32,
    color: '#fff',
    letterSpacing: '-0.02em',
  },
  chatForm: {
    display: 'flex',
    gap: 8,
    marginBottom: 32,
  },
  chatInput: {
    flex: 1,
    background: '#111',
    border: '1px solid #2a2a2a',
    borderRadius: 8,
    color: '#fff',
    fontSize: 15,
    padding: '12px 16px',
    outline: 'none',
  },
  chatBtn: {
    background: '#fff',
    color: '#000',
    border: 'none',
    borderRadius: 8,
    padding: '12px 18px',
    fontSize: 18,
    cursor: 'pointer',
    fontWeight: 700,
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 40,
  },
  chip: {
    background: '#111',
    color: '#ccc',
    border: '1px solid #2a2a2a',
    borderRadius: 20,
    padding: '6px 16px',
    fontSize: 13,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    transition: 'border-color 0.15s',
  },
  twoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 24,
    marginBottom: 40,
  },
  panel: {
    background: '#0d0d0d',
    border: '1px solid #1e1e1e',
    borderRadius: 10,
    padding: '20px 24px',
  },
  panelTitle: {
    fontSize: 13,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#666',
    marginBottom: 16,
    marginTop: 0,
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  listItem: {
    fontSize: 14,
    color: '#ccc',
  },
  docLink: {
    color: '#ccc',
    textDecoration: 'none',
    borderBottom: '1px solid #2a2a2a',
    paddingBottom: 2,
  },
  taskLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    cursor: 'pointer',
  },
  checkbox: {
    accentColor: '#fff',
    width: 14,
    height: 14,
    cursor: 'pointer',
    flexShrink: 0,
  },
  taskText: {
    fontSize: 14,
    transition: 'opacity 0.2s',
  },
  attentionSection: {
    background: '#0d0d0d',
    border: '1px solid #1e1e1e',
    borderRadius: 10,
    padding: '20px 24px',
  },
  attentionList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  attentionItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 14,
    color: '#ccc',
  },
  attentionText: {
    flex: 1,
    paddingRight: 12,
  },
  attentionBadge: {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 12,
    padding: '2px 10px',
    fontSize: 11,
    fontWeight: 600,
    color: '#999',
    whiteSpace: 'nowrap',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
};
