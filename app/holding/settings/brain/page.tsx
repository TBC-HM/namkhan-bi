// app/holding/settings/brain/page.tsx
// PBS 2026-08-02 — Holding brain: ONLY docs where property_id IS NULL.
// propertyId=0 sentinel triggers the IS NULL filter in fn_brain_search/vec/docfind.
// No cross-tenant retrieval. Namkhan/Donna accessed via /h/[pid]/settings/brain.

import { DashboardPage } from '@/app/(cockpit)/_design';
import BrainClient from '@/components/brain/BrainClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TABS = [
  { key: 'back',       label: '← HoD',     href: '/holding'                      },
  { key: 'platform',   label: 'Platform',   href: '/holding/settings'             },
  { key: 'guardrails', label: 'Guardrails', href: '/holding/settings/guardrails'  },
  { key: 'documents',  label: 'Documents',  href: '/holding/settings/documents'   },
  { key: 'media',      label: 'Media',      href: '/holding/settings/media'       },
  { key: 'brain',      label: 'Brain',      href: '/holding/settings/brain', active: true },
];

export default function HoldingBrainPage() {
  return (
    <DashboardPage
      title="Holding Brain"
      subtitle="54 holding-wide docs only · no Namkhan · no Donna · enter property settings for property-specific brains"
      tabs={TABS}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <BrainClient propertyId={0} />
      </div>
    </DashboardPage>
  );
}
