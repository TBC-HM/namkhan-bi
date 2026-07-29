// app/h/[property_id]/sales/proposals/page.tsx
// Proposals brief A4 (2026-07-29) — URL-law delegate (claude_md §0.7 / ADR-168).
// Property-scoped mount of the flat proposals index; /sales/proposals stays as
// the Namkhan legacy path. No hardcoded property_id — route param only.
import SalesProposalsIndexPage from '@/app/sales/proposals/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PropertyProposalsPage({ params }: { params: { property_id: string } }) {
  const pid = Number(params.property_id);
  return <SalesProposalsIndexPage propertyId={Number.isFinite(pid) ? pid : undefined} />;
}
