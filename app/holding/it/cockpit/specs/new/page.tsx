// app/holding/it/cockpit/specs/new/page.tsx
// PBS 2026-07-24: Guided spec questionnaire — produces a complete build brief
// that an autonomous agent can act on without further clarification.

import { DashboardPage } from '@/app/(cockpit)/_design';
import { groupsAsTabs } from '@/app/holding/it/cockpit/_lib/groups';
import SpecBuilderClient from './SpecBuilderClient';

export const dynamic = 'force-dynamic';

export default function SpecNewPage() {
  return (
    <DashboardPage
      title="Spec Builder"
      tabs={groupsAsTabs('build')}
      action={
        <a href="/holding/it/cockpit/specs" style={{ fontSize: 11, color: '#5A5A5A', textDecoration: 'none', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          ← All specs
        </a>
      }
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <div style={{ fontSize: 13, color: '#5A5A5A', marginBottom: 20, lineHeight: 1.6, maxWidth: 680 }}>
          Answer 7 sections to produce a spec that an agent can build against autonomously.
          Be specific — vague descriptions lead to wrong implementations.
          You can edit the brief after saving.
        </div>
        <SpecBuilderClient />
      </div>
    </DashboardPage>
  );
}
