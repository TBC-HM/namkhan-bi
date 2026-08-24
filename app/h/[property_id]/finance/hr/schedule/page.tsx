// app/h/[property_id]/finance/hr/schedule/page.tsx — ADR-149
// PBS 2026-08-24: redesigned to current design system.
// Namkhan (260955): Planer + Dayview tabs. Donna (1000001): Dayview only (Factorial-fed).
// Sub-sub-strip (Planer / Dayview) rendered by nav-subgroups via DashboardPage.
import { DashboardPage } from '@/app/(cockpit)/_design';
import ScheduleTabContent from '@/app/operations/staff/_components/ScheduleTabContent';
import SchedulePlannerView from '@/app/finance/hr/schedule/SchedulePlannerView';
import { FINANCE_SUBPAGES } from '@/app/finance/_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DONNA_ID = 1000001;

interface Props {
  params: { property_id: string };
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function PropertyHrSchedulePage({ params, searchParams }: Props) {
  const pid = Number(params.property_id);
  const isDonna = pid === DONNA_ID;
  const tab = (searchParams.tab as string) ?? (isDonna ? 'dayview' : 'planer');
  const subPages = rewriteSubPagesForProperty(FINANCE_SUBPAGES, pid);

  const content = tab === 'dayview' ? (
    <ScheduleTabContent
      propertyId={pid}
      propertyLabel={isDonna ? 'Donna' : 'Namkhan'}
      searchParams={searchParams}
      subPagesOverride={subPages}
    />
  ) : (
    <div style={{ padding: '0 20px 20px' }}>
      <SchedulePlannerView propertyId={pid} isReadOnly={isDonna} />
    </div>
  );

  return (
    <DashboardPage
      title="HR · Schedule"
      subtitle="Staff scheduling · generate · review · publish"
      tabs={subPages.map((sp) => ({ key: sp.href, label: sp.label, href: sp.href }))}
    >
      {content}
    </DashboardPage>
  );
}
