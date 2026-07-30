// app/h/[property_id]/sales/proposals/[id]/edit/page.tsx
// Sales brief A5 (2026-07-30) — URL-law passthrough (claude_md §0.7 / ADR-168):
// the proposals composer under the property-scoped tree. The composer itself is
// property-agnostic (loads the proposal by id); this delegate just keeps the
// /h/[property_id]/sales/* strip free of 404s / off-tenant hops.
import ComposerPage from '@/app/sales/proposals/[id]/edit/page';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PropertyProposalComposerPage(
  { params }: { params: { property_id: string; id: string } },
) {
  return <ComposerPage params={{ id: params.id }} />;
}
