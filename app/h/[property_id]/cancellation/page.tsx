// app/h/[property_id]/cancellation/page.tsx
// NEW canonical Cancellation section page.
// Renders all registered cancellation containers via SectionPage scaffold.

import { notFound } from 'next/navigation';
import SectionPage from '../_shared/SectionPage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function CancellationPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) notFound();
  return (
    <SectionPage
      propertyId={propertyId}
      section="cancellation"
      pageSlug="cancellation"
      title="Cancellation"
      subtitle="cancel rate · no-show · lead time · revenue impact"
    />
  );
}
