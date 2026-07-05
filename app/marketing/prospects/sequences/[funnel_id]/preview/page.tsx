// app/marketing/prospects/sequences/[funnel_id]/preview/page.tsx
// PBS 2026-07-05: preview render of each step in the sequence.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../../../../_subpages';

export const dynamic = 'force-dynamic';

type Row = {
  funnel_id: string; funnel_key: string; name: string;
  step_no: number | null; delay_days: number | null; subject: string | null;
  body_md: string | null; click_tag_map: Record<string, unknown> | null;
};

function safeUrl(u: string): string {
  const trimmed = u.trim();
  if (/^(https?:|mailto:|\/)/i.test(trimmed)) return trimmed.replace(/"/g, '%22');
  return '#';
}

function mdToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g, '&quot;');
  const html = esc(md)
    .replace(/^# (.+)$/gm, '<h1 style="font-family:Georgia,serif;font-size:24px;color:#084838;margin:16px 0 8px;font-style:italic">$1</h1>')
    .replace(/^## (.+)$/gm, '<h2 style="font-family:Georgia,serif;font-size:18px;color:#084838;margin:14px 0 6px">$1</h2>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, url: string) => `<a href="${safeUrl(url)}" style="color:#084838;text-decoration:underline">${label}</a>`);
  return html.split(/\n\n+/).map(p => `<p style="margin:8px 0;font-family:Georgia,serif;font-size:14px;line-height:1.6">${p}</p>`).join('\n');
}

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
  const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; const CREAM='#F7F0E1';

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage title={`Sequence · Preview · ${head.name}`} subtitle="How every step will render in a real email" tabs={tabs}>
        <div style={{ gridColumn:'1 / -1' }}>
          <Link href={`/marketing/prospects/sequences/${head.funnel_id}`} style={{ fontSize:12, color:'#084838', textDecoration:'none', fontWeight:600 }}>← Back to sequence</Link>
        </div>

        {steps.map(s => (
          <div key={s.step_no ?? 0} style={{ gridColumn:'1 / -1', border:'1px solid '+HAIR, borderRadius:6, background:'#FAF7EE', padding:0, overflow:'hidden' }}>
            <div style={{ padding:'8px 14px', background:CREAM, borderBottom:'1px solid '+HAIR, display:'flex', justifyContent:'space-between', fontSize:11, color:INK_M }}>
              <span>Step {s.step_no} · +{s.delay_days ?? 0} days · Subject: <strong style={{ color:INK }}>{s.subject}</strong></span>
            </div>
            <div style={{ maxWidth:600, margin:'0 auto', background:'#FFFFFF', border:'1px solid '+HAIR, borderRadius:4, margin:'12px auto', overflow:'hidden' }}>
              <div style={{ padding:'20px 24px 14px', background:'#F7F0E1', borderBottom:'2px solid #C79A6B', textAlign:'center' }}>
                <div style={{ fontSize:22, letterSpacing:'0.34em', color:'#084838', fontFamily:'Georgia, serif' }}>THE NAMKHAN</div>
                <div style={{ fontSize:9, letterSpacing:'0.22em', color:INK_M, marginTop:4 }}>LUANG PRABANG · LAOS</div>
              </div>
              <div style={{ padding:'12px 28px 24px', color:INK }} dangerouslySetInnerHTML={{ __html: mdToHtml(s.body_md ?? '') }} />
              <div style={{ padding:'14px 20px', background:'#F7F0E1', borderTop:'2px solid #C79A6B', fontSize:10, color:INK_M, textAlign:'center' }}>
                info@thenamkhan.com · <a href="https://thenamkhan.com" style={{ color:INK_M }}>thenamkhan.com</a>
              </div>
            </div>
          </div>
        ))}
      </DashboardPage>
    </div>
  );
}
