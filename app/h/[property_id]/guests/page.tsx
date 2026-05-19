// app/h/[property_id]/guests/page.tsx
// NEW canonical Guests section page (separate from singular /guest DeptEntry).

import { notFound } from 'next/navigation';
import SectionPage from '../_shared/SectionPage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function GuestsPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) notFound();
  return (
    <SectionPage
      propertyId={propertyId}
      section="guests"
      pageSlug="guests"
      title="Guests"
      subtitle="country × channel · repeat · stay shape"
    />
  );
}
