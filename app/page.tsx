// app/page.tsx — HOME = chat with Felix (architect/lead).
// 2026-05-08 PBS directive: every dept landing IS the chat with that dept's HoD,
// and Home is the architect chat.
// The KPI dashboard previously at /overview stays accessible at /overview.

import ChatShell from '@/components/chat/ChatShell';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <ChatShell
      role="lead"
      displayName="Felix"
      dept="Architect"
      emoji="🏛"
      mentionNickname="felix"
      placeholder="Tell Felix what you need…"
    />
  );
}
