'use client';

// components/chat/ConversationHistory.tsx
// Brief: central-chat-missing-ui-features (2026-08-05)
// Conversation history browser — reads v_chat_conversations via GET /api/cockpit/chat?list=1

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://build-placeholder.supabase.co'),
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'build-placeholder-anon'),
);

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

export interface ConversationHistoryProps {
  mode?: string | null;
  moduleScope?: string | null;
  propertyId?: number | null;
  onSelectConversation?: (conversationId: string) => void;
}

type Conversation = {
  id: string;
  property_id: number | null;
  mode: string;
  module_scope: string | null;
  title: string | null;
  summary_md: string | null;
  status: string;
  started_at: string;
  last_turn_at: string;
};

export default function ConversationHistory({
  mode,
  moduleScope,
  propertyId,
  onSelectConversation,
}: ConversationHistoryProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ list: '1', limit: '50' });
      if (mode) params.set('mode', mode);
      if (moduleScope) params.set('module_scope', moduleScope);
      if (propertyId != null) params.set('property_id', String(propertyId));

      const res = await fetch(`/api/cockpit/chat?${params}`, { cache: 'no-store' });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error ?? 'Failed to load conversations');
        return;
      }
      
      setConversations(data.conversations ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, moduleScope, propertyId]);

  const formatDate = (iso: string): string => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getModeBadge = (m: string) => {
    if (m === 'second-brain') return { label: 'Brain', color: C.forest };
    if (m === 'general') return { label: 'General', color: C.sand };
    return { label: m, color: C.text3 };
  };

  if (loading) {
    return (
      <div style={S.container}>
        <div style={{ ...S.header, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Conversation History</div>
        </div>
        <div style={{ padding: 20, textAlign: 'center', color: C.text3, fontSize: 13 }}>
          Loading conversations...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={S.container}>
        <div style={{ ...S.header, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Conversation History</div>
        </div>
        <div style={{ padding: 20, textAlign: 'center', color: C.terracotta, fontSize: 12 }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div style={S.container}>
      <div style={{ ...S.header, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Conversation History</div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: C.text3 }}>
          {conversations.length} conversation{conversations.length === 1 ? '' : 's'}
        </div>
      </div>

      <div style={S.list}>
        {conversations.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: C.text3, fontSize: 13 }}>
            No conversations yet
          </div>
        ) : (
          conversations.map((conv) => {
            const badge = getModeBadge(conv.mode);
            return (
              <div
                key={conv.id}
                style={S.item}
                onClick={() => onSelectConversation?.(conv.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      color: '#FFFFFF',
                      background: badge.color,
                      borderRadius: 2,
                      padding: '2px 6px',
                    }}
                  >
                    {badge.label.toUpperCase()}
                  </div>
                  {conv.module_scope && (
                    <div
                      style={{
                        fontFamily: MONO,
                        fontSize: 9,
                        color: C.text3,
                        letterSpacing: 0.3,
                      }}
                    >
                      {conv.module_scope}
                    </div>
                  )}
                  <div
                    style={{
                      marginLeft: 'auto',
                      fontFamily: MONO,
                      fontSize: 9,
                      color: C.text3,
                    }}
                  >
                    {formatDate(conv.last_turn_at)}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.4, fontWeight: 500 }}>
                  {conv.title || '(untitled)'}
                </div>
                {conv.summary_md && (
                  <div style={{ fontSize: 11, color: C.text3, lineHeight: 1.5, marginTop: 4 }}>
                    {conv.summary_md.slice(0, 100)}
                    {conv.summary_md.length > 100 ? '...' : ''}
                  </div>
                )}
              </div>
            );
          })
        )}
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
    maxHeight: '78vh',
    overflow: 'hidden',
    fontFamily: '-apple-system, BlinkMacSystemFont, Inter, system-ui, sans-serif',
  },
  header: {
    padding: '10px 16px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 0',
  },
  item: {
    padding: '10px 16px',
    borderBottom: `1px solid ${C.border}`,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
};