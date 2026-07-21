// app/marketing/prospects/sequences/page.tsx
// PBS 2026-07-05: newsletter-style sequences list (Draft / Live / Halted) — nested under Prospects.
import TenantLink from '@/components/nav/TenantLink';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

type Row = {
  funnel_id: string; funnel_key: string; name: string; description: string | null;
  status: string; target_tag_key: string | null; target_tag_label: string | null;
  steps_count: number; active_enrollments: number; completed_enrollments: number;
  pending_recipients: number; send_count: number; updated_at: string;
};

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }); }
  catch { return '—'; }
};

export default async function SequencesPage() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('v_marketing_funnels')
    .select('*')
    .eq('property_id', PROPERTY_ID)
    .order('updated_at', { ascending: false });

  const rows: Row[] = (data as Row[]) ?? [];
  const drafts    = rows.filter(r => r.status === 'draft');
  const live      = rows.filter(r => r.status === 'live' || r.status === 'scheduled');
  const halted    = rows.filter(r => r.status === 'halted');

  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map(s => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/marketing/prospects',
  }));

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage
        title="Marketing · Prospects · Sequences"
        subtitle={`${rows.length} sequence${rows.length===1?'':'s'} — same shape as /guest/newsletters, but for never-stayed leads`}
        tabs={tabs}
      >
        {error && (
          <div style={{ gridColumn:'1 / -1', padding:12, background:'#FBE8E4', color:'#8A2419', border:'1px solid #E8B7AB', borderRadius:4, fontSize:13 }}>
            Could not load sequences: {error.message}
          </div>
        )}

        <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <TenantLink href="/marketing/prospects" style={{ fontSize:12, color:'#084838', textDecoration:'none', fontWeight:600 }}>
            ← Back to prospects
          </TenantLink>
          <div style={{ display:'flex', gap:8 }}>
            <TenantLink href="/marketing/prospects/sequences/ai-propose" style={btnLight}>AI propose sequence</TenantLink>
            <TenantLink href="/marketing/prospects/sequences/new"        style={btnGreen}>+ New sequence</TenantLink>
          </div>
        </div>

        <Section title="Drafts" rows={drafts} kind="draft" />
        <Section title="Live"   rows={live}   kind="live" />
        {halted.length > 0 && <Section title="Halted" rows={halted} kind="halted" />}
      </DashboardPage>
    </div>
  );
}

function Section({ title, rows, kind }: { title: string; rows: Row[]; kind: 'draft'|'live'|'halted' }) {
  const HAIR='#E6DFCC'; const INK_M='#5A5A5A'; const CREAM='#F7F0E1';
  return (
    <div style={{ gridColumn:'1 / -1' }}>
      <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, margin:'12px 2px 6px' }}>
        {title} · {rows.length}
      </div>
      {rows.length === 0 ? (
        <div style={{ padding:'20px 24px', fontSize:12, color:INK_M, background:'#FFFFFF', border:'1px solid '+HAIR, borderRadius:6, textAlign:'center' }}>Empty.</div>
      ) : (
        <div style={{ border:'1px solid '+HAIR, borderRadius:6, overflow:'hidden', background:'#FFFFFF' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ background:'#FAFAF7', borderBottom:'1px solid '+HAIR }}>
                <th style={th}>Sequence</th>
                <th style={th}>Target tag</th>
                <th style={{ ...th, textAlign:'right' }}>Steps</th>
                <th style={{ ...th, textAlign:'right' }}>Enrolled</th>
                <th style={{ ...th, textAlign:'right' }}>Sends</th>
                <th style={th}>Last edit</th>
                <th style={{ ...th, textAlign:'right', width:320 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.funnel_id} style={{ borderTop:'1px solid '+HAIR }}>
                  <td style={{ ...tdL, maxWidth:340 }}>
                    <div style={{ fontWeight:600 }}>{r.name}</div>
                    <div style={{ fontSize:11, color:INK_M, marginTop:2 }}>{r.funnel_key}</div>
                  </td>
                  <td style={tdL}>
                    {r.target_tag_label ? (
                      <span style={{ display:'inline-block', padding:'2px 8px', fontSize:11, fontWeight:600, background:CREAM, border:'1px solid '+HAIR, borderRadius:10 }}>
                        {r.target_tag_label}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={tdR}>{r.steps_count}</td>
                  <td style={tdR}>{r.active_enrollments.toLocaleString()}</td>
                  <td style={tdR}>{r.send_count.toLocaleString()}</td>
                  <td style={tdL}>{fmtDate(r.updated_at)}</td>
                  <td style={{ ...tdL, textAlign:'right' }}>
                    <TenantLink href={`/marketing/prospects/sequences/${r.funnel_id}/preview`} style={btnA}>Preview</TenantLink>
                    <TenantLink href={`/marketing/prospects/sequences/${r.funnel_id}`} style={btnA}>Edit</TenantLink>
                    {kind === 'draft' && <TenantLink href={`/marketing/prospects/sequences/${r.funnel_id}/schedule`} style={btnGreen2}>Schedule</TenantLink>}
                    {kind === 'live'  && <TenantLink href={`/marketing/prospects/sequences/${r.funnel_id}/halt`}   style={btnA}>Halt</TenantLink>}
                    {kind === 'halted'&& <TenantLink href={`/marketing/prospects/sequences/${r.funnel_id}/resume`} style={btnGreen2}>Resume</TenantLink>}
                    <TenantLink href={`/marketing/prospects/sequences/${r.funnel_id}/delete`} style={btnR}>Delete</TenantLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const btnGreen = { padding:'6px 14px', fontSize:12, fontWeight:600, background:'#084838', color:'#FFFFFF', border:'1px solid #084838', borderRadius:4, textDecoration:'none' as const };
const btnLight = { padding:'6px 14px', fontSize:12, fontWeight:600, background:'#FFFFFF', color:'#084838', border:'1px solid #E6DFCC', borderRadius:4, textDecoration:'none' as const };
const btnA = { display:'inline-block', padding:'4px 10px', marginLeft:6, fontSize:11, fontWeight:600, background:'#FFFFFF', color:'#3A3A3A', border:'1px solid #E6DFCC', borderRadius:4, textDecoration:'none' as const };
const btnGreen2 = { display:'inline-block', padding:'4px 10px', marginLeft:6, fontSize:11, fontWeight:600, background:'#084838', color:'#FFFFFF', border:'1px solid #084838', borderRadius:4, textDecoration:'none' as const };
const btnR = { display:'inline-block', padding:'4px 10px', marginLeft:6, fontSize:11, fontWeight:600, background:'#FFFFFF', color:'#B03826', border:'1px solid #E8B7AB', borderRadius:4, textDecoration:'none' as const };
const th = { padding:'8px 10px', fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' as const, color:'#1B1B1B', textAlign:'left' as const };
const tdL = { padding:'8px 10px', fontSize:12, color:'#1B1B1B' };
const tdR = { padding:'8px 10px', fontSize:12, color:'#1B1B1B', textAlign:'right' as const, fontVariantNumeric:'tabular-nums' as const };
