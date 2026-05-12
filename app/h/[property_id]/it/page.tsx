// app/h/[property_id]/it/page.tsx
// v2 (2026-05-12): For Namkhan, redirects to the legacy /it page (which
// has the full live dashboard wired). For Donna (and future properties) we
// render <DeptEntry> with a property-scoped cfg — HoD name swapped to the
// property's actual HoD (Leo for Donna marketing, etc.), data emptied
// because there is no PMS feed yet, hrefs rewritten to /h/[id]/...
// Theme propagates automatically via /h/[property_id]/layout.tsx ThemeInjector.

import DeptEntry from '@/components/dept-entry/DeptEntry';
import { getDeptCfg, NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function ItShim({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/it');
  const cfg = getDeptCfg('it', propertyId);
  return <DeptEntry cfg={cfg} />;
}
