// app/h/[property_id]/finance/hr/schedule/page.tsx — ADR-149
// Namkhan (260955): planner default. Donna (1000001): day-view default, planner read-only.
import ScheduleTabContent from '@/app/operations/staff/_components/ScheduleTabContent';
import SchedulePlannerView from '@/app/finance/hr/schedule/SchedulePlannerView';
import { FINANCE_SUBPAGES } from '@/app/finance/_subpages';
import { financeSubPagesForProperty } from '@/app/finance/_subpages';
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
  const mode = (searchParams.mode as string) ?? (isDonna ? 'dayview' : 'planner');
  const subPages = rewriteSubPagesForProperty(FINANCE_SUBPAGES, pid);

  if (mode === 'dayview') {
    return (
      <ScheduleTabContent
        propertyId={pid}
        propertyLabel={isDonna ? 'Donna' : 'Namkhan'}
        searchParams={searchParams}
        subPagesOverride={subPages}
      />
    );
  }

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <div style={{ display: 'flex', gap: 0, padding: '10px 20px 0',
        borderBottom: '1px solid #E6DFCC', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: '#5A5A5A', marginRight: 16, fontWeight: 600 }}>
          View:
        </div>
        {[
          { key: 'planner', label: isDonna ? 'Overview' : 'Planner' },
          { key: 'dayview', label: 'Day View' },
        ].map(t => (
          <a key={t.key} href={'?mode=' + t.key} style={{
            fontSize: 11, fontWeight: 700, padding: '5px 14px',
            background: mode === t.key ? '#1F3A2E' : '#FFFFFF',
            color: mode === t.key ? '#FFFFFF' : '#5A5A5A',
            textDecoration: 'none', letterSpacing: '0.05em',
            border: '1px solid #E6DFCC', marginRight: -1,
          }}>
            {t.label}
          </a>
        ))}
      </div>
      <SchedulePlannerView propertyId={pid} isReadOnly={isDonna} />
    </div>
  );
}
