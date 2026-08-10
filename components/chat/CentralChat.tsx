'use client';

// components/chat/CentralChat.tsx
// Central Chat v2 — brief central-chat-missing-ui-features.
// Enhanced with: conversation history, thread summarization, save to KB, model tier visibility.
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
// v2 ENHANCEMENTS (2026-08-05):
// - Conversation history sidebar (toggle)
// - Thread summarization (one-click button)
// - Save to KB button per assistant message
// - Model tier visibility badges

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import ConversationHistory from './ConversationHistory';

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

// 'second-brain' = HOS mode (Felix with full brain+tools context) — shown to user as "HOS"
// 'general' = LLM mode — multi-model: DeepSeek V3/R1, GPT-4o/mini, Gemini Flash
export type CentralChatMode = 'second-brain' | 'general';

// ─── LLM model catalogue ──────────────────────────────────────────────────────
export const LLM_MODELS = [
  {
    id: 'deepseek-chat',
    label: 'DeepSeek V3',
    provider: 'DeepSeek',
    badge: '🏆',
    cost: '$0.27/M',
    speed: '⚡⚡',
    bestFor: 'General writing, analysis, Q&A — best value overall',
    special: null,
    recommended: true,
  },
  {
    id: 'deepseek-reasoner',
    label: 'DeepSeek R1',
    provider: 'DeepSeek',
    badge: '🔍',
    cost: '$0.55/M',
    speed: '⚡',
    bestFor: 'Complex reasoning, financial analysis, step-by-step problem solving',
    special: 'Shows reasoning chain',
    recommended: false,
  },
  {
    id: 'gemini-2.0-flash',
    label: 'Gemini Flash 2.0',
    provider: 'Google',
    badge: '⚡',
    cost: '$0.10/M',
    speed: '⚡⚡⚡',
    bestFor: 'Very long documents (1M token context), fast Q&A, research',
    special: 'Web search via Google · 1M token context',
    recommended: false,
  },
  {
    id: 'gpt-4o-mini',
    label: 'GPT-4o mini',
    provider: 'OpenAI',
    badge: '🚀',
    cost: '$0.15/M',
    speed: '⚡⚡',
    bestFor: 'Quick tasks, drafting, summarization — reliable OpenAI quality',
    special: null,
    recommended: false,
  },
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    provider: 'OpenAI',
    badge: '🌐',
    cost: '$5.00/M',
    speed: '⚡',
    bestFor: 'Most complex tasks, nuanced writing, image understanding',
    special: 'Web browse · image input',
    recommended: false,
  },
] as const;
export type LLMModelId = typeof LLM_MODELS[number]['id'];

export interface CentralChatProps {
  /** 'second-brain' = HOS (Hospitality OS) — full business context, brain access, execution via Felix. Shown as "HOS". 'general' = model only. */
  mode: CentralChatMode;
  /** Module/capability the embedding surface belongs to (e.g. 'revenue', 'it'). Narrows knowledge scope. */
  moduleScope?: string;
  /** Tenant scope of the /h/[pid] context the instance is embedded in. */
  propertyId?: number;
  /** Show conversation history sidebar by default */
  showHistory?: boolean;
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

type ChatMessage = {
  id: number;
  turn_role: string;
  content_md: string;
  model_tier?: string | null;
  created_at: string;
};

// Normalized key for matching a ticket-thread assistant bubble to its
// conversation-store row (v_chat_messages) so we can surface model_tier.
function tierKey(s: string): string {
  return s.replace(/\s+/g, ' ').trim().slice(0, 80);
}

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

function hasOwnerClassQuestion(agentText: string): boolean {
  return /owner-class|decision inbox|needs you|open question/i.test(agentText);
}

function TierBadge({ tier }: { tier?: string | null }) {
  if (!tier) return null;
  const label = tier === 'fast' ? '⚡ fast' : tier === 'reasoning' ? '🧠 reasoning' : tier === 'long-context' ? '📚 long' : tier;
  return (
    <span style={{
      fontSize: 9,
      fontFamily: MONO,
      color: C.text3,
      background: C.bg,
      padding: '2px 6px',
      borderRadius: 2,
      marginLeft: 6,
    }}>
      {label}
    </span>
  );
}

export default function CentralChat({ mode: defaultMode, moduleScope, propertyId, showHistory = false }: CentralChatProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<CentralChatMode>(defaultMode);
  const [llmModel, setLlmModel] = useState<LLMModelId>('deepseek-chat');
  const [showModelHelp, setShowModelHelp] = useState(false);
  const [threadStart, setThreadStart] = useState<string>(() => new Date().toISOString());
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(showHistory);
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  // Resumed conversation-store messages (rendered above the live ticket thread).
  const [resumed, setResumed] = useState<ChatMessage[]>([]);
  // model_tier per assistant message, keyed by tierKey(content_md).
  const [msgTiers, setMsgTiers] = useState<Record<string, string>>({});
  const endRef = useRef<HTMLDivElement>(null);

  const startNewChat = () => {
    setThreadStart(new Date().toISOString());
    setConversationId(null);
    setInput('');
    setSummary(null);
    setResumed([]);
  };

  const switchMode = (m: CentralChatMode) => {
    if (m === mode) return;
    setMode(m);
    setTickets([]);
    setThreadStart(new Date().toISOString());
    setConversationId(null);
    setSummary(null);
    setResumed([]);
  };

  // Pull v_chat_messages for the conversation and map assistant model_tier
  // onto thread bubbles (A5: tier visibility in the live thread).
  const refreshTiers = async (convId: string): Promise<ChatMessage[]> => {
    try {
      const res = await fetch(`/api/cockpit/chat?conversation_id=${encodeURIComponent(convId)}`);
      if (!res.ok) return [];
      const j = await res.json();
      const msgs: ChatMessage[] = Array.isArray(j.messages) ? j.messages : [];
      setMsgTiers((prev) => {
        const next = { ...prev };
        for (const m of msgs) {
          if (m.turn_role === 'assistant' && m.model_tier && m.content_md) {
            next[tierKey(m.content_md)] = m.model_tier;
          }
        }
        return next;
      });
      return msgs;
    } catch {
      return [];
    }
  };

  // Resume a past conversation from the history sidebar (A1).
  const handleResume = async (id: string) => {
    try {
      const res = await fetch(`/api/cockpit/chat?conversation_id=${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const j = await res.json();
      const msgs: ChatMessage[] = Array.isArray(j.messages) ? j.messages : [];
      setResumed(msgs);
      setTickets([]);
      setThreadStart(new Date().toISOString());
      setConversationId(id);
      setSummary((j.conversation?.summary_md as string | undefined) ?? null);
      const convMode = j.conversation?.mode as string | undefined;
      if (convMode === 'general' || convMode === 'second-brain') setMode(convMode);
      setMsgTiers((prev) => {
        const next = { ...prev };
        for (const m of msgs) {
          if (m.turn_role === 'assistant' && m.model_tier && m.content_md) {
            next[tierKey(m.content_md)] = m.model_tier;
          }
        }
        return next;
      });
    } catch { /* keep current thread on failure */ }
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

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [tickets.length, resumed.length]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const body = text; // mention field handles routing; never show @felix in the bubble
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
      const res = await fetch('/api/cockpit/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: body,
          mention: mode === 'general' ? undefined : 'felix',
          conversation_history,
          mode,
          llm_model: mode === 'general' ? llmModel : undefined,
          module_scope: moduleScope ?? null,
          property_id: propertyId ?? null,
          conversation_id: conversationId,
        }),
      });
      try {
        const j = await res.json();
        if (j && typeof j.conversation_id === 'string') {
          setConversationId(j.conversation_id);
          // POST is synchronous (returns after triage) — the assistant row is
          // already in the conversation store; fetch its model_tier for A5.
          refreshTiers(j.conversation_id);
        }
      } catch { /* ignore */ }
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

  const summarizeThread = async () => {
    if (!conversationId || summarizing) return;
    setSummarizing(true);
    try {
      const res = await fetch('/api/cockpit/chat/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId }),
      });
      const j = await res.json();
      if (j.ok && j.summary) {
        setSummary(j.summary);
      }
    } catch (e) {
      console.error('Summarization failed:', e);
    } finally {
      setSummarizing(false);
    }
  };

  const saveToKB = async (question: string, answer: string) => {
    try {
      await fetch('/api/cockpit/chat/save-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, answer_md: answer }),
      });
      alert('Answer saved to knowledge base');
    } catch (e) {
      alert('Failed to save to KB');
    }
  };

  const propertyLabel = propertyId === 260955 ? 'Namkhan' : propertyId === 1000001 ? 'Donna' : 'Holding';
  const scopeBits = [
    mode === 'second-brain' ? 'HOS' : 'General',
    moduleScope ? `scope: ${moduleScope}` : null,
    mode === 'second-brain' && propertyId ? propertyLabel : null,
  ].filter(Boolean).join(' · ');

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {/* History sidebar — real component, click a row to resume (A1) */}
      {historyOpen && (
        <div style={{ width: 280, flexShrink: 0, minHeight: 520, maxHeight: '78vh', display: 'flex' }}>
          <ConversationHistory
            onSelectConversation={handleResume}
            currentConversationId={conversationId}
            mode={mode}
            moduleScope={moduleScope}
            propertyId={propertyId}
          />
        </div>
      )}

      {/* Main chat */}
      <div style={{ ...S.shell, flex: 1 }}>
        {/* ── header ─────────────────────────────────────────────────────── */}
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={S.avatar}>{mode === 'general' ? '◦' : '🏨'}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>
                {mode === 'general' ? 'General · model only' : `HOS · ${propertyLabel}`}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: C.text3, letterSpacing: 0.4 }}>{scopeBits}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* History toggle */}
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              title="Toggle conversation history"
              style={{
                ...S.iconBtn,
                background: historyOpen ? C.forest : C.bg,
                color: historyOpen ? '#FFFFFF' : C.text2,
              }}
            >
              📜
            </button>

            {/* Summarize button */}
            {conversationId && (tickets.length > 2 || resumed.length > 2) && (
              <button
                onClick={summarizeThread}
                disabled={summarizing}
                title="Summarize this conversation"
                style={{
                  ...S.iconBtn,
                  opacity: summarizing ? 0.5 : 1,
                }}
              >
                {summarizing ? '…' : '∑'}
              </button>
            )}

            {/* Mode toggle — HOS (full business OS) | LLM (multi-model) */}
            <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden' }}>
              {(['second-brain', 'general'] as CentralChatMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  title={
                    m === 'general' ? 'LLM: multi-model chat — OpenAI, DeepSeek, Gemini. No business data.. For brainstorming, writing, coding.' :
                                     'HOS: Hospitality OS. Full business context — asks the brain, executes via Felix, routes decisions to inbox.'
                  }
                  style={{
                    fontFamily: MONO, fontSize: 10, letterSpacing: 0.4, cursor: 'pointer',
                    padding: '4px 10px', border: 0,
                    background: mode === m ? C.forest : C.bg,
                    color: mode === m ? '#FFFFFF' : C.text2,
                  }}
                >
                  {m === 'general' ? 'LLM' : 'HOS'}
                </button>
              ))}
            </div>
            <button onClick={startNewChat} style={S.newChatBtn}>+ New chat</button>
          </div>
        </div>

        {/* ── LLM model picker (only in LLM/general mode) ──────────────── */}
        {mode === 'general' && (
          <div style={{ padding: '6px 16px 0', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const, borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: C.text3, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Model</span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const, flex: 1 }}>
              {LLM_MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setLlmModel(m.id as LLMModelId)}
                  title={`${m.label} · ${m.cost} · ${m.bestFor}`}
                  style={{
                    fontFamily: MONO, fontSize: 10, cursor: 'pointer', padding: '2px 8px',
                    border: `1px solid ${llmModel === m.id ? C.forest : C.border}`,
                    borderRadius: 3, background: llmModel === m.id ? C.forest : 'transparent',
                    color: llmModel === m.id ? '#FFF' : C.text2, marginBottom: 6,
                  }}
                >
                  {m.badge} {m.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowModelHelp(!showModelHelp)}
              title="Model guide — costs, capabilities, recommendations"
              style={{ fontFamily: MONO, fontSize: 10, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', color: C.text3, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 6 }}
            >
              ?
            </button>
          </div>
        )}

        {/* ── Model help popup ─────────────────────────────────────────────── */}
        {mode === 'general' && showModelHelp && (
          <div style={{ position: 'absolute' as const, top: 80, right: 12, zIndex: 100, width: 'min(480px, 95vw)', background: '#FFFFFF', border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: '0 8px 28px rgba(0,0,0,0.14)', padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>Model guide · LLM tab</div>
              <button onClick={() => setShowModelHelp(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, color: C.text3 }}>✕</button>
            </div>
            <div style={{ fontSize: 11, color: C.text3, marginBottom: 12, lineHeight: 1.5 }}>
              All models are raw LLM — no business data. Switch to <strong>HOS</strong> for hotel data, brain, and execution.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
              {LLM_MODELS.map((m) => (
                <div key={m.id}
                  onClick={() => { setLlmModel(m.id as LLMModelId); setShowModelHelp(false); }}
                  style={{ display: 'flex', gap: 10, padding: '8px 10px', border: `1px solid ${llmModel === m.id ? C.forest : C.border}`, borderRadius: 6, cursor: 'pointer', background: llmModel === m.id ? '#F0F7F4' : '#FAFAFA' }}
                >
                  <div style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{m.badge}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{m.label}</span>
                      <span style={{ fontFamily: MONO, fontSize: 9, color: C.text3, letterSpacing: '0.1em' }}>{m.provider}</span>
                      {m.recommended && <span style={{ fontFamily: MONO, fontSize: 9, background: C.forest, color: '#FFF', padding: '1px 5px', borderRadius: 3 }}>recommended</span>}
                    </div>
                    <div style={{ fontSize: 11, color: C.text2, lineHeight: 1.4, marginBottom: 3 }}>{m.bestFor}</div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontFamily: MONO, fontSize: 10, color: '#0E7A4B' }}>{m.cost}</span>
                      <span style={{ fontSize: 10, color: C.text3 }}>{m.speed} {m.speed.length === 6 ? 'fastest' : m.speed.length === 4 ? 'fast' : 'medium'}</span>
                      {m.special && <span style={{ fontFamily: MONO, fontSize: 9, color: '#7A5A00', background: '#FFF8E1', padding: '1px 5px', borderRadius: 3 }}>{m.special}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: '8px 10px', background: '#F9F6F0', borderRadius: 5, fontSize: 11, color: C.text3, lineHeight: 1.5 }}>
              💡 <strong>Tip:</strong> DeepSeek V3 is the default — best quality/cost. Use Gemini Flash for very long texts or when you need web search. Use GPT-4o only for the hardest tasks.
            </div>
          </div>
        )}

        {/* Summary display */}
        {summary && (
          <div style={{
            padding: '10px 14px',
            background: C.bg,
            borderBottom: `1px solid ${C.border}`,
            fontSize: 12,
            lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 600, marginBottom: 4, color: C.ink }}>Thread summary:</div>
            <div dangerouslySetInnerHTML={{ __html: md(summary) }} />
          </div>
        )}

        {/* ── thread ─────────────────────────────────────────────────────── */}
        <div style={S.thread}>
          {/* Resumed conversation-store messages (A1) */}
          {resumed.map((m, i) => {
            if (m.turn_role === 'user') {
              return (
                <div key={`r${m.id}`} style={{ ...S.userRow, marginBottom: 24 }}>
                  <div style={S.userBubble} dangerouslySetInnerHTML={{ __html: md(m.content_md) }} />
                </div>
              );
            }
            if (m.turn_role !== 'assistant') return null;
            const prevUser = [...resumed.slice(0, i)].reverse().find((p) => p.turn_role === 'user');
            return (
              <div key={`r${m.id}`} style={{ ...S.agentRow, marginBottom: 24 }}>
                <div style={S.agentAvatar}>{mode === 'general' ? '◦' : '🏨'}</div>
                <div style={{ maxWidth: 'calc(100% - 44px)', flex: 1 }}>
                  <div style={S.agentBubble}>
                    <div dangerouslySetInnerHTML={{ __html: md(m.content_md) }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                    <button
                      onClick={() => saveToKB(prevUser?.content_md ?? '', m.content_md)}
                      title="Save this answer to the knowledge base"
                      style={S.actionBtn}
                    >
                      💾 Save to KB
                    </button>
                    <TierBadge tier={m.model_tier} />
                  </div>
                </div>
              </div>
            );
          })}
          {resumed.length > 0 && tickets.length === 0 && (
            <div style={{ textAlign: 'center', fontFamily: MONO, fontSize: 10, color: C.text3, margin: '4px 0 16px' }}>
              — resumed conversation · new messages continue this thread —
            </div>
          )}

          {tickets.length === 0 && resumed.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{ fontSize: 15, color: C.ink, marginBottom: 6 }}>
                {mode === 'second-brain'
                  ? `HOS · ${propertyLabel} · Ask anything.`
                  : 'LLM · multi-model · no business data.'}
              </div>
              <div style={{ fontSize: 12, color: C.text3, maxWidth: 460, margin: '0 auto', lineHeight: 1.6 }}>
                {mode === 'second-brain'
                  ? 'The Hospitality OS. Ask questions, give execution orders, request analysis. HOS consults the brain, executes via Felix, and routes decisions to your inbox.'
                  : 'Brainstorming, writing, coding, research — no business data read or written.'}
              </div>
            </div>
          )}

          {tickets.map((t, idx) => {
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
                    <div style={S.agentAvatar}>{mode === 'general' ? '◦' : '🏨'}</div>
                    <div style={{ maxWidth: 'calc(100% - 44px)', flex: 1 }}>
                      <div style={S.agentBubble}>
                        {isPending ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <span style={S.dot} />
                            <span style={{ ...S.dot, animationDelay: '0.2s' }} />
                            <span style={{ ...S.dot, animationDelay: '0.4s' }} />
                            <span style={{ marginLeft: 8, color: C.text2, fontSize: 12 }}>
                              {mode === 'general' ? 'Thinking…' : 'HOS is thinking…'}
                            </span>
                          </span>
                        ) : (
                          <div dangerouslySetInnerHTML={{ __html: md(split.agent) }} />
                        )}
                      </div>

                      {/* Action buttons + model tier per message (A5) */}
                      {!isPending && split.agent && (
                        <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                          <button
                            onClick={() => saveToKB(split.user, split.agent)}
                            title="Save this answer to the knowledge base"
                            style={S.actionBtn}
                          >
                            💾 Save to KB
                          </button>
                          <TierBadge tier={msgTiers[tierKey(split.agent)]} />
                        </div>
                      )}

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
              placeholder={mode === 'second-brain' ? `Ask HOS — ${propertyLabel}…` : 'Ask anything (model only)…'}
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
          <div style={S.hint}>
            {mode === 'general'
              ? 'Enter to send · Shift+Enter for new line · model only — nothing touches the business'
              : 'Enter to send · Shift+Enter for new line · HOS routes to the right place'}
          </div>
        </div>

        <style jsx global>{`
          @keyframes ccblink { 0%,80%,100% { opacity: 0.3 } 40% { opacity: 1 } }
        `}</style>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  shell: {
    display: 'flex', flexDirection: 'column',
    background: C.paper, border: `1px solid ${C.border}`, borderRadius: 2,
    minHeight: 520, maxHeight: '78vh', overflow: 'hidden',
    fontFamily: '-apple-system, BlinkMacSystemFont, Inter, system-ui, sans-serif',
    fontSize: 14, color: C.ink, position: 'relative' as const,
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
  iconBtn: {
    background: C.bg, color: C.text2, border: `1px solid ${C.border}`, borderRadius: 2,
    padding: '6px 10px', fontSize: 14, cursor: 'pointer', fontWeight: 600,
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
  actionBtn: {
    fontSize: 10,
    fontFamily: MONO,
    padding: '3px 8px',
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: 2,
    cursor: 'pointer',
    color: C.text2,
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
