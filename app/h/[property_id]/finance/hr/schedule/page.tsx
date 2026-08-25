// app/h/[property_id]/finance/hr/schedule/page.tsx — ADR-149
// PBS 2026-08-24: redesigned to current design system.
// PBS 2026-08-25: tabs use HR sub-group (not Finance top-level) so the 3-strip
//   layout is: TopDeptStrip | HR sub-pages (tabs prop) | Planer·Dayview (findSubGroup).
// Namkhan (260955): Planer + Dayview tabs. Donna (1000001): Dayview only (Factorial-fed).
// Dayview returns ScheduleTabContent directly (avoids double-DashboardPage nesting).
import { DashboardPage } from '@/app/(cockpit)/_design';
import ScheduleTabContent from '@/app/operations/staff/_components/ScheduleTabContent';
import SchedulePlannerView from '@/app/finance/hr/schedule/SchedulePlannerView';
import { NAV_SUBGROUPS } from '@/lib/nav-subgroups';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DONNA_ID = 1000001;
const HR_SUBGROUP = NAV_SUBGROUPS.find(g => g.parentHref === '/finance/hr')!;

interface Props {
  params: { property_id: string };
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function PropertyHrSchedulePage({ params, searchParams }: Props) {
  const pid = Number(params.property_id);
  const isDonna = pid === DONNA_ID;
  const tab = (searchParams.tab as string) ?? (isDonna ? 'dayview' : 'planer');

  // Dayview: ScheduleTabContent owns its DashboardPage — return directly to
  // avoid double-header nesting. Pass HR sub-pages so it shows the right strip.
  if (tab === 'dayview') {
    return (
      <ScheduleTabContent
        propertyId={pid}
        propertyLabel={isDonna ? 'Donna' : 'Namkhan'}
        searchParams={searchParams}
        subPagesOverride={HR_SUBGROUP.tabs}
      />
    );
  }

  // Planer: outer DashboardPage with HR sub-pages as main strip.
  // findSubGroup('/finance/hr/schedule') injects Planer|Dayview as sub-strip.
  return (
    <DashboardPage
      title="HR · Schedule"
      subtitle="Staff scheduling · generate · review · publish"
      tabs={HR_SUBGROUP.tabs.map(t => ({ key: t.href, label: t.label, href: t.href }))}
    >
      <div style={{ padding: '0 20px 20px' }}>
        <SchedulePlannerView propertyId={pid} isReadOnly={isDonna} />
      </div>
    </DashboardPage>
  );
}
