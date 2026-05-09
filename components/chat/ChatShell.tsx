'use client';

// components/chat/ChatShell.tsx
// 2026-05-08 — every dept landing IS the chat with the dept's HoD.
// Refactor of /chat/page.tsx into a parameterized client component.
//
// Used by:
//   /chat              → Captain Kit (it_manager)
//   /                  → Felix (lead)             — architect home
//   /revenue           → Vector (revenue_hod)
//   /sales             → Mercer (sales_hod)
//   /marketing         → Lumen (marketing_hod)
//   /operations        → Forge (operations_hod)
//   /guest             → (no formal HoD — fall back to Felix)
//   /finance           → Intel (finance_hod)
//   /it                → Captain Kit (it_manager)
//
// The N dropdown (top-left) handles dept switching globally — see app/layout.tsx.

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co"),
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "build-placeholder-anon"),
);

type Ticket = {
  id: number;
  status: string;
  parsed_summary: string | null;
  arm: string | null;
  intent: string | null;
  created_at: string;
  updated_at: string;
  notes?: string | null;
};

type Attachment = { name: string; size: number; path: string; public_url: string | null };

interface ChatShellProps {
  /** Role key sent to /api/cockpit/chat — e.g. "revenue_hod", "lead", "it_manager". */
  role: string;
  /** Display name in topbar and welcome — e.g. "Vector". */
  displayName: string;
  /** Optional dept label rendered after the name — e.g. "Revenue". */
  dept?: string;
  /** Avatar emoji or single character for agent bubbles. */
  emoji?: string;
  /** Mention nickname auto-prepended to messages so triage routes correctly. */
  mentionNickname?: string;
  /** Override placeholder text in the composer. */
  placeholder?: string;
  /** localStorage key prefix so each chat shell has its own thread state. */
  storageKey?: string;
  /** Dept-entry storage prefix (rev / sal / fin / arch / it / …) — enables the "Create task" button to push into the right Tasks box. */
  taskStorageKeyPrefix?: string;
  /** Initial input prefilled into the composer (used when /cockpit/chat?q=… opens with a question). */
  initialInput?: string;
}

function stripTicketFraming(s: string | null): { user: string; agent: string } {
  if (!s) return { user: '', agent: '' };
  const m = s.match(/^\*\*Request\*\*:?\s*(.*?)\n\n([\s\S]*)$/);
  if (m) {
    let agent = m[2];
    agent = agent.replace(/\n+_—\s.*?_\s*$/, '').trim();
    agent = agent.replace(/^\*\*Triage\*\*[\s\S]*?(?=\n\n)/, '').trim();
    return { user: m[1].trim(), agent };
  }
  // PBS 2026-05-09 bug-fix: an in-progress ticket has parsed_summary set to
  // the raw user message (no **Request**: framing yet). Treat that as a
  // user turn, NOT an agent turn — otherwise conversation_history flips
  // user/assistant roles and breaks the next Anthropic call.
  return { user: s, agent: '' };
}

function md(s: string): string {
  let h = s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/```([\s\S]*?)```/g, '<pre style="background:#0a0a0b;border:1px solid #25252d;border-radius:6px;padding:10px;overflow:auto;font-size:12px"><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code style="background:#1a1a20;padding:2px 5px;border-radius:3px;font-size:13px">$1</code>')
    .replace(/^### (.+)$/gm, '<h3 style="font-family:\'Cooper\',Georgia,serif;font-size:18px;margin:14px 0 6px;color:#ededf0;font-weight:400">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-family:\'Cooper\',Georgia,serif;font-size:22px;margin:16px 0 8px;color:#ededf0;font-weight:400">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-family:\'Cooper\',Georgia,serif;font-size:26px;margin:18px 0 10px;color:#ededf0;font-weight:400">$1</h1>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\*([^*]+)\*/g, '<i>$1</i>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" style="color:#c79a6b;text-decoration:underline">$1</a>')
    .replace(/^- (.+)$/gm, '<li style="margin-left:20px;list-style:disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li style="margin-left:20px;list-style:decimal">$2</li>');
  h = h.replace(/(<li[^>]*>[^<]*(?:<\/li>\s*)+)/g, '<ul style="margin:6px 0">$1</ul>');
  h = h.split(/\n\n+/).map((p) => (p.startsWith('<') ? p : `<p style="margin:6px 0">${p.replace(/\n/g, '<br/>')}</p>`)).join('\n');
  return h;
}

export default function ChatShell({
  role,
  displayName,
  dept,
  emoji = '🧭',
  mentionNickname,
  placeholder,
  storageKey,
  taskStorageKeyPrefix,
  initialInput,
}: ChatShellProps) {
  const STORE_KEY = storageKey ?? `chat_thread_start_${role}`;
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [input, setInput] = useState(initialInput ?? '');
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  // 2026-05-08 — Add conversation to project. Lists active projects;
  // attaches the most-recent ticket in this thread to the picked project.
  type ProjectLite = { id: number; slug: string; name: string };
  const [projectList, setProjectList] = useState<ProjectLite[]>([]);
  const [attachOpen,  setAttachOpen]  = useState(false);
  const [attaching,   setAttaching]   = useState(false);
  const [attachToast, setAttachToast] = useState<string | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);
  // PBS 2026-05-09: thread always starts fresh on mount. "Leave the page,
  // come back" should be empty. localStorage is no longer the source of
  // truth — it lived too long and made every return feel cluttered.
  // The "+ New chat" button still works for an in-session reset.
  const [threadStart, setThreadStart] = useState<string>(() => new Date().toISOString());
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const startNewChat = () => {
    const now = new Date().toISOString();
    setThreadStart(now);
    setInput('');
    setAttachments([]);
  };

  // Build a turn-by-turn conversation history from the visible tickets so
  // the API can run a real follow-up turn (PBS 2026-05-09). Without this
  // every send was a one-shot ticket — the LLM had no idea what came before.
  function buildConversationHistory(): Array<{ role: 'user' | 'assistant'; content: string }> {
    const turns: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    for (const t of tickets) {
      // PBS 2026-05-09 bug-fix: skip tickets that haven't been triaged yet.
      // Their parsed_summary still holds the raw user message — including
      // them double-counts the user turn AND can flip role alternation
      // (Anthropic rejects messages where assistant follows assistant).
      if (t.status === 'triaging' || t.status === 'new') continue;
      const split = stripTicketFraming(t.parsed_summary);
      if (split.user)  turns.push({ role: 'user',      content: split.user });
      if (split.agent) turns.push({ role: 'assistant', content: split.agent });
    }
    // Cap to last 20 turns to keep payload tight.
    return turns.slice(-20);
  }

  async function createTaskFromConversation() {
    if (!taskStorageKeyPrefix) {
      setAttachToast('No dept linked — can’t create task here');
      setTimeout(() => setAttachToast(null), 2400);
      return;
    }
    if (tickets.length === 0) return;
    setCreatingTask(true);
    try {
      const turns = buildConversationHistory();
      const lastUser = [...turns].reverse().find(t => t.role === 'user')?.content ?? '';
      // Cheap heuristic: take the most recent user ask, trim, fall back to
      // the assistant’s last reply if the user never asked anything concrete.
      const seed = (lastUser || turns[turns.length - 1]?.content || '').trim();
      const label = seed.replace(/^@\w+\s+/, '').slice(0, 140) || `Follow-up from chat with ${displayName}`;
      const newTask = {
        id: Math.random().toString(36).slice(2, 9),
        label,
        done: false,
        created: new Date().toISOString(),
      };
      const TASKS_KEY = `nk.${taskStorageKeyPrefix}.entry.tasks.v2`;
      let existing: unknown[] = [];
      try {
        const raw = localStorage.getItem(TASKS_KEY);
        if (raw) existing = JSON.parse(raw);
      } catch { /* ignore parse errors */ }
      const next = Array.isArray(existing) ? [...existing, newTask] : [newTask];
      localStorage.setItem(TASKS_KEY, JSON.stringify(next));
      setAttachToast(`✓ Task added to ${dept ?? 'dept'} list`);
      setTimeout(() => setAttachToast(null), 2400);
    } finally {
      setCreatingTask(false);
    }
  }

  const load = async () => {
    const { data } = await supabase
      .from('cockpit_tickets')
      .select('id,status,parsed_summary,arm,intent,created_at,updated_at,notes')
      .gte('created_at', threadStart)
      .order('created_at', { ascending: true })
      .limit(40);
    // Filter to tickets that touch this role (notes may carry recommended_role).
    const all = (data as Ticket[]) ?? [];
    const filtered = all.filter((t) => {
      if (!mentionNickname && role === 'it_manager') return true; // Kit catches everything
      try {
        const n = t.notes ? JSON.parse(t.notes) : {};
        const r = (n?.recommended_role || n?.recommended_agent || n?.triage?.recommended_role || n?.triage?.recommended_agent || '').toString();
        return r === role || r === mentionNickname;
      } catch {
        return false;
      }
    });
    const real = filtered.length > 0 ? filtered : all;
    // PBS 2026-05-09: keep optimistic (id<0) tickets visible only until a
    // real ticket whose parsed_summary starts with the same text shows up.
    // Otherwise we'd render the user's question twice in the thread.
    setTickets((prev) => {
      const optimistic = prev.filter((t) => t.id < 0);
      const stillNeeded = optimistic.filter((o) => {
        const head = (o.parsed_summary ?? '').slice(0, 80);
        return !real.some((r) => (r.parsed_summary ?? '').slice(0, 80).startsWith(head.slice(0, 60)) || head.includes((r.parsed_summary ?? '').slice(0, 60)));
      });
      return [...real, ...stillNeeded];
    });
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`chat_${role}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cockpit_tickets' }, load)
      .subscribe();
    const id = setInterval(load, 8000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadStart, role, mentionNickname]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [tickets.length]);

  useEffect(() => {
    fetch('/api/cockpit/projects', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => setProjectList(Array.isArray(j?.projects) ? j.projects : []))
      .catch(() => { /* silent — projects optional */ });
  }, []);

  async function attachLatestTo(slug: string, projectName: string) {
    if (tickets.length === 0) return;
    // Most-recent ticket in this thread = the one PBS is referring to.
    const latest = [...tickets].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
    if (!latest) return;
    setAttaching(true);
    try {
      await fetch(`/api/cockpit/projects/${slug}/attach-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: latest.id }),
      });
      setAttachToast(`Added #${latest.id} to "${projectName}"`);
      setTimeout(() => setAttachToast(null), 2400);
      setAttachOpen(false);
    } finally {
      setAttaching(false);
    }
  }

  const send = async () => {
    if (!input.trim() && attachments.length === 0) return;
    // Auto-prefix @mention so the triage routes to this HoD.
    let body = input;
    if (mentionNickname && !body.match(/^@/)) {
      body = `@${mentionNickname} ${body}`;
    }
    if (attachments.length > 0) {
      const lines = attachments.map((a) => `📎 ${a.name} (${(a.size / 1024).toFixed(0)} KB) — ${a.public_url ?? a.path}`);
      body = body ? `${body}\n\n${lines.join('\n')}` : lines.join('\n');
    }
    // PBS 2026-05-09 bug #2: clear input + show optimistic user bubble
    // BEFORE awaiting fetch. Triage takes 5–15s; the UI must not block.
    // Build conversation history from existing tickets (excludes the
    // optimistic one we're about to add).
    const conversation_history = buildConversationHistory();
    const optimisticTicket: Ticket = {
      id: -Date.now(), // negative so it never collides with a real id
      status: 'triaging',
      parsed_summary: body,
      arm: 'triaging',
      intent: 'triage',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: null,
    };
    setTickets((prev) => [...prev, optimisticTicket]);
    setInput('');
    setAttachments([]);
    setSending(true);
    try {
      await fetch('/api/cockpit/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: body, attachments, mention: mentionNickname, conversation_history }),
      });
      // Reload so the real ticket replaces the optimistic one.
      load();
    } catch {
      // Surface a quiet failure on the optimistic bubble.
      setTickets((prev) =>
        prev.map((t) =>
          t.id === optimisticTicket.id
            ? { ...t, status: 'triage_failed', parsed_summary: `${body}\n\n_(network error — try again)_` }
            : t,
        ),
      );
    } finally {
      setSending(false);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const out: Attachment[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/cockpit/upload', { method: 'POST', body: fd });
        if (res.ok) {
          const j = await res.json();
          out.push({ name: file.name, size: file.size, path: j.path, public_url: j.public_url });
        }
      }
      setAttachments((prev) => [...prev, ...out]);
    } finally {
      setUploading(false);
    }
  };

  const placeholderText = placeholder ?? `Write to ${displayName}…`;

  return (
    <div style={S.body}>
      <div style={S.topbar}>
        <div style={S.logo}>
          {/* The brass N globally lives in NDropdown — top-left of the page. */}
          <span style={{ marginLeft: 60 }}>
            Chat with <b>{displayName}</b>{dept ? <span style={{ color: '#6b6b75' }}> · {dept}</span> : null}
          </span>
        </div>
        <div style={S.topbarRight}>
          <button onClick={startNewChat} style={{ ...S.topBtn, background: '#c79a6b', color: '#0a0a0b', border: 0, fontWeight: 600, cursor: 'pointer' }}>＋ New chat</button>
          {/* Create task from conversation (PBS 2026-05-09): writes the most
            * recent user ask into nk.<prefix>.entry.tasks.v2 so it shows up
            * in the dept-entry "My tasks" box on next visit. */}
          <button
            onClick={createTaskFromConversation}
            disabled={creatingTask || tickets.length === 0 || !taskStorageKeyPrefix}
            title={
              !taskStorageKeyPrefix ? 'No dept linked'
              : tickets.length === 0 ? 'Send a message first'
              : `Create a task in ${dept ?? 'this dept'} from this chat`
            }
            style={{
              ...S.topBtn,
              cursor: (creatingTask || tickets.length === 0 || !taskStorageKeyPrefix) ? 'not-allowed' : 'pointer',
              background: 'transparent',
              opacity: (tickets.length === 0 || !taskStorageKeyPrefix) ? 0.4 : 1,
            }}
          >
            {creatingTask ? '…' : '＋ Create task'}
          </button>
          {/* Add conversation to project (PBS 2026-05-08).
            * Uses projectList fetched on mount; tags the most-recent ticket
            * in this thread via /api/cockpit/projects/[slug]/attach-ticket. */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setAttachOpen(o => !o)}
              disabled={attaching || tickets.length === 0}
              title={tickets.length === 0 ? 'Send a message first' : 'Add this conversation to a project'}
              style={{
                ...S.topBtn,
                cursor: (attaching || tickets.length === 0) ? 'not-allowed' : 'pointer',
                background: 'transparent',
                opacity: tickets.length === 0 ? 0.4 : 1,
              }}
            >
              📁 Add to project ▾
            </button>
            {attachOpen && (
              <div style={{
                position: 'absolute', right: 0, top: 36, zIndex: 80,
                background: '#0e0e0c', border: '1px solid #25252d', borderRadius: 6,
                padding: 4, minWidth: 240, maxHeight: 320, overflowY: 'auto',
                boxShadow: '0 12px 28px rgba(0,0,0,0.55)',
              }}>
                {projectList.length === 0 && (
                  <div style={{ padding: '8px 10px', fontSize: 11, color: '#7d7565', fontStyle: 'italic' }}>
                    No active projects yet. Create one from a dept landing page.
                  </div>
                )}
                {projectList.map(p => (
                  <button
                    key={p.id}
                    onClick={() => attachLatestTo(p.slug, p.name)}
                    style={{
                      width: '100%', textAlign: 'left',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: '#ededf0', padding: '7px 10px', fontSize: 13, borderRadius: 4,
                    }}
                  >{p.name}</button>
                ))}
              </div>
            )}
          </div>
          {role === 'it_manager' ? (
            // PBS 2026-05-09: from Captain Kit's chat, surface a prominent
            // brass CTA to the IT Cockpit. Replaces the muted generic link
            // for it_manager only — every other persona keeps the subtle
            // "cockpit ↗" affordance.
            <a
              href="/cockpit"
              style={{
                ...S.topBtn,
                background: '#c79a6b',
                color: '#0a0a0b',
                border: 0,
                fontWeight: 600,
              }}
            >↗ Open IT Cockpit</a>
          ) : (
            <a href="/cockpit" style={S.topBtn}>cockpit ↗</a>
          )}
        </div>
      </div>

      <div style={S.thread}>
        {tickets.length === 0 && (
          <div style={S.welcome}>
            <div style={{ fontFamily: "'Cooper',Georgia,serif", fontSize: 32, color: '#ededf0', marginBottom: 8, fontStyle: 'italic' }}>
              Hallo Paul
            </div>
            <div style={{ color: '#a1a1aa', fontSize: 14, lineHeight: 1.6, maxWidth: 540, margin: '0 auto' }}>
              {dept
                ? <>I&apos;m <b>{displayName}</b>, your <b>{dept}</b> head. Just write what you need — I&apos;ll handle it autonomously.</>
                : <>Just write what you need — I&apos;ll handle it autonomously. Repair, build, investigate, decide.</>}
            </div>
          </div>
        )}

        {tickets.map((t) => {
          const split = stripTicketFraming(t.parsed_summary);
          const isPending = t.status === 'triaging' || t.status === 'new';
          return (
            <div key={t.id} style={S.exchange}>
              {split.user && (
                <div style={S.userRow}>
                  <div style={S.userBubble} dangerouslySetInnerHTML={{ __html: md(split.user) }} />
                  <div style={S.userAvatar}>PB</div>
                </div>
              )}
              {(split.agent || isPending) && (
                <div style={S.agentRow}>
                  <div style={S.agentAvatar}>{emoji}</div>
                  <div style={S.agentBubble}>
                    {isPending ? (
                      <div style={S.thinking}>
                        <span style={S.dot} /><span style={{ ...S.dot, animationDelay: '0.2s' }} /><span style={{ ...S.dot, animationDelay: '0.4s' }} />
                        <span style={{ marginLeft: 10, color: '#6b6b75' }}>thinking...</span>
                      </div>
                    ) : (
                      <div dangerouslySetInnerHTML={{ __html: md(split.agent) }} />
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div style={S.composer}>
        {attachments.length > 0 && (
          <div style={S.attachStrip}>
            {attachments.map((a, i) => (
              <div key={i} style={S.attachChip}>
                📎 {a.name} <span style={{ color: '#6b6b75' }}>· {(a.size / 1024).toFixed(0)} KB</span>
                <button onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))} style={S.attachX}>×</button>
              </div>
            ))}
          </div>
        )}
        <div style={S.inputRow}>
          <button onClick={() => fileRef.current?.click()} disabled={uploading} style={S.attachBtn} title="Attach file">
            {uploading ? '...' : '📎'}
          </button>
          <input ref={fileRef} type="file" multiple onChange={(e) => handleFiles(e.target.files)} style={{ display: 'none' }} />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={placeholderText}
            style={S.textarea}
            rows={1}
          />
          <button onClick={send} disabled={sending || (!input.trim() && attachments.length === 0)} style={S.sendBtn}>
            {sending ? '...' : '→'}
          </button>
        </div>
        <div style={S.hint}>Enter to send · Shift+Enter for new line · paperclip to attach</div>
      </div>

      {/* tiny attach-to-project confirmation toast (PBS 2026-05-08) */}
      {attachToast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 300,
          background: '#0f0d0a', border: '1px solid #3a3327', borderRadius: 8,
          padding: '10px 14px', fontSize: 12, color: '#d8cca8',
          boxShadow: '0 12px 28px rgba(0,0,0,0.5)',
        }}>
          📁 {attachToast}
        </div>
      )}

      <style jsx global>{`
        @keyframes blink { 0%,80%,100% { opacity: 0.3 } 40% { opacity: 1 } }
        body { margin: 0; background: #0a0a0b; }
      `}</style>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  body: { background: '#0a0a0b', color: '#ededf0', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, BlinkMacSystemFont, Inter, system-ui, sans-serif', fontSize: 14 },
  topbar: { height: 54, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1a1a20' },
  logo: { fontWeight: 500, fontSize: 14, display: 'flex', alignItems: 'center', gap: 10, color: '#a1a1aa' },
  topbarRight: { display: 'flex', gap: 8 },
  topBtn: { padding: '6px 12px', borderRadius: 6, color: '#a1a1aa', fontSize: 12, textDecoration: 'none', border: '1px solid #25252d' },
  thread: { flex: 1, overflowY: 'auto', padding: '32px 24px 120px', maxWidth: 820, width: '100%', margin: '0 auto' },
  welcome: { textAlign: 'center', padding: '80px 0' },
  exchange: { marginBottom: 28 },
  userRow: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 14 },
  userBubble: { background: '#c79a6b', color: '#0a0a0b', padding: '10px 14px', borderRadius: '14px 14px 4px 14px', maxWidth: '75%', fontSize: 14, lineHeight: 1.5 },
  userAvatar: { width: 28, height: 28, borderRadius: '50%', background: '#15151a', border: '1px solid #25252d', color: '#a1a1aa', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, flexShrink: 0 },
  agentRow: { display: 'flex', gap: 10, alignItems: 'flex-start' },
  agentAvatar: { width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #c79a6b, #b88556)', color: '#0a0a0b', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  agentBubble: { background: '#15151a', padding: '12px 16px', borderRadius: '14px 14px 14px 4px', maxWidth: 'calc(100% - 50px)', fontSize: 14, lineHeight: 1.6, color: '#ededf0' },
  thinking: { display: 'flex', alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: '50%', background: '#c79a6b', margin: '0 2px', animation: 'blink 1.2s infinite' },
  composer: { position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 24px 16px', background: 'linear-gradient(to top, #0a0a0b 80%, transparent)', borderTop: '1px solid #1a1a20' },
  attachStrip: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, maxWidth: 820, margin: '0 auto 8px' },
  attachChip: { background: '#15151a', border: '1px solid #25252d', padding: '4px 10px', borderRadius: 14, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 },
  attachX: { background: 'transparent', border: 0, color: '#6b6b75', cursor: 'pointer', marginLeft: 4 },
  inputRow: { display: 'flex', gap: 8, alignItems: 'flex-end', maxWidth: 820, margin: '0 auto' },
  attachBtn: { background: '#15151a', border: '1px solid #25252d', color: '#a1a1aa', padding: '10px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 16 },
  textarea: { flex: 1, background: '#15151a', border: '1px solid #25252d', color: '#ededf0', padding: '12px 14px', borderRadius: 12, fontSize: 14, fontFamily: 'inherit', resize: 'none', minHeight: 22, maxHeight: 200 },
  sendBtn: { background: '#c79a6b', color: '#0a0a0b', border: 0, borderRadius: 8, padding: '12px 18px', fontWeight: 600, cursor: 'pointer', fontSize: 16, minWidth: 50 },
  hint: { fontSize: 10, color: '#3d3d45', textAlign: 'center', marginTop: 6, maxWidth: 820, margin: '6px auto 0' },
};
