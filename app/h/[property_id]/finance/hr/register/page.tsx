// app/h/[property_id]/finance/hr/register/page.tsx — property-scoped Staff Register
// PBS 2026-08-25: stub page to resolve 404 on HR sub-strip Register tab.
// Consistent with other HR sub-pages: Finance top-level as main strip,
// findSubGroup returns HR sub-group → HR sub-pages as sub-strip.
import { notFound } from 'next/navigation';
import { DashboardPage } from '@/app/(cockpit)/_design';
import { financeSubPagesForProperty } from '@/app/finance/_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KNOWN_LABEL: Record<number, string> = { 260955: 'Namkhan', 1000001: 'Donna' };

export default async function PropertyHrRegisterPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (!KNOWN_LABEL[propertyId]) notFound();
  const subPages = financeSubPagesForProperty(propertyId);
  return (
    <DashboardPage
      title="HR · Register"
      subtitle="Staff directory and employment register"
      tabs={subPages.map(s => ({ key: s.href, label: s.label, href: s.href }))}
    >
      <div style={{ padding: '20px', gridColumn: '1 / -1', color: 'var(--ink-mute)', fontSize: 14 }}>
        Staff register coming soon.
      </div>
    </DashboardPage>
  );
}
