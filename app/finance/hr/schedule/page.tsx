// app/finance/hr/schedule/page.tsx — Namkhan HR Schedule (ADR-149)
// Planner default · Day View secondary (existing ScheduleTabContent kept as-is)
import { Suspense } from 'next/server' as any;
import ScheduleTabContent from '@/app/operations/staff/_components/ScheduleTabContent';
import SchedulePlannerView from './SchedulePlannerView';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { FINANCE_SUBPAGES } from '@/app/finance/_subpages';
import { DashboardPage } from '@/app/(cockpit)/_design';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function FinanceHrSchedulePage({ searchParams }: Props) {
  const mode = (searchParams.mode as string) ?? 'planner';
  const subPages = FINANCE_SUBPAGES;

  return (
    <DashboardPage
      title="HR · Schedule"
      subtitle="Namkhan Luang Prabang · draft → edit → publish"
      tabs={subPages}
      action={
        <div style={{ display: 'flex', gap: 0, border: '1px solid #E6DFCC', borderRadius: 4, overflow: 'hidden' }}>
          {[
            { key: 'planner', label: 'Planner' },
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
            propertyId={NAMKHAN_PROPERTY_ID}
            propertyLabel="Namkhan"
            searchParams={searchParams}
            subPagesOverride={subPages}
          />
        ) : (
          <SchedulePlannerView propertyId={NAMKHAN_PROPERTY_ID} />
        )}
      </div>
    </DashboardPage>
  );
}
