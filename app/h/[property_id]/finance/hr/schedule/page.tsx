// app/h/[property_id]/finance/hr/schedule/page.tsx — Property-level (ADR-149)
// Namkhan: full planner. Donna: read-only (Factorial).
import ScheduleTabContent from '@/app/operations/staff/_components/ScheduleTabContent';
import SchedulePlannerView from '@/app/finance/hr/schedule/SchedulePlannerView';
import { FINANCE_SUBPAGES } from '@/app/finance/_subpages';
import { getDeptCfg } from '@/lib/dept-cfg/by-property';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { DashboardPage } from '@/app/(cockpit)/_design';

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

  return (
    <DashboardPage
      title="HR · Schedule"
      subtitle={isDonna ? 'Donna Mallorca · Factorial (read-only)' : 'Namkhan · draft → edit → publish'}
      tabs={subPages}
      action={
        <div style={{ display: 'flex', gap: 0, border: '1px solid #E6DFCC', borderRadius: 4, overflow: 'hidden' }}>
          {[
            { key: 'planner', label: isDonna ? 'Overview' : 'Planner' },
            { key: 'dayview', label: 'Day View' },
          ].map(t => (
            <a key={t.key} href={'?mode=' + t.key} style={{
              fontSize: 11, fontWeight: 700, padding: '5px 14px',
              background: mode === t.key ? '#1F3A2E' : '#FFFFFF',
              color: mode === t.key ? '#FFFFFF' : '#5A5A5A',
              textDecoration: 'none', letterSpacing: '0.05em',
            }}>
              {t.label}
            </a>
          ))}
        </div>
      }
    >
      <div style={{ gridColumn: '1 / -1' }}>
        {mode === 'dayview' ? (
          <ScheduleTabContent
            propertyId={pid}
            propertyLabel={isDonna ? 'Donna' : 'Namkhan'}
            searchParams={searchParams}
            subPagesOverride={subPages}
          />
        ) : (
          <SchedulePlannerView propertyId={pid} isReadOnly={isDonna} />
        )}
      </div>
    </DashboardPage>
  );
}
