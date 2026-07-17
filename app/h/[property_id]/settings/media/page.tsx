// app/h/[property_id]/settings/media/page.tsx
// PBS 2026-07-18 · Media settings promoted to sibling top-level tab
// (Property · Media · Guardrails · Send Logs · Data). MediaQaPanel wired here;
// full PhotoGuardrailsPanel port awaits follow-up (its Props shape needs a
// property-scoped wrapper).
import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import MediaQaPanel from '@/components/settings/panels/MediaQaPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function MediaSettingsPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  return (
    <DashboardPage
      title="Settings · Media"
      subtitle={`Naming rules · scoring · re-score · property ${propertyId}`}
      tabs={[
        { key: 'property',   label: 'Property',   href: `/h/${propertyId}/settings/property`   },
        { key: 'media',      label: 'Media',      href: `/h/${propertyId}/settings/media`, active: true },
        { key: 'guardrails', label: 'Guardrails', href: `/h/${propertyId}/settings/guardrails` },
        { key: 'data',       label: 'Data',       href: `/h/${propertyId}/settings/data` },
        { key: 'send_logs',  label: 'Send Logs',  href: `/h/${propertyId}/settings/send-logs`  },
      ]}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Media QA" subtitle="naming convention rules · scoring · backfill re-score">
          <div style={{ padding: 16 }}>
            <MediaQaPanel propertyId={propertyId} />
          </div>
        </Container>
      </div>
      <div style={{ gridColumn: '1 / -1', marginTop: 16 }}>
        <Container title="Photo Guardrails" subtitle="captions · alt-text · tiers · aspect ratios · text policy · brand palette">
          <div style={{ padding: 20, color: '#5A5A5A', fontSize: 12 }}>
            Full port from <code>/marketing/media &gt; Photo Settings</code> awaits follow-up.
            For now edit these guardrails from the Media area &gt; Photo Settings sub-tab.
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}