// app/marketing/prospects/sequences/new/page.tsx
// PBS 2026-07-05: manual new sequence creation form.
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../../_subpages';
import NewSequenceForm from './_components/NewSequenceForm';

export const dynamic = 'force-dynamic';

export default async function NewSequencePage() {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('v_marketing_prospect_tags').select('*').order('label');
  const tags = (data as Array<{ tag_key: string; label: string; subscriber_count: number }>) ?? [];

  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map(s => ({ key: s.href, label: s.label, href: s.href, active: s.href === '/marketing/prospects' }));

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage title="Sequences · New" subtitle="Blank sequence · you add steps manually · save as draft" tabs={tabs}>
        <div style={{ gridColumn:'1 / -1' }}>
          <Link href="/marketing/prospects/sequences" style={{ fontSize:12, color:'#084838', textDecoration:'none', fontWeight:600 }}>← Back to sequences</Link>
        </div>
        <div style={{ gridColumn:'1 / -1' }}>
          <NewSequenceForm tags={tags} />
        </div>
      </DashboardPage>
    </div>
  );
}
