'use client';

// components/chat/CentralChat.tsx
// Central Chat v1 — brief central-chat-v1 (build/central-chat).
//
// ONE reusable chat component, Felix-routed per the one-channel command law
// (PBS 2026-07-30): every turn goes PBS → chat → Felix ('lead'). Felix is the
// sole dispatcher; specialist agents receive work from the queue, never from
// direct owner chat. The counterpart is therefore always labelled
// "Felix · chief of staff".
//
// Modes (context scopes, per the binding correction of 2026-07-29):
//   second-brain — full scoped business context (Supabase memory, rules,
//                  hotel data). moduleScope/propertyId narrow the knowledge
//                  scope of the embedded instance.
//   general      — model-only. No business data in, no memory writes out.
//
// v1 CUT (stated): both modes post to the EXISTING /api/cockpit/chat route
// (tickets-thread persistence — cockpit_tickets is the conversation store
// until cockpit.conversations/messages land, see db/proposed/build-central-
// chat/). The body carries mode / module_scope / property_id; the route
// ignores unknown fields today, so general-mode isolation is enforced
// server-side only when the route grows mode support (v2). The component
// already sends the fields so no client change is needed then.
//
// Owner-class questions: any Felix reply that surfaces an owner decision
// ("owner-class", "Decision Inbox", "Needs you", "OPEN QUESTION") gets a
// deep-link chip to /holding/it2/questions (the Decision Inbox).
//
// Provider policy: Anthropic-only per ADR-169 (owner answer 2026-07-30).
// Tier routing happens server-side; this component never picks a provider.

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://build-placeholder.supabase.co'),
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'build-placeholder-anon'),
);

// ── palette (canonical cockpit tokens, inlined — client component) ────────
const C = {
  bg: '#F4EFE2',
  paper: '#FFFFFF',
  ink: '#1B1B1B',
  text2: '#5A5A5A',
  text3: '#8A8A8A',
  border: '#E6DFCC',
  forest: '#1F3A2E',
  sand: '#B8A878',
  terracotta: '#B8542A',
};
const MONO = 'JetBrains Mono, ui-monospace, monospace';

export type CentralChatMode = 'second-brain' | 'general';

export interface CentralChatProps {
  /** Context scope. 'second-brain' = business context via Felix; 'general' = model-only, no business data. */
  mode: CentralChatMode;
  /** Module/capability the embedding surface belongs to (e.g. 'revenue', 'it'). Narrows knowledge scope. */
  moduleScope?: string;
  /** Tenant scope of the /h/[pid] context the instance is embedded in. */
  propertyId?: number;
}

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

// ── ticket → turns (same framing contract as ChatShell / /api/cockpit/chat) ─
function stripTicketFraming(s: string | null): { user: string; agent: string } {
  if (!s) return { user: '', agent: '' };
  const m = s.match(/^\*\*Request\*\*:?\s*(.*?)\n\n([\s\S]*)$/);
  if (m) {
    let agent = m[2];
    agent = agent.replace(/\n+_—\s.*?_\s*$/, '').trim();
    agent = agent.replace(/^\*\*Triage\*\*[\s\S]*?(?=\n\n)/, '').trim();
    return { user: m[1].trim(), agent };
  }
  // In-progress ticket: parsed_summary is the raw user message — a user turn.
  return { user: s, agent: '' };
}

// Minimal markdown → HTML (escape first; same approach as ChatShell).
function md(s: string): string {
  let h = s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/```([\s\S]*?)```/g, `<pre style="background:${C.bg};border:1px solid ${C.border};border-radius:6px;padding:10px;overflow:auto;font-size:12px"><code>$1</code></pre>`)
    .replace(/`([^`]+)`/g, `<code style="background:${C.bg};padding:2px 5px;border-radius:3px;font-size:13px">$1</code>`)
    .replace(/^### (.+)$/gm, `<h3 style="font-size:16px;margin:12px 0 6px;color:${C.ink};font-weight:600">$1</h3>`)
    .replace(/^## (.+)$/gm, `<h2 style="font-size:18px;margin:14px 0 8px;color:${C.ink};font-weight:600">$1</h2>`)
    .replace(/^# (.+)$/gm, `<h1 style="font-size:20px;margin:16px 0 10px;color:${C.ink};font-weight:600">$1</h1>`)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\*([^*]+)\*/g, '<i>$1</i>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" target="_blank" rel="noreferrer" style="color:${C.forest};text-decoration:underline">$1</a>`)
    .replace(/^- (.+)$/gm, '<li style="margin-left:20px;list-style:disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li style="margin-left:20px;list-style:decimal">$2</li>');
  h = h.replace(/(<li[^>]*>[^<]*(?:<\/li>\s*)+)/g, '<ul style="margin:6px 0">$1</ul>');
  h = h.split(/\n\n+/).map((p) => (p.startsWith('<') ? p : `<p style="margin:6px 0">${p.replace(/\n/g, '<br/>')}</p>`)).join('\n');
  return h;
}

// Owner-class detection: Felix routes owner decisions to the Decision Inbox
// (one-channel law §1). If a reply surfaces one, deep-link the inbox.
function hasOwnerClassQuestion(agentText: string): boolean {
  return /owner-class|decision inbox|needs you|open question/i.test(agentText);
}

export default function CentralChat({ mode, moduleScope, propertyId }: CentralChatProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  // Thread starts fresh on mount (PBS 2026-05-09 rule — no stale localStorage).
  const [threadStart, setThreadStart] = useState<string>(() => new Date().toISOString());
  const endRef = useRef<HTMLDivElement>(null);

  const startNewChat = () => {
    setThreadStart(new Date().toISOString());
    setInput('');
  };

  function buildConversationHistory(): Array<{ role: 'user' | 'assistant'; content: string }> {
    const turns: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    for (const t of tickets) {
      if (t.status === 'triaging' || t.status === 'new' || t.id < 0) continue;
      const split = stripTicketFraming(t.parsed_summary);
      if (split.user) turns.push({ role: 'user', content: split.user });
      if (split.agent) turns.push({ role: 'assistant', content: split.agent });
    }
    return turns.slice(-20);
  }

  const load = async () => {
    const { data } = await supabase
      .from('cockpit_tickets')
      .select('id,status,parsed_summary,arm,intent,created_at,updated_at,notes')
      .gte('created_at', threadStart)
      .order('created_at', { ascending: true })
      .limit(40);
    const real = (data as Ticket[]) ?? [];
    // Keep optimistic (id<0) bubbles only until the real ticket shows up.
    setTickets((prev) => {
      const optimistic = prev.filter((t) => t.id < 0);
      const stillNeeded = optimistic.filter((o) => {
        const head = (o.parsed_summary ?? '').slice(0, 80);
        return !real.some((r) =>
          (r.parsed_summary ?? '').slice(0, 80).startsWith(head.slice(0, 60))
          || head.includes((r.parsed_summary ?? '').slice(0, 60)));
      });
      return [...real, ...stillNeeded];
    });
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`central_chat_${mode}_${moduleScope ?? 'global'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cockpit_tickets' }, load)
      .subscribe();
    const id = setInterval(load, 8000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadStart, mode, moduleScope]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [tickets.length]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    // One-channel law: every turn routes to Felix ('lead'). Never a specialist.
    const body = text.match(/^@/) ? text : `@felix ${text}`;
    const conversation_history = buildConversationHistory();
    const optimistic: Ticket = {
      id: -Date.now(),
      status: 'triaging',
      parsed_summary: body,
      arm: 'triaging',
      intent: 'triage',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: null,
    };
    setTickets((prev) => [...prev, optimistic]);
    setInput('');
    setSending(true);
    try {
      await fetch('/api/cockpit/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: body,
          mention: 'felix',
          conversation_history,
          // Forward-compatible scope fields — ignored by the route today,
          // consumed once mode-scoped context assembly lands (v2).
          mode,
          module_scope: moduleScope ?? null,
          property_id: propertyId ?? null,
        }),
      });
      load();
    } catch {
      setTickets((prev) =>
        prev.map((t) =>
          t.id === optimistic.id
            ? { ...t, status: 'triage_failed', parsed_summary: `${body}\n\n_(network error — try again)_` }
            : t,
        ),
      );
    } finally {
      setSending(false);
    }
  };

  const modeLabel = mode === 'second-brain' ? 'Second Brain' : 'General';
  const scopeBits = [
    modeLabel,
    moduleScope ? `scope: ${moduleScope}` : null,
    propertyId ? `property ${propertyId}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div style={S.shell}>
      {/* ── header ─────────────────────────────────────────────────────── */}
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={S.avatar}>F</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Felix · chief of staff</div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: C.text3, letterSpacing: 0.4 }}>{scopeBits}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {mode === 'general' && (
            <span
              title="General mode: model only. No business data read, no memory written."
              style={{
                fontFamily: MONO, fontSize: 10, color: C.text2,
                border: `1px solid ${C.border}`, borderRadius: 2, padding: '3px 8px',
                background: C.bg,
              }}
            >
              no business data
            </span>
          )}
          <button onClick={startNewChat} style={S.newChatBtn}>+ New chat</button>
        </div>
      </div>

      {/* ── thread ─────────────────────────────────────────────────────── */}
      <div style={S.thread}>
        {tickets.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ fontSize: 15, color: C.ink, marginBottom: 6 }}>
              {mode === 'second-brain'
                ? 'Ask Felix. He carries the business context.'
                : 'General chat — model only, nothing read from or written to the business.'}
            </div>
            <div style={{ fontSize: 12, color: C.text3, maxWidth: 460, margin: '0 auto', lineHeight: 1.6 }}>
              {mode === 'second-brain'
                ? 'Questions and execution orders flow through this one channel. Felix consults the brain, writes work as tickets, and routes owner decisions to the Decision Inbox.'
                : 'Brainstorming, writing, coding, research.'}
            </div>
          </div>
        )}

        {tickets.map((t) => {
          const split = stripTicketFraming(t.parsed_summary);
          const isPending = t.status === 'triaging' || t.status === 'new';
          const ownerQ = split.agent ? hasOwnerClassQuestion(split.agent) : false;
          return (
            <div key={t.id} style={{ marginBottom: 24 }}>
              {split.user && (
                <div style={S.userRow}>
                  <div style={S.userBubble} dangerouslySetInnerHTML={{ __html: md(split.user) }} />
                </div>
              )}
              {(split.agent || isPending) && (
                <div style={S.agentRow}>
                  <div style={S.agentAvatar}>F</div>
                  <div style={{ maxWidth: 'calc(100% - 44px)' }}>
                    <div style={S.agentBubble}>
                      {isPending ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <span style={S.dot} />
                          <span style={{ ...S.dot, animationDelay: '0.2s' }} />
                          <span style={{ ...S.dot, animationDelay: '0.4s' }} />
                          <span style={{ marginLeft: 8, color: C.text2, fontSize: 12 }}>Felix is thinking…</span>
                        </span>
                      ) : (
                        <div dangerouslySetInnerHTML={{ __html: md(split.agent) }} />
                      )}
                    </div>
                    {ownerQ && (
                      <a href="/holding/it2/questions" style={S.ownerChip}>
                        ⚑ Owner decision surfaced → open the Decision Inbox
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* ── sticky composer ────────────────────────────────────────────── */}
      <div style={S.composer}>
        <div style={S.inputRow}>
          <button
            disabled
            title="Attachments land with conversations v2 — not wired in v1."
            style={S.attachBtn}
          >
            📎
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={mode === 'second-brain' ? 'Write to Felix…' : 'Ask anything (model only)…'}
            style={S.textarea}
            rows={1}
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            style={{ ...S.sendBtn, opacity: sending || !input.trim() ? 0.5 : 1 }}
          >
            {sending ? '…' : '→'}
          </button>
        </div>
        <div style={S.hint}>Enter to send · Shift+Enter for new line · one channel — Felix dispatches</div>
      </div>

      <style jsx global>{`
        @keyframes ccblink { 0%,80%,100% { opacity: 0.3 } 40% { opacity: 1 } }
      `}</style>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  shell: {
    display: 'flex', flexDirection: 'column',
    background: C.paper, border: `1px solid ${C.border}`, borderRadius: 2,
    minHeight: 520, maxHeight: '78vh', overflow: 'hidden',
    fontFamily: '-apple-system, BlinkMacSystemFont, Inter, system-ui, sans-serif',
    fontSize: 14, color: C.ink,
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 16px', borderBottom: `1px solid ${C.border}`, background: C.paper,
    flexShrink: 0,
  },
  avatar: {
    width: 30, height: 30, borderRadius: '50%',
    background: C.forest, color: '#FFFFFF',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 700, flexShrink: 0,
  },
  newChatBtn: {
    background: C.forest, color: '#FFFFFF', border: 0, borderRadius: 2,
    padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  thread: { flex: 1, overflowY: 'auto', padding: '20px 18px', background: C.paper },
  userRow: { display: 'flex', justifyContent: 'flex-end', marginBottom: 12 },
  userBubble: {
    background: C.forest, color: '#FFFFFF', padding: '9px 13px',
    borderRadius: '12px 12px 3px 12px', maxWidth: '75%', fontSize: 14, lineHeight: 1.5,
  },
  agentRow: { display: 'flex', gap: 10, alignItems: 'flex-start' },
  agentAvatar: {
    width: 26, height: 26, borderRadius: '50%',
    background: C.forest, color: '#FFFFFF', fontSize: 12, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  agentBubble: {
    background: C.bg, padding: '10px 14px',
    borderRadius: '12px 12px 12px 3px', fontSize: 14, lineHeight: 1.6, color: C.ink,
  },
  ownerChip: {
    display: 'inline-block', marginTop: 6,
    fontFamily: MONO, fontSize: 11, color: C.terracotta, textDecoration: 'none',
    border: `1px solid ${C.terracotta}`, borderRadius: 2, padding: '4px 10px',
    background: 'rgba(184,84,42,0.06)',
  },
  dot: {
    width: 5, height: 5, borderRadius: '50%', background: C.forest,
    display: 'inline-block', animation: 'ccblink 1.2s infinite',
  },
  composer: {
    position: 'sticky', bottom: 0, flexShrink: 0,
    padding: '10px 14px 12px', background: C.paper, borderTop: `1px solid ${C.border}`,
  },
  inputRow: { display: 'flex', gap: 8, alignItems: 'flex-end' },
  attachBtn: {
    background: C.bg, border: `1px solid ${C.border}`, color: C.text3,
    padding: '9px 11px', borderRadius: 2, cursor: 'not-allowed', fontSize: 15,
  },
  textarea: {
    flex: 1, background: C.bg, border: `1px solid ${C.border}`, color: C.ink,
    padding: '10px 12px', borderRadius: 2, fontSize: 14, fontFamily: 'inherit',
    resize: 'none', minHeight: 20, maxHeight: 180,
  },
  sendBtn: {
    background: C.forest, color: '#FFFFFF', border: 0, borderRadius: 2,
    padding: '10px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 15, minWidth: 46,
  },
  hint: { fontSize: 10, color: C.text3, textAlign: 'center', marginTop: 5, fontFamily: MONO },
};
