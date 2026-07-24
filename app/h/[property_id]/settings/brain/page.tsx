// app/h/[property_id]/settings/brain/page.tsx
// PBS 2026-07-24 · the Brain is property-level (this is The Namkhan's brain,
// not the holding's). Console moved here from /holding/it/brain (which now
// redirects): pipeline tiles · human review queue · classifier rules editor ·
// ask window. BrainClient fetches via /api/brain/* (service-role server-side).

import { DashboardPage } from '@/app/(cockpit)/_design';
import BrainClient from '@/app/holding/it/brain/BrainClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyBrainSettingsPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  return (
    <DashboardPage
      title="Settings · Brain"
      subtitle={`Company document brain · pipeline · review queue · classifier rules · property ${propertyId}`}
      tabs={[
        { key: 'property',   label: 'Property',   href: `/h/${propertyId}/settings/property`   },
        { key: 'media',      label: 'Media',      href: `/h/${propertyId}/settings/media` },
        { key: 'rate_plans', label: 'Rate Plans', href: `/h/${propertyId}/settings/rate-plans` },
        { key: 'audience',   label: 'Newsletter', href: `/h/${propertyId}/settings/property/audience` },
        { key: 'guardrails', label: 'Guardrails', href: `/h/${propertyId}/settings/guardrails` },
        { key: 'data',       label: 'Data',       href: `/h/${propertyId}/settings/data` },
        { key: 'brain',      label: 'Brain',      href: `/h/${propertyId}/settings/brain`, active: true },
        { key: 'send_logs',  label: 'Send Logs',  href: `/h/${propertyId}/settings/send-logs`  },
      ]}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <BrainClient />
      </div>
    </DashboardPage>
  );
}
