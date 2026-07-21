// app/marketing/prospects/sequences/[funnel_id]/preview/page.tsx
// PBS 2026-07-21 v3: uses shared renderEmailFrame() + hero image slot.
import TenantLink from '@/components/nav/TenantLink';
import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../../../../_subpages';
import { renderEmailFrame, markdownToInlineHtml } from '@/lib/emailFrame';

export const dynamic = 'force-dynamic';

type Row = {
  funnel_id: string; funnel_key: string; name: string;
  step_no: number | null; delay_days: number | null; subject: string | null;
  body_md: string | null; click_tag_map: Record<string, unknown> | null;
  hero_image_url: string | null; hero_asset_id: string | null; hero_public_url: string | null;
};

export default async function PreviewPage({ params }: { params: { funnel_id: string } }) {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('v_marketing_funnel_detail').select('*')
    .eq('funnel_id', params.funnel_id)
    .order('step_no', { ascending: true, nullsFirst: false });
  const rows = (data as Row[]) ?? [];
  if (!rows.length) return notFound();

  const head = rows[0];
  const steps = rows.filter(r => r.step_no != null);
  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map(s => ({ key: s.href, label: s.label, href: s.href, active: s.href === '/marketing/prospects' }));
  const HAIR = '#E6DFCC'; const INK = '#1B1B1B'; const INK_M = '#5A5A5A'; const CREAM = '#F7F0E1';

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage title={`Sequence · Preview · ${head.name}`} subtitle="How every step will render in a real email (shared frame with newsletter Composer)" tabs={tabs}>
        <div style={{ gridColumn: '1 / -1' }}>
          <TenantLink href={`/marketing/prospects/sequences/${head.funnel_id}`} style={{ fontSize: 12, color: '#084838', textDecoration: 'none', fontWeight: 600 }}>← Back to sequence</TenantLink>
        </div>

        {steps.map(s => {
          const heroUrl = s.hero_public_url ?? s.hero_image_url ?? null;
          const bodyHtml = markdownToInlineHtml(s.body_md ?? '');
          const html = renderEmailFrame({
            heroImageUrl: heroUrl,
            heroAlt: s.subject ?? head.name,
            bodyHtml,
            propertyName: 'THE NAMKHAN',
            propertyEmail: 'info@thenamkhan.com',
            propertyWebsite: 'thenamkhan.com',
            unsubscribeUrl: '#unsubscribe',
          });
          return (
            <div key={s.step_no ?? 0} style={{ gridColumn: '1 / -1', border: '1px solid ' + HAIR, borderRadius: 6, background: '#FAF7EE', padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '8px 14px', background: CREAM, borderBottom: '1px solid ' + HAIR, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: INK_M }}>
                <span>Step {s.step_no} · +{s.delay_days ?? 0} days · Subject: <strong style={{ color: INK }}>{s.subject}</strong></span>
                {heroUrl ? <span style={{ color: '#084838' }}>hero: ✓</span> : <span style={{ color: '#B03826' }}>no hero</span>}
              </div>
              <iframe title={`step-${s.step_no}`} srcDoc={html} style={{ width: '100%', height: 720, border: 'none', background: '#F0EBE1', display: 'block' }} />
            </div>
          );
        })}
      </DashboardPage>
    </div>
  );
}
