// app/finance/hr/schedule/page.tsx — ADR-149
// mode=planner (default) → new SchedulePlannerView
// mode=dayview           → existing ScheduleTabContent (unchanged)
import ScheduleTabContent from '@/app/operations/staff/_components/ScheduleTabContent';
import SchedulePlannerView from './SchedulePlannerView';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { FINANCE_SUBPAGES } from '@/app/finance/_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function FinanceHrSchedulePage({ searchParams }: Props) {
  const mode = (searchParams.mode as string) ?? 'planner';

  if (mode === 'dayview') {
    return (
      <ScheduleTabContent
        propertyId={NAMKHAN_PROPERTY_ID}
        propertyLabel="Namkhan"
        searchParams={searchParams}
        subPagesOverride={FINANCE_SUBPAGES}
      />
    );
  }

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      {/* Mode switcher — sits outside the planner chrome */}
      <div style={{ display: 'flex', gap: 0, padding: '10px 20px 0',
        borderBottom: '1px solid #E6DFCC', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: '#5A5A5A', marginRight: 16, fontWeight: 600 }}>
          View:
        </div>
        {[
          { key: 'planner', label: 'Planner' },
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
      <SchedulePlannerView propertyId={NAMKHAN_PROPERTY_ID} />
    </div>
  );
}
