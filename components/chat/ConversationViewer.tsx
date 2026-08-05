'use client';

// components/chat/ConversationViewer.tsx
// Brief: central-chat-missing-ui-features (2026-08-05)
// View a single conversation with all messages + model tier badges
// Enhanced with: Summarize thread + Save to KB buttons

import { useEffect, useState } from 'react';

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

export interface ConversationViewerProps {
  conversationId: string;
}

type Message = {
  id: number;
  turn_role: string;
  agent_role: string | null;
  content_md: string;
  model_tier: string | null;
  provider: string | null;
  model_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  latency_ms: number | null;
  cost_usd: number | null;
  created_at: string;
};

type Conversation = {
  id: string;
  mode: string;
  module_scope: string | null;
  title: string | null;
  summary_md: string | null;
  started_at: string;
  last_turn_at: string;
};

const getTierBadge = (tier: string | null) => {
  if (!tier) return null;
  if (tier === 'fast') return { emoji: '⚡', label: 'fast', color: C.sand };
  if (tier === 'reasoning') return { emoji: '🧠', label: 'reasoning', color: C.forest };
  if (tier === 'long-context') return { emoji: '📚', label: 'long-context', color: '#6B5B95' };
  return { emoji: '◦', label: tier, color: C.text3 };
};

// Minimal markdown → HTML (escape first)
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

export default function ConversationViewer({ conversationId }: ConversationViewerProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [savingToKB, setSavingToKB] = useState<number | null>(null);

  const loadConversation = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/cockpit/chat?conversation_id=${conversationId}`, { cache: 'no-store' });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Failed to load conversation');
        return;
      }

      setConversation(data.conversation);
      setMessages(data.messages ?? []);
      setSummary(data.conversation?.summary_md || null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const handleSummarize = async () => {
    setSummarizing(true);
    try {
      const res = await fetch('/api/cockpit/chat/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId }),
      });
      const data = await res.json();
      if (data.ok && data.summary) {
        setSummary(data.summary);
      } else {
        alert('Failed to summarize: ' + (data.error || 'unknown'));
      }
    } catch (e) {
      alert('Failed to summarize: ' + (e instanceof Error ? e.message : 'unknown'));
    } finally {
      setSummarizing(false);
    }
  };

  const handleSaveToKB = async (msgId: number, question: string, answer: string) => {
    setSavingToKB(msgId);
    try {
      const res = await fetch('/api/cockpit/chat/save-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          answer_md: answer,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        alert('✓ Saved to knowledge base');
      } else {
        alert('Failed to save: ' + (data.error || 'unknown'));
      }
    } catch (e) {
      alert('Failed to save: ' + (e instanceof Error ? e.message : 'unknown'));
    } finally {
      setSavingToKB(null);
    }
  };

  if (loading) {
    return (
      <div style={S.container}>
        <div style={{ padding: 20, textAlign: 'center', color: C.text3 }}>Loading conversation...</div>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div style={S.container}>
        <div style={{ padding: 20, textAlign: 'center', color: C.terracotta }}>
          {error || 'Conversation not found'}
        </div>
      </div>
    );
  }

  return (
    <div style={S.container}>
      <div style={S.header}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>{conversation.title || '(untitled)'}</div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: C.text3, marginTop: 2 }}>
            {conversation.mode} · {conversation.module_scope || 'global'}
          </div>
        </div>
        <button
          onClick={handleSummarize}
          disabled={summarizing}
          style={{
            background: summarizing ? C.border : C.forest,
            color: '#FFFFFF',
            border: 0,
            borderRadius: 2,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 600,
            cursor: summarizing ? 'default' : 'pointer',
            opacity: summarizing ? 0.6 : 1,
          }}
        >
          {summarizing ? 'Summarizing...' : '✨ Summarize Thread'}
        </button>
      </div>

      {summary && (
        <div style={S.summary}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 6, letterSpacing: 0.5 }}>
            THREAD SUMMARY
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: C.ink, whiteSpace: 'pre-wrap' }}>
            {summary}
          </div>
        </div>
      )}

      <div style={S.thread}>
        {messages.map((msg, idx) => {
          const isUser = msg.turn_role === 'user';
          const tierBadge = getTierBadge(msg.model_tier);
          const prevMsg = idx > 0 ? messages[idx - 1] : null;
          const userQuestion = prevMsg && prevMsg.turn_role === 'user' ? prevMsg.content_md : '';

          return (
            <div key={msg.id} style={{ marginBottom: 24 }}>
              {isUser ? (
                <div style={S.userRow}>
                  <div style={S.userBubble} dangerouslySetInnerHTML={{ __html: md(msg.content_md) }} />
                </div>
              ) : (
                <div style={S.agentRow}>
                  <div style={S.agentAvatar}>F</div>
                  <div style={{ maxWidth: 'calc(100% - 44px)' }}>
                    <div style={S.agentBubble} dangerouslySetInnerHTML={{ __html: md(msg.content_md) }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      {tierBadge && (
                        <div
                          style={{
                            fontSize: 10,
                            fontFamily: MONO,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                            background: 'rgba(0,0,0,0.03)',
                            border: `1px solid ${C.border}`,
                            borderRadius: 2,
                          }}
                        >
                          <span>{tierBadge.emoji}</span>
                          <span style={{ color: tierBadge.color, fontWeight: 600 }}>{tierBadge.label}</span>
                          {msg.latency_ms && (
                            <span style={{ color: C.text3, marginLeft: 4 }}>
                              · {(msg.latency_ms / 1000).toFixed(1)}s
                            </span>
                          )}
                        </div>
                      )}
                      <button
                        onClick={() => handleSaveToKB(msg.id, userQuestion, msg.content_md)}
                        disabled={savingToKB === msg.id}
                        style={{
                          fontSize: 10,
                          fontFamily: MONO,
                          background: savingToKB === msg.id ? C.border : C.paper,
                          color: savingToKB === msg.id ? C.text3 : C.forest,
                          border: `1px solid ${C.border}`,
                          borderRadius: 2,
                          padding: '3px 8px',
                          cursor: savingToKB === msg.id ? 'default' : 'pointer',
                          fontWeight: 600,
                        }}
                        title="Save this answer to the knowledge base as a verified answer"
                      >
                        {savingToKB === msg.id ? 'Saving...' : '💾 Save to KB'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    background: C.paper,
    border: `1px solid ${C.border}`,
    borderRadius: 2,
    minHeight: 400,
    maxHeight: '80vh',
    overflow: 'hidden',
    fontFamily: '-apple-system, BlinkMacSystemFont, Inter, system-ui, sans-serif',
    fontSize: 14,
    color: C.ink,
  },
  header: {
    padding: '12px 16px',
    borderBottom: `1px solid ${C.border}`,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  summary: {
    padding: '12px 16px',
    background: C.bg,
    borderBottom: `1px solid ${C.border}`,
    flexShrink: 0,
  },
  thread: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 18px',
  },
  userRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  userBubble: {
    background: C.forest,
    color: '#FFFFFF',
    padding: '9px 13px',
    borderRadius: '12px 12px 3px 12px',
    maxWidth: '75%',
    fontSize: 14,
    lineHeight: 1.5,
  },
  agentRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
  },
  agentAvatar: {
    width: 26,
    height: 26,
    borderRadius: '50%',
    background: C.forest,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  agentBubble: {
    background: C.bg,
    padding: '10px 14px',
    borderRadius: '12px 12px 12px 3px',
    fontSize: 14,
    lineHeight: 1.6,
    color: C.ink,
  },
};