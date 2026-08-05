'use client';
// app/holding/chat/_components/BrainAskPage.tsx
// Standalone brain Q&A interface — the correct target for ASK THE BRAIN button.
// Replaced with CentralChat per central-chat-v1 binding end-state (2026-08-05).

import CentralChat from '@/components/chat/CentralChat';

type Props = {
  initialQuestion?: string;
  propertyId?: number;
  dept?: string;
};

export default function BrainAskPage({ initialQuestion, propertyId, dept }: Props) {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f8f9fa' }}>
      {initialQuestion ? (
        <div style={{ padding: '12px 16px', background: '#fff', borderBottom: '1px solid #ddd', fontSize: 13 }}>
          <strong>Question:</strong> {initialQuestion}
        </div>
      ) : null}
      <CentralChat 
        mode="second-brain"
        moduleScope="brain"
        propertyId={propertyId || 0}
      />
    </div>
  );
}
