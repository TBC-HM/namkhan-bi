// app/holding/brain/ask/page.tsx
// Document brain Q&A — citation-focused view backed by /api/brain/ask.
// Searches DMS documents, contracts, SOPs with property-scoped isolation.
// Separate from the main Felix chat at /holding/chat.
// Accessible from brain settings (/h/[pid]/settings/brain) and direct link.
//
// ADR-238 (finding #79): a missing ?pid used to yield null, and null means NO FILTER in
// fn_brain_search — so this page searched Namkhan + Donna + holding at once while its own footer
// labelled the scope "holding". Absent pid now resolves to holding (0). ?pid=-1 is the explicit
// opt-in to a cross-property read.

import BrainAskPage from '../../chat/_components/BrainAskPage';

export const dynamic = 'force-dynamic';

export default function BrainAskRoute({
  searchParams,
}: {
  searchParams: { q?: string; pid?: string; dept?: string; role?: string; label?: string };
}) {
  const pidRaw = searchParams.pid;
  const pidNum = pidRaw == null || pidRaw === '' ? 0 : Number(pidRaw);
  const propertyId = Number.isFinite(pidNum) ? pidNum : 0;   // ADR-238: default-deny -> holding
  const dept = searchParams.dept ?? searchParams.role ?? 'lead';
  const initialQ = searchParams.q ?? '';
  return <BrainAskPage initialQuestion={initialQ} propertyId={propertyId} dept={dept} />;
}
