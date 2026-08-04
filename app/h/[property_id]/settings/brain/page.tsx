// app/h/[property_id]/settings/brain/page.tsx
// PBS 2026-07-24 · property-level brain console.
// 2026-08-04 · canonical tabs via getSettingsTabs.

import { DashboardPage } from '@/app/(cockpit)/_design';
import { getSettingsTabs } from '@/lib/property-settings-tabs';
import BrainClient from '@/components/brain/BrainClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyBrainSettingsPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  return (
    <DashboardPage
      title="Settings · Brain"
      subtitle={`Company document brain · pipeline · review queue · classifier rules · property ${propertyId}`}
      tabs={getSettingsTabs(propertyId, 'brain')}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <BrainClient propertyId={propertyId} />
      </div>
    </DashboardPage>
  );
}
