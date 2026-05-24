import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// Donna Finance Reports → unified property-scoped reports surface.
// Same UX as Revenue Reports — kept here so the FINANCE_SUBPAGES Reports
// tab resolves to the right place on Donna.
export default function DonnaFinanceReportsRedirect({ params }: { params: { property_id: string } }) {
  redirect(`/h/${params.property_id}/reports?dept=finance`);
}
