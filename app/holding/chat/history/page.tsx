// app/holding/chat/history/page.tsx
// Brief: central-chat-missing-ui-features (2026-08-05)
// Conversation history browser page — showcases the ConversationHistory component

import { DashboardPage } from '@/app/(cockpit)/_design';
import ConversationHistory from '@/components/chat/ConversationHistory';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TABS = [
  { key: 'back', label: '← HoD', href: '/holding' },
  { key: 'chat', label: 'Chat', href: '/holding/chat' },
  { key: 'history', label: 'History', href: '/holding/chat/history', active: true },
];

export default function ChatHistoryPage() {
  return (
    <DashboardPage
      title="Chat History"
      subtitle="Past conversations with Felix — filter by mode, module, or property"
      tabs={TABS}
    >
      <div style={{ gridColumn: '1 / -1', maxWidth: 800, margin: '0 auto' }}>
        <ConversationHistory />
      </div>
    </DashboardPage>
  );
}