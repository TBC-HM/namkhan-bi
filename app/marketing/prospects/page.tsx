// app/marketing/prospects/page.tsx
// PBS 2026-07-05: Prospects directory — non-guest email leads.
// Self-contained server render (no client component yet).
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

type ProspectRow = {
  subscriber_id: string; full_name: string | null; email: string | null; country: string | null;
  interest_series: string | null; tags: string[] | null; enrolled_funnels: string[] | null;
  funnel_sends: number; funnel_pending: number;
  lifecycle_stage: string | null; booking_count: number | null;
  last_email_open_at: string | null; last_email_click_at: string | null;
  created_at: string | null;
};

const fmt = (iso: string | null) => iso ? new Date(iso).toISOString().slice(0,10) : '—';

export default async function ProspectsPage() {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('v_marketing_prospects_directory')
    .select('subscriber_id, full_name, email, country, interest_series, tags, enrolled_funnels, funnel_sends, funnel_pending, lifecycle_stage, booking_count, last_email_open_at, last_email_click_at, created_at')
    .eq('property_id', PROPERTY_ID)
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(2000);

  const rows: ProspectRow[] = (data as ProspectRow[]) ?? [];

  const total = rows.length;
  const withEmail = rows.filter(r => !!r.email).length;
  const enrolled = rows.filter(r => (r.enrolled_funnels?.length ?? 0) > 0).length;
  const engaged  = rows.filter(r => !!(r.last_email_open_at || r.last_email_click_at)).length;
  const converted = rows.filter(r => (r.booking_count ?? 0) > 0).length;

  const pct = (n:number) => total > 0 ? `${Math.round(n/total*100)}%` : '—';

  const tiles: KpiTileProps[] = [
    { label: 'Prospects', value: total, size: 'sm', footnote: 'never-stayed email leads' },
    { label: 'With email', value: withEmail, size: 'sm', footnote: `${pct(withEmail)} contactable` },
    { label: 'In a funnel', value: enrolled, size: 'sm', footnote: `${pct(enrolled)} enrolled` },
    { label: 'Engaged', value: engaged, size: 'sm', footnote: 'opened or clicked' },
    { label: 'Converted', value: converted, size: 'sm', status: converted > 0 ? 'green' : undefined, footnote: 'became bookings' },
  ];

  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map(s => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/marketing/prospects',
  }));

  const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; const CREAM='#F7F0E1';

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage
        title="Marketing · Prospects"
        subtitle={`${total.toLocaleString()} email leads that never stayed — nurture via /marketing/funnels`}
        tabs={tabs}
      >
        <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:8 }}>
          {tiles.map((t,i) => <KpiTile key={i} {...t} />)}
        </div>

        <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <div style={{ fontSize:12, color:INK_M }}>
            Prospects come from lead-magnet signups, CSV import, or partner referrals — <em>not</em> from Cloudbeds. Use <Link href="/marketing/funnels" style={{ color:'#084838' }}>Funnels</Link> to enroll them.
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <Link href="/marketing/prospects/import" style={btnLight}>+ Import CSV</Link>
            <Link href="/marketing/funnels" style={btnGreen}>Manage funnels →</Link>
          </div>
        </div>

        <div style={{ gridColumn:'1 / -1', border:'1px solid '+HAIR, borderRadius:6, background:'#FFFFFF', overflow:'hidden' }}>
          {total === 0 ? (
            <div style={{ padding:'40px 24px', textAlign:'center', color:INK_M, fontSize:12 }}>
              No prospects yet. Import a CSV or wire up the /guides/slow-travel signup form to start populating this list.
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'#FAFAF7', borderBottom:'1px solid '+HAIR }}>
                    <th style={th}>Name</th>
                    <th style={th}>Email</th>
                    <th style={th}>Country</th>
                    <th style={th}>Interest</th>
                    <th style={th}>Tags</th>
                    <th style={th}>Funnels</th>
                    <th style={{...th, textAlign:'right'}}>Sends</th>
                    <th style={{...th, textAlign:'right'}}>Pending</th>
                    <th style={th}>Added</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 500).map(r => (
                    <tr key={r.subscriber_id} style={{ borderTop:'1px solid '+HAIR }}>
                      <td style={tdL}>{r.full_name ?? '—'}</td>
                      <td style={tdL}>{r.email ?? '—'}</td>
                      <td style={tdL}>{r.country ?? '—'}</td>
                      <td style={tdL}>{r.interest_series ?? '—'}</td>
                      <td style={tdL}>
                        {(r.tags ?? []).length === 0 ? <span style={{ color:'#C8C0A6' }}>—</span> :
                          (r.tags ?? []).map(t =>
                            <span key={t} style={{ display:'inline-block', padding:'1px 6px', margin:'0 2px 2px 0', fontSize:10, background:CREAM, border:'1px solid '+HAIR, borderRadius:8, color:INK }}>{t}</span>
                          )}
                      </td>
                      <td style={tdL}>{(r.enrolled_funnels ?? []).join(', ') || '—'}</td>
                      <td style={tdR}>{r.funnel_sends}</td>
                      <td style={tdR}>{r.funnel_pending}</td>
                      <td style={tdL}>{fmt(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {total > 500 && (
                <div style={{ padding:'10px 12px', fontSize:11, color:INK_M, textAlign:'center' }}>
                  Showing 500 of {total.toLocaleString()} — client filters/search coming next.
                </div>
              )}
            </div>
          )}
        </div>
      </DashboardPage>
    </div>
  );
}

const btnGreen = { padding:'6px 14px', fontSize:12, fontWeight:600, background:'#084838', color:'#FFFFFF', border:'1px solid #084838', borderRadius:4, textDecoration:'none' as const };
const btnLight = { padding:'6px 14px', fontSize:12, fontWeight:600, background:'#FFFFFF', color:'#084838', border:'1px solid #E6DFCC', borderRadius:4, textDecoration:'none' as const };
const th = { padding:'8px 10px', fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' as const, color:'#1B1B1B', textAlign:'left' as const };
const tdL = { padding:'8px 10px', fontSize:12, color:'#1B1B1B' };
const tdR = { padding:'8px 10px', fontSize:12, color:'#1B1B1B', textAlign:'right' as const, fontVariantNumeric:'tabular-nums' as const };
