// app/holding/chat/page.tsx
// Brain Q&A destination — receives params from /cockpit/chat redirect.
// ?pid=<propertyId> now passed directly by DeptEntry (2026-08-03 fix).
// Queries the DOCUMENT BRAIN (/api/brain/ask) — NOT Felix's general chat.
// propertyId from URL ensures correct tenant brain isolation.

import BrainAskPage from './_components/BrainAskPage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function HoldingChatPage({
  searchParams,
}: {
  searchParams: {
    q?: string; pid?: string; dept?: string; role?: string; label?: string;
  };
}) {
  // pid is now passed directly from DeptEntry — prefer it over dept-based mapping
  const propertyId = searchParams.pid != null
    ? (Number(searchParams.pid) || null)   // 0 = holding brain (null)
    : null;                                 // fallback = holding brain

  const dept = searchParams.dept ?? searchParams.role ?? 'lead';
  const initialQ = searchParams.q ?? '';

  return <BrainAskPage initialQuestion={initialQ} propertyId={propertyId} dept={dept} />;
}
