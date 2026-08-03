// app/holding/brain/ask/page.tsx
// Document brain Q&A — citation-focused view backed by /api/brain/ask.
// Searches DMS documents, contracts, SOPs with property-scoped isolation.
// Separate from the main Felix chat at /holding/chat.
// Accessible from brain settings (/h/[pid]/settings/brain) and direct link.

import BrainAskPage from '../../chat/_components/BrainAskPage';

export const dynamic = 'force-dynamic';

export default function BrainAskRoute({
  searchParams,
}: {
  searchParams: { q?: string; pid?: string; dept?: string; role?: string; label?: string };
}) {
  const propertyId = searchParams.pid != null ? (Number(searchParams.pid) || null) : null;
  const dept = searchParams.dept ?? searchParams.role ?? 'lead';
  const initialQ = searchParams.q ?? '';
  return <BrainAskPage initialQuestion={initialQ} propertyId={propertyId} dept={dept} />;
}
