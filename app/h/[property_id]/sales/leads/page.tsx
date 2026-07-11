// app/h/[property_id]/sales/leads/page.tsx
// PBS 2026-07-11 pm — ADR-147. Donna sales leads delegate.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaSalesLeads({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Sales"
      routeLabel="Leads"
      namkhanPath="/sales/leads"
      hint="Donna leads pipeline activates when Sales HoD Faro is authenticated to Donna scrapers + inbound sources."
    />
  );
}
