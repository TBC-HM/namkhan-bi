// components/cockpit/AgentChatShell.tsx
// Prompt 3 — agent-chat-spawn. Client-side chat UI for any agent.
//
// Talks to /api/cockpit/chat-v2 (edge runtime + streaming).
// Conversation is kept in component state (NOT persisted) until the
// governance.agent_chats migration is applied. See migration ticket
// chat-spawn-persistence below.

'use client';

import { useState, useRef, useEffect } from 'react';

interface AgentHeader {
  role: string;
  display_name: string;
  avatar: string | null;
  color: string | null;
  dept: string | null;
  tagline: string | null;
  reports_to: string | null;
  scope_label: string;
}

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  agent: AgentHeader;
  propertyId: number;
}

export default function AgentChatShell({ agent, propertyId }: Props) {
  const [history, setHistory] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' });
  }, [history, streaming]);

  async function send() {
    const message = input.trim();
    if (!message || streaming) return;
    setInput('');
    setError(null);
    setStreaming(true);

    const userTurn: Msg = { role: 'user', content: message };
    const baseHistory: Msg[] = [...history, userTurn];
    setHistory(baseHistory);

    // Add an empty assistant turn that we'll fill from the stream
    setHistory((h) => [...h, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/cockpit/chat-v2', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message,
          role: agent.role,
          property_id: propertyId,
          conversation_history: baseHistory,
        }),
      });

      if (!res.ok || !res.body) {
        let detail = res.statusText;
        try {
          const j = await res.json();
          detail = j.error ?? j.detail ?? detail;
        } catch { /* ignore */ }
        throw new Error(`chat-v2 ${res.status}: ${detail}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let assistantText = '';

      // Anthropic SSE: lines like `event: content_block_delta\n` and
      // `data: {...}\n\n`. We only care about content_block_delta with
      // text deltas.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const evt = JSON.parse(payload);
            if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
              assistantText += evt.delta.text;
              setHistory((h) => {
                const copy = [...h];
                copy[copy.length - 1] = { role: 'assistant', content: assistantText };
                return copy;
              });
            }
          } catch {
            // ignore malformed line
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setHistory((h) => h.slice(0, -1)); // drop the empty assistant turn
    } finally {
      setStreaming(false);
    }
  }

  function initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s.charAt(0).toUpperCase())
      .join('');
  }

  const swatch = agent.color ?? 'var(--accent, #a8854a)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '70vh' }}>
      {/* Agent header strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '12px 16px',
          background: 'var(--surf-1, #0f0d0a)',
          border: '1px solid var(--border-1, #1f1c15)',
          borderRadius: 10,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            background: swatch,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--surf-0, #0a0a0a)',
            fontWeight: 700,
            fontFamily: "'Fraunces', Georgia, serif",
          }}
          aria-hidden
        >
          {agent.avatar ?? initials(agent.display_name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, color: 'var(--text-0, #e9e1ce)' }}>
            {agent.display_name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-mute, #9b907a)', letterSpacing: '0.05em' }}>
            {agent.dept ? `${agent.dept} · ` : ''}{agent.scope_label}
            {agent.reports_to && (
              <> · Reports to: <span style={{ color: 'var(--text-dim, #7d7565)' }}>{agent.reports_to}</span></>
            )}
          </div>
        </div>
      </div>

      {/* Transcript */}
      <div
        ref={transcriptRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {history.length === 0 && (
          <div style={{ color: 'var(--text-mute, #9b907a)', fontStyle: 'italic', padding: '8px 4px', fontSize: 13 }}>
            Start the conversation with {agent.display_name}.{agent.tagline ? ` (${agent.tagline})` : ''}
          </div>
        )}
        {history.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '72%',
              background: m.role === 'user' ? swatch : 'var(--surf-1, #0f0d0a)',
              color: m.role === 'user' ? 'var(--surf-0, #0a0a0a)' : 'var(--text-0, #e9e1ce)',
              padding: '10px 14px',
              borderRadius: 10,
              border: m.role === 'assistant' ? '1px solid var(--border-1, #1f1c15)' : 'none',
              fontSize: 14,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {m.content || (streaming && i === history.length - 1 ? '…' : '')}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ color: '#c0584c', fontSize: 12, padding: '4px 8px' }}>
          {error}
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
          }}
          placeholder={agent.tagline ?? `Ask ${agent.display_name}…`}
          rows={2}
          disabled={streaming}
          style={{
            flex: 1,
            resize: 'none',
            background: 'var(--surf-1, #0f0d0a)',
            color: 'var(--text-0, #e9e1ce)',
            border: '1px solid var(--border-2, #2a261d)',
            borderRadius: 8,
            padding: '10px 12px',
            fontFamily: "'Inter Tight', system-ui, sans-serif",
            fontSize: 14,
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || streaming}
          style={{
            background: swatch,
            color: 'var(--surf-0, #0a0a0a)',
            border: 'none',
            borderRadius: 8,
            padding: '10px 18px',
            fontWeight: 600,
            fontSize: 13,
            cursor: streaming ? 'wait' : 'pointer',
            opacity: !input.trim() || streaming ? 0.5 : 1,
          }}
        >
          {streaming ? '…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
