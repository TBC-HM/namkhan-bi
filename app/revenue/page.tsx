// app/revenue/page.tsx — Revenue dept landing = chat with Vector.
// 2026-05-08 PBS directive: dept entry IS the chat. Existing dashboards
// remain reachable at /revenue/pulse, /revenue/pace, /revenue/channels, etc.

import ChatShell from '@/components/chat/ChatShell';

export const dynamic = 'force-dynamic';

export default function RevenueLanding() {
  return (
    <ChatShell
      role="revenue_hod"
      displayName="Vector"
      dept="Revenue"
      emoji="📈"
      mentionNickname="vector"
      placeholder="Ask Vector about Pulse, pricing, channel mix, parity…"
    />
  );
}
