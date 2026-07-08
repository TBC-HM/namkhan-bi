// app/marketing/prospects/sequences/ai-propose/page.tsx
// PBS 2026-07-05: form to call /api/marketing/funnels/ai-propose (Claude Sonnet 4.6)
// and seed a new sequence via fn_sequence_seed_from_ai.
import TenantLink from '@/components/nav/TenantLink';
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../../_subpages';
import AiProposeForm from './_components/AiProposeForm';

export const dynamic = 'force-dynamic';

export default function AiProposePage() {
  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map(s => ({ key: s.href, label: s.label, href: s.href, active: s.href === '/marketing/prospects' }));
  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage title="Sequences · AI propose" subtitle="Pick a segment · Claude drafts a full sequence · you review + save as draft" tabs={tabs}>
        <div style={{ gridColumn:'1 / -1' }}>
          <TenantLink href="/marketing/prospects/sequences" style={{ fontSize:12, color:'#084838', textDecoration:'none', fontWeight:600 }}>← Back to sequences</TenantLink>
        </div>
        <div style={{ gridColumn:'1 / -1' }}>
          <AiProposeForm />
        </div>
      </DashboardPage>
    </div>
  );
}
// touch to trigger rebuild 2026-07-06
