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
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
  return { user: '', agent: s };
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
}: ChatShellProps) {
  const STORE_KEY = storageKey ?? `chat_thread_start_${role}`;
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [threadStart, setThreadStart] = useState<string>(() => {
    if (typeof window === 'undefined') return new Date(Date.now() - 24 * 3600_000).toISOString();
    return localStorage.getItem(STORE_KEY) ?? new Date(Date.now() - 24 * 3600_000).toISOString();
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const startNewChat = () => {
    const now = new Date().toISOString();
    localStorage.setItem(STORE_KEY, now);
    setThreadStart(now);
    setInput('');
    setAttachments([]);
  };

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
    setTickets(filtered.length > 0 ? filtered : all);
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

  const send = async () => {
    if (!input.trim() && attachments.length === 0) return;
    setSending(true);
    try {
      // Auto-prefix @mention so the triage routes to this HoD.
      let body = input;
      if (mentionNickname && !body.match(/^@/)) {
        body = `@${mentionNickname} ${body}`;
      }
      if (attachments.length > 0) {
        const lines = attachments.map((a) => `📎 ${a.name} (${(a.size / 1024).toFixed(0)} KB) — ${a.public_url ?? a.path}`);
        body = body ? `${body}\n\n${lines.join('\n')}` : lines.join('\n');
      }
      await fetch('/api/cockpit/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: body, attachments, mention: mentionNickname }),
      });
      setInput('');
      setAttachments([]);
      load();
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
          <a href="/cockpit" style={S.topBtn}>cockpit ↗</a>
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
