'use client';

// components/chat/ConversationHistory.tsx
// Conversation history sidebar for CentralChat
// Brief: central-chat-missing-ui-features
// Shows past conversations, allows filtering and resuming threads

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
};

const MONO = 'JetBrains Mono, ui-monospace, monospace';

interface Conversation {
  id: string;
  mode: string;
  module_scope: string | null;
  title: string | null;
  summary_md: string | null;
  status: string;
  started_at: string;
  last_turn_at: string;
}

interface Props {
  onSelectConversation: (conversationId: string) => void;
  currentConversationId?: string | null;
  mode?: string;
  moduleScope?: string;
  propertyId?: number;
}

export default function ConversationHistory({
  onSelectConversation,
  currentConversationId,
  mode,
  moduleScope,
  propertyId,
}: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<string | null>(null);

  useEffect(() => {
    loadConversations();
    // Poll every 30s for new conversations
    const interval = setInterval(loadConversations, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMode, mode, moduleScope, propertyId]);

  const loadConversations = async () => {
    try {
      let query = supabase
        .from('v_chat_conversations')
        .select('*')
        .order('last_turn_at', { ascending: false })
        .limit(50);

      if (filterMode) {
        query = query.eq('mode', filterMode);
      }
      if (moduleScope) {
        query = query.eq('module_scope', moduleScope);
      }
      if (propertyId) {
        query = query.eq('property_id', propertyId);
      }

      const { data } = await query;
      setConversations((data as Conversation[]) ?? []);
    } catch (e) {
      console.error('Failed to load conversations:', e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso: string) => {
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
    return d.toLocaleDateString();
  };

  return (
    <div style={S.shell}>
      <div style={S.header}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Conversation history</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button
            onClick={() => setFilterMode(null)}
            style={{
              ...S.filterBtn,
              background: filterMode === null ? C.forest : C.bg,
              color: filterMode === null ? '#FFFFFF' : C.text2,
            }}
          >
            All
          </button>
          <button
            onClick={() => setFilterMode('second-brain')}
            style={{
              ...S.filterBtn,
              background: filterMode === 'second-brain' ? C.forest : C.bg,
              color: filterMode === 'second-brain' ? '#FFFFFF' : C.text2,
            }}
          >
            Second Brain
          </button>
          <button
            onClick={() => setFilterMode('general')}
            style={{
              ...S.filterBtn,
              background: filterMode === 'general' ? C.forest : C.bg,
              color: filterMode === 'general' ? '#FFFFFF' : C.text2,
            }}
          >
            General
          </button>
        </div>
      </div>

      <div style={S.list}>
        {loading && (
          <div style={{ padding: 20, textAlign: 'center', color: C.text3, fontSize: 12 }}>
            Loading…
          </div>
        )}

        {!loading && conversations.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: C.text3, fontSize: 12 }}>
            No conversations yet
          </div>
        )}

        {conversations.map((c) => {
          const isActive = c.id === currentConversationId;
          return (
            <button
              key={c.id}
              onClick={() => onSelectConversation(c.id)}
              style={{
                ...S.item,
                background: isActive ? C.bg : C.paper,
                borderLeft: isActive ? `3px solid ${C.forest}` : `3px solid transparent`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={S.modeIcon}>
                  {c.mode === 'general' ? '◦' : 'F'}
                </span>
                <span style={{ fontSize: 11, color: C.text3, fontFamily: MONO }}>
                  {c.mode === 'general' ? 'general' : c.module_scope || 'second-brain'}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: C.text3 }}>
                  {formatDate(c.last_turn_at)}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, lineHeight: 1.3 }}>
                {c.title || c.summary_md?.slice(0, 60) || 'Untitled conversation'}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  shell: {
    display: 'flex',
    flexDirection: 'column',
    background: C.paper,
    border: `1px solid ${C.border}`,
    borderRadius: 2,
    height: '100%',
    overflow: 'hidden',
  },
  header: {
    padding: '12px 14px',
    borderBottom: `1px solid ${C.border}`,
    background: C.paper,
  },
  filterBtn: {
    fontSize: 10,
    fontFamily: MONO,
    padding: '4px 8px',
    border: 0,
    borderRadius: 2,
    cursor: 'pointer',
    fontWeight: 600,
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    background: C.paper,
  },
  item: {
    width: '100%',
    textAlign: 'left',
    padding: '10px 12px',
    border: 0,
    borderBottom: `1px solid ${C.border}`,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  modeIcon: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    background: C.forest,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
};
