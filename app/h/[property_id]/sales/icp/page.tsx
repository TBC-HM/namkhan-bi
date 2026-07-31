// app/h/[property_id]/sales/icp/page.tsx
// PBS 2026-07-11 pm — Property-scoped delegate for Sales · ICP Segments.
// 2026-07-31 fix (standing builder): app/sales/icp/page.tsx takes no props, so
// passing propertyId broke tsc on main. Resolved with the standard A10 pattern
// (yt-completion / marketing-website): Namkhan → redirect to the live legacy
// surface, Donna → DeptSubpageStub until a Donna ICP surface exists.
import { redirect } from 'next/navigation';
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NAMKHAN = 260955;

export default async function DelegateSalesIcp({ params }: { params: Promise<{ property_id: string }> }) {
  const { property_id } = await params;
  const pid = Number(property_id);
  if (pid === NAMKHAN) {
    redirect('/sales/icp');
  }
  return (
    <DeptSubpageStub
      propertyId={pid}
      deptLabel="Sales"
      routeLabel="ICP Segments"
      namkhanPath="/sales/icp"
      hint="Donna ICP segments land here once the Donna sales module is wired — ICP data is property-scoped."
    />
  );
}
