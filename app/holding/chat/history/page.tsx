'use client';

// app/holding/chat/history/page.tsx
// Brief: central-chat-missing-ui-features (2026-08-05)
// Conversation history browser + viewer with model tier badges

import { useState } from 'react';
import { DashboardPage } from '@/app/(cockpit)/_design';
import ConversationHistory from '@/components/chat/ConversationHistory';
import ConversationViewer from '@/components/chat/ConversationViewer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TABS = [
  { key: 'back', label: '← HoD', href: '/holding' },
  { key: 'chat', label: 'Chat', href: '/holding/chat' },
  { key: 'history', label: 'History', href: '/holding/chat/history', active: true },
];

export default function ChatHistoryPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <DashboardPage
      title="Chat History"
      subtitle="Past conversations with Felix — click to view with model tier badges"
      tabs={TABS}
    >
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: selectedId ? '1fr 2fr' : '1fr', gap: 16 }}>
        <div>
          <ConversationHistory onSelectConversation={(id) => setSelectedId(id)} />
        </div>
        {selectedId && (
          <div>
            <ConversationViewer conversationId={selectedId} />
          </div>
        )}
      </div>
    </DashboardPage>
  );
}