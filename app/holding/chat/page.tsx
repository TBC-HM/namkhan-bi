// app/holding/chat/page.tsx
// Brain chat destination — receives params from /cockpit/chat redirect.
// Uses CentralChat (Central Chat v1, brief central-chat-v1) — NOT the legacy ChatShell.
// Felix is the sole dispatcher; moduleScope narrows the knowledge context.
// 2026-08-03: corrected to use the new brain-integrated CentralChat component.

import CentralChat from '@/components/chat/CentralChat';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// dept → property context mapping
const DEPT_PROPERTY: Record<string, number | undefined> = {
  sales:      260955,
  revenue:    260955,
  marketing:  260955,
  operations: 260955,
  finance:    260955,
  legal:      260955,
  // holding-level depts have no property scope
  architect:  undefined,
  lead:       undefined,
  it:         undefined,
  it_manager: undefined,
};

export default function HoldingChatPage({
  searchParams,
}: {
  searchParams: {
    q?: string; dept?: string; role?: string;
    name?: string; emoji?: string; label?: string;
  };
}) {
  const dept        = searchParams.dept ?? searchParams.role ?? 'lead';
  const moduleScope = dept;
  const propertyId  = DEPT_PROPERTY[dept];

  return (
    <div style={{ minHeight: '100vh', background: '#F4EFE2' }}>
      <CentralChat
        mode="second-brain"
        moduleScope={moduleScope}
        propertyId={propertyId}
      />
    </div>
  );
}
