// app/holding/chat/page.tsx
// Brain Q&A destination — receives params from /cockpit/chat redirect.
// Queries the DOCUMENT BRAIN (/api/brain/ask) not Felix's general chat.
// The brain searches DMS documents, contracts, SOPs, certifications via embeddings.
// Question pre-filled from ?q= URL param.
// 2026-08-03: correct target for ASK THE BRAIN button.

import BrainAskPage from './_components/BrainAskPage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// dept → property_id mapping for brain isolation
const DEPT_PROPERTY: Record<string, number | null> = {
  sales:      260955,
  revenue:    260955,
  marketing:  260955,
  operations: 260955,
  finance:    260955,
  legal:      260955,
  architect:  null,
  lead:       null,
  it:         null,
  it_manager: null,
};

export default function HoldingChatPage({
  searchParams,
}: {
  searchParams: { q?: string; dept?: string; role?: string; label?: string };
}) {
  const dept        = searchParams.dept ?? searchParams.role ?? 'lead';
  const propertyId  = DEPT_PROPERTY[dept] ?? null;
  const initialQ    = searchParams.q ?? '';

  return <BrainAskPage initialQuestion={initialQ} propertyId={propertyId} dept={dept} />;
}
