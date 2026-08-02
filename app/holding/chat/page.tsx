// app/holding/chat/page.tsx
// Live full-screen chat — receives params from /cockpit/chat redirect.
// Renders ChatShell with the correct agent and pre-fills the question via initialInput.
// Outside legacy trees — no orphan-checker constraint applies here.
// 2026-08-03: proper home for the brain chat button target.

import ChatShell from '@/components/chat/ChatShell';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function HoldingChatPage({
  searchParams,
}: {
  searchParams: {
    q?: string; dept?: string; role?: string;
    name?: string; emoji?: string; label?: string;
  };
}) {
  const role         = searchParams.role  ?? 'lead';
  const displayName  = searchParams.name  ?? 'Felix';
  const emoji        = searchParams.emoji ?? '🌐';
  const dept         = searchParams.dept  ?? searchParams.label ?? '';
  const initialInput = searchParams.q    ?? '';

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
