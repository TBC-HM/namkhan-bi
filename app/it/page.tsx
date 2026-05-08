// app/it/page.tsx — IT dept landing = chat with Captain Kit.
// 2026-05-08 PBS directive: every dept landing IS the chat with that dept's HoD.
// Detailed cockpit (tickets / agents / deploys / health) lives at /cockpit.

import ChatShell from '@/components/chat/ChatShell';

export const dynamic = 'force-dynamic';

export default function ItLanding() {
  return (
    <ChatShell
      role="it_manager"
      displayName="Captain Kit"
      dept="IT"
      emoji="🧭"
      mentionNickname="kit"
      placeholder="Tell Kit what's broken or needs building…"
    />
  );
}
