// app/marketing/prospects/sequences/[funnel_id]/enroll/page.tsx
// PBS 2026-07-05: enroll subscribers by tag into a sequence.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../../../../_subpages';
import EnrollForm from '../_components/EnrollForm';

export const dynamic = 'force-dynamic';

export default async function EnrollPage({ params }: { params: { funnel_id: string } }) {
  const sb = getSupabaseAdmin();
  const [funnelResp, tagsResp] = await Promise.all([
    sb.from('v_marketing_funnels').select('*').eq('funnel_id', params.funnel_id).maybeSingle(),
    sb.from('v_marketing_prospect_tags').select('*').order('subscriber_count', { ascending: false }),
  ]);
  if (!funnelResp.data) return notFound();
  const funnel = funnelResp.data as { funnel_id: string; name: string; status: string; steps_count: number; target_tag_key: string | null };
  const tags = (tagsResp.data as Array<{ tag_key: string; label: string; subscriber_count: number }>) ?? [];

  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map(s => ({ key: s.href, label: s.label, href: s.href, active: s.href === '/marketing/prospects' }));

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage title={`Sequences · Enroll subscribers · ${funnel.name}`} subtitle={`state: ${funnel.status} · ${funnel.steps_count} steps`} tabs={tabs}>
        <div style={{ gridColumn:'1 / -1' }}>
          <Link href={`/marketing/prospects/sequences/${funnel.funnel_id}`} style={{ fontSize:12, color:'#084838', textDecoration:'none', fontWeight:600 }}>← Back to sequence</Link>
        </div>
        <div style={{ gridColumn:'1 / -1' }}>
          <EnrollForm funnel_id={funnel.funnel_id} defaultTag={funnel.target_tag_key ?? ''} tags={tags} />
        </div>
      </DashboardPage>
    </div>
  );
}
