// app/marketing/prospects/sequences/[funnel_id]/page.tsx
// PBS 2026-07-05: read-only step viewer for a single email sequence.
import TenantLink from '@/components/nav/TenantLink';
import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../../../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

type Row = {
  funnel_id: string; funnel_key: string; name: string; description: string | null;
  status: string; auto_enroll: boolean;
  target_tag_key: string | null; target_tag_label: string | null;
  step_id: string | null; step_no: number | null; delay_days: number | null;
  send_hour_local: number | null; subject: string | null; body_md: string | null;
  hero_image_url: string | null; click_tag_map: Record<string, unknown> | null;
  step_sends: number | null;
};

const fmtDelay = (d: number | null) => d == null ? '—' : (d === 0 ? 'immediate' : d === 1 ? '+1 day' : `+${d} days`);

export default async function SeqDetailPage({ params }: { params: { funnel_id: string } }) {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('v_marketing_funnel_detail')
    .select('*')
    .eq('funnel_id', params.funnel_id)
    .order('step_no', { ascending: true, nullsFirst: false });

  const rows = (data as Row[]) ?? [];
  if (!rows.length) return notFound();

  const head = rows[0];
  const steps = rows.filter(r => r.step_id != null).sort((a, b) => (a.step_no ?? 0) - (b.step_no ?? 0));

  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map(s => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/marketing/prospects',
  }));

  const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; const CREAM='#F7F0E1';

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage
        title={`Prospects · Sequence · ${head.name}`}
        subtitle={`${steps.length} step${steps.length===1?'':'s'} · state: ${head.status}${head.auto_enroll ? ' · auto-enrolls new subscribers with target tag' : ''}`}
        tabs={tabs}
      >
        <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <TenantLink href="/marketing/prospects/sequences" style={{ fontSize:12, color:'#084838', textDecoration:'none', fontWeight:600 }}>← Back to sequences</TenantLink>
          <div style={{ display:'flex', gap:8 }}>
            <TenantLink href={`/marketing/prospects/sequences/${head.funnel_id}/preview`} style={btnLight}>Preview</TenantLink>
            <TenantLink href={`/marketing/prospects/sequences/${head.funnel_id}/enroll`}  style={btnGreen}>Enroll subscribers</TenantLink>
          </div>
        </div>

        <div style={{ gridColumn:'1 / -1', border:'1px solid '+HAIR, borderRadius:6, background:'#FFFFFF', padding:16 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12 }}>
            <Cell label="Key"            v={head.funnel_key} />
            <Cell label="Status"         v={head.status} />
            <Cell label="Target segment" v={head.target_tag_label ?? '—'} />
            <Cell label="Steps"          v={String(steps.length)} />
            <Cell label="Auto-enroll"    v={head.auto_enroll ? 'yes' : 'no'} />
          </div>
          {head.description && (
            <div style={{ marginTop:12, paddingTop:12, borderTop:'1px dashed '+HAIR, fontSize:12, color:INK_M, lineHeight:1.6 }}>
              {head.description}
            </div>
          )}
        </div>

        <div style={{ gridColumn:'1 / -1' }}>
          <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, margin:'12px 2px 6px' }}>Steps ({steps.length})</div>
          {steps.length === 0 ? (
            <div style={{ padding:'20px 24px', fontSize:12, color:INK_M, background:'#FFFFFF', border:'1px solid '+HAIR, borderRadius:6, textAlign:'center' }}>
              No steps yet. Use <TenantLink href="/marketing/prospects/sequences/ai-propose" style={{ color:'#084838' }}>AI propose sequence</TenantLink> to generate them.
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {steps.map(s => (
                <div key={s.step_id} style={{ border:'1px solid '+HAIR, borderRadius:6, background:'#FFFFFF', padding:14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, borderBottom:'1px solid '+HAIR, paddingBottom:8, marginBottom:10 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ display:'inline-block', padding:'2px 10px', fontSize:11, fontWeight:600, background:CREAM, border:'1px solid '+HAIR, borderRadius:10 }}>Step {s.step_no}</span>
                      <span style={{ fontSize:11, color:INK_M }}>{fmtDelay(s.delay_days)}{s.send_hour_local != null ? ` · ${String(s.send_hour_local).padStart(2,'0')}:00 Vientiane` : ''}</span>
                      {s.step_sends ? <span style={{ fontSize:11, color:'#084838' }}>· {s.step_sends} sent</span> : null}
                    </div>
                  </div>
                  <div style={{ fontSize:13, fontWeight:600, color:INK, marginBottom:6 }}>{s.subject}</div>
                  <div style={{ fontSize:12, color:INK, lineHeight:1.6, whiteSpace:'pre-wrap', fontFamily:'Georgia, serif', background:'#FDFCF8', padding:12, borderRadius:4, border:'1px solid '+HAIR, maxHeight:280, overflow:'auto' }}>
                    {s.body_md}
                  </div>
                  {s.click_tag_map && Object.keys(s.click_tag_map).length > 0 && (
                    <div style={{ marginTop:10, fontSize:11, color:INK_M }}>
                      <strong>Click → tag:</strong>{' '}
                      {Object.entries(s.click_tag_map).map(([slug, tag]) => (
                        <span key={slug} style={{ display:'inline-block', margin:'2px 4px 2px 0', padding:'1px 8px', fontSize:10, background:CREAM, border:'1px solid '+HAIR, borderRadius:8 }}>
                          {slug} → {String(tag)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DashboardPage>
    </div>
  );
}

function Cell({ label, v }: { label: string; v: string }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
      <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'#5A5A5A' }}>{label}</div>
      <div style={{ fontSize:12, color:'#1B1B1B', fontVariantNumeric:'tabular-nums' }}>{v}</div>
    </div>
  );
}

const btnGreen = { padding:'6px 14px', fontSize:12, fontWeight:600, background:'#084838', color:'#FFFFFF', border:'1px solid #084838', borderRadius:4, textDecoration:'none' as const };
const btnLight = { padding:'6px 14px', fontSize:12, fontWeight:600, background:'#FFFFFF', color:'#084838', border:'1px solid #E6DFCC', borderRadius:4, textDecoration:'none' as const };
