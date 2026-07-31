// app/sales/icp/page.tsx — ICP Engine · data-driven · 89-day rolling
// ICPs are the base for all sales, marketing, YouTube, newsletter, capex.
import Link from 'next/link';
import { DashboardPage } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DeleteIcpButton, ProposeIcpPanel } from './_client/IcpActions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WHITE = '#FFFFFF'; const HAIR = '#E6DFCC'; const INK = '#1B1B1B';
const INK_M = '#5A5A5A'; const CREAM = '#F5F0E1'; const OK = '#0E7A4B';

interface IcpRow {
  key: string; name: string; icp_type: string; priority: number;
  sort_order: number; color: string; description: string;
  property_use_case: string | null;
  yt_content_tags: string[] | null; newsletter_segment: string | null;
  target_adr_min: number; target_adr_max: number;
  target_los_min: number; target_los_max: number;
  source_countries: string[] | null; booking_channels: string[] | null;
  bookings_89d: number; revenue_89d: number;
  avg_adr_89d: number; avg_los_89d: number;
  avg_pax_89d: number; avg_stay_value_89d: number;
  top_countries_89d: string[] | null;
}

function fmt(n: number) { return new Intl.NumberFormat('en-US').format(Math.round(n)); }
function fmtK(n: number) { return n >= 1000 ? `$${(n/1000).toFixed(1)}K` : `$${Math.round(n)}`; }

function PriorityBadge({ p }: { p: number }) {
  const label = p === 1 ? 'SNIPER' : p === 2 ? 'TARGET' : 'MONITOR';
  const bg = p === 1 ? '#B03826' : p === 2 ? '#B48A3A' : '#5A5A5A';
  return <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', padding: '2px 7px', background: bg, color: '#fff', borderRadius: 2, textTransform: 'uppercase' }}>{label}</span>;
}

export default async function IcpEnginePage() {
  const sb = getSupabaseAdmin();
  const { data: icps } = await sb.from('v_icp_89day_performance' as any).select('*').order('sort_order');
  const rows = (icps ?? []) as IcpRow[];
  const b2c = rows.filter(r => r.icp_type === 'b2c');
  const b2b = rows.filter(r => r.icp_type === 'b2b');
  const total89Rev = rows.reduce((s, r) => s + Number(r.revenue_89d), 0);
  const totalBookings = rows.reduce((s, r) => s + Number(r.bookings_89d), 0);
  const top = [...rows].sort((a, b) => Number(b.avg_adr_89d) - Number(a.avg_adr_89d))[0];
  const maxRev = Math.max(...rows.map(r => Number(r.revenue_89d)), 1);

  function IcpCard({ icp, showDelete = true }: { icp: IcpRow; showDelete?: boolean }) {
    const revFrac = maxRev > 0 ? Number(icp.revenue_89d) / maxRev : 0;
    const hasData = Number(icp.bookings_89d) > 0;
    return (
      <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: icp.color || '#084838', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: WHITE }}>{icp.name}</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {icp.icp_type === 'b2c' && <PriorityBadge p={icp.priority} />}
            {icp.icp_type === 'b2b' && <span style={{ fontSize: 9, padding: '2px 7px', background: 'rgba(255,255,255,.2)', color: WHITE, borderRadius: 2, letterSpacing: '.05em' }}>B2B</span>}
          </div>
        </div>
        <div style={{ height: 4, background: CREAM }}>
          <div style={{ width: `${Math.round(revFrac * 100)}%`, height: '100%', background: icp.color || '#084838' }} />
        </div>
        <div style={{ padding: 14, flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {hasData ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {([
                { label: 'Revenue', val: fmtK(Number(icp.revenue_89d)) },
                { label: 'ADR', val: `$${fmt(Number(icp.avg_adr_89d))}` },
                { label: 'Avg LOS', val: `${Number(icp.avg_los_89d).toFixed(1)}n` },
                { label: 'Stays', val: String(icp.bookings_89d) },
              ] as Array<{label:string;val:string}>).map(k => (
                <div key={k.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: INK_M, textTransform: 'uppercase', letterSpacing: '.05em' }}>{k.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: INK, fontVariantNumeric: 'tabular-nums' }}>{k.val}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: INK_M, fontStyle: 'italic' }}>No matched stays in last 89 days — refine criteria or broaden geo.</div>
          )}
          <div style={{ fontSize: 11.5, color: INK, lineHeight: 1.6 }}>{icp.description}</div>
          {icp.property_use_case && (
            <div style={{ fontSize: 10.5, color: INK_M, padding: '6px 10px', background: CREAM, borderRadius: 3 }}>🏨 {icp.property_use_case}</div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, padding: '2px 7px', background: CREAM, borderRadius: 10 }}>ADR ${icp.target_adr_min}–${icp.target_adr_max}</span>
            <span style={{ fontSize: 10, padding: '2px 7px', background: CREAM, borderRadius: 10 }}>LOS {icp.target_los_min}–{icp.target_los_max}n</span>
            {(icp.booking_channels ?? []).map(c => (
              <span key={c} style={{ fontSize: 10, padding: '2px 7px', background: CREAM, borderRadius: 10 }}>{c}</span>
            ))}
          </div>
          <div style={{ fontSize: 10, color: INK_M }}>
            <span style={{ fontWeight: 600 }}>Markets: </span>
            {(icp.source_countries ?? []).join(' · ')}
            {hasData && icp.top_countries_89d && (
              <span style={{ color: OK }}> · Live: {icp.top_countries_89d.join(', ')}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(icp.yt_content_tags ?? []).slice(0, 4).map(t => (
              <span key={t} style={{ fontSize: 9, padding: '1px 6px', border: `1px solid ${HAIR}`, borderRadius: 10, color: INK_M }}>▶ {t}</span>
            ))}
            {icp.newsletter_segment && (
              <span style={{ fontSize: 9, padding: '1px 6px', border: `1px solid ${HAIR}`, borderRadius: 10, color: INK_M }}>✉ {icp.newsletter_segment}</span>
            )}
          </div>
        </div>
        {showDelete && (
          <div style={{ padding: '6px 14px', borderTop: `1px solid ${HAIR}`, background: '#FAFAFA', display: 'flex', justifyContent: 'flex-end' }}>
            <DeleteIcpButton icpKey={icp.key} icpName={icp.name} />
          </div>
        )}
      </div>
    );
  }

  return (
    <DashboardPage title="Sales · ICP Engine" subtitle="Ideal Customer Profiles · 89-day rolling · source: PMS bookings">
      <div style={{ display: 'grid', gap: 20, gridColumn: '1 / -1' }}>

        {/* Header KPIs */}
        <div style={{ padding: '12px 20px', background: INK, color: WHITE, borderRadius: 4, display: 'flex', gap: 40, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#aaa', marginBottom: 2 }}>89-DAY REVENUE</div>
            <div style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>${fmt(total89Rev)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#aaa', marginBottom: 2 }}>BOOKINGS MATCHED</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{totalBookings}</div>
          </div>
          {top && Number(top.avg_adr_89d) > 0 && (
            <div>
              <div style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#aaa', marginBottom: 2 }}>TOP ICP · ADR</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: top.color || WHITE }}>{top.name} · ${fmt(top.avg_adr_89d)}/night</div>
            </div>
          )}
          <div style={{ marginLeft: 'auto', fontSize: 11, color: '#888', maxWidth: 300, lineHeight: 1.5 }}>
            Sniper not shotgun. Every YouTube video, newsletter, rate offer and capex decision serves one of these profiles. 89-day window updates automatically.
          </div>
        </div>

        {/* B2C Guest Personas */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: INK_M, marginBottom: 12 }}>Guest Personas · B2C</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
            {b2c.map(icp => <IcpCard key={icp.key} icp={icp} />)}
          </div>
        </div>

        {/* B2B Outreach */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: INK_M, marginBottom: 12 }}>Outreach Segments · B2B</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
            {b2b.map(icp => <IcpCard key={icp.key} icp={icp} />)}
          </div>
        </div>

        {/* AI Research + Propose Panel */}
        <ProposeIcpPanel />

        {/* Engine note */}
        <div style={{ padding: '12px 16px', background: CREAM, borderRadius: 4, fontSize: 11, color: INK_M, lineHeight: 1.6 }}>
          <strong style={{ color: INK }}>ICP Engine · 89-day rolling</strong> — Bookings matched to ICPs by country · channel · LOS · ADR.
          Updates automatically as PMS syncs. ICPs drive: YouTube content angles · Newsletter segments · Rate proposals · Retreat outreach · Capex priorities.
        </div>
      </div>
    </DashboardPage>
  );
}
