// app/cockpit/chat/page.tsx
// DeptEntry submitChat navigates here with ?q=...&dept=...&role=...&name=...&emoji=...
// Restores the full-screen chat window using ChatShell.
// Server Component reads searchParams → passes to client wrapper → ChatShell renders.
// initialInput pre-fills the question the user typed.
// 2026-08-03: restored after fleet/chat redirect broke the brain button.

import ChatShell from '@/components/chat/ChatShell';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function CockpitChatPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    dept?: string;
    role?: string;
    name?: string;
    emoji?: string;
    label?: string;
    project?: string;
  };
}) {
  const role        = searchParams.role  ?? 'lead';
  const displayName = searchParams.name  ?? 'Felix';
  const emoji       = searchParams.emoji ?? '🌐';
  const dept        = searchParams.dept  ?? searchParams.label ?? '';
  const initialInput = searchParams.q   ?? '';

  return (
    <div style={{ minHeight: '100vh', background: '#0D0D0D' }}>
      <ChatShell
        role={role}
        displayName={displayName}
        emoji={emoji}
        dept={dept}
        initialInput={initialInput}
        storageKey={`cockpit.chat.${role}`}
      />
    </div>
  );
}
