// app/holding/chat/page.tsx
// Central chat — Felix (Second Brain) + General (model-only) mode toggle.
// This is the main conversational interface: ask anything, switch modes freely.
// Receives ?pid= from DeptEntry so Felix knows which tenant context to load.
// Document-only brain Q&A (citation view) lives at /holding/brain/ask.

import CentralChat from '@/components/chat/CentralChat';

export const dynamic = 'force-dynamic';

export default function HoldingChatPage({
  searchParams,
}: {
  searchParams: { pid?: string; dept?: string };
}) {
  const propertyId = searchParams.pid ? (Number(searchParams.pid) || undefined) : undefined;
  const moduleScope = searchParams.dept ?? undefined;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 20px 60px' }}>
      <CentralChat
        mode="second-brain"
        moduleScope={moduleScope}
        propertyId={propertyId}
      />
    </div>
  );
}
