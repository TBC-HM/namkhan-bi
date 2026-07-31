// app/sales/icp/page.tsx — ICP Engine · data-driven, 89-day rolling
// ICPs are the base for all sales, marketing, YouTube, newsletter, capex.
// Source: pms.v_reservations matched to sales.icp_segments by country/LOS/ADR/channel.
import Link from 'next/link';
import { DashboardPage } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WHITE = '#FFFFFF'; const HAIR = '#E6DFCC'; const INK = '#1B1B1B';
const INK_M = '#5A5A5A'; const CREAM = '#F5F0E1'; const RED = '#B03826';
const OK = '#0E7A4B';

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
  return (
    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', padding: '2px 7px',
      background: bg, color: '#fff', borderRadius: 2, textTransform: 'uppercase' }}>
      {label}
    </span>
  );
}

export default async function IcpEnginePage() {
  const sb = getSupabaseAdmin();
  const { data: icps } = await sb.from('v_icp_89day_performance')
    .select('*').order('sort_order');

  const rows = (icps ?? []) as IcpRow[];
  const b2c = rows.filter(r => r.icp_type === 'b2c');
  const b2b = rows.filter(r => r.icp_type === 'b2b');

  const total89Rev = rows.reduce((s, r) => s + Number(r.revenue_89d), 0);
  const top = [...rows].sort((a, b) => Number(b.avg_adr_89d) - Number(a.avg_adr_89d))[0];
  const totalBookings = rows.reduce((s, r) => s + Number(r.bookings_89d), 0);
  const maxRev = Math.max(...rows.map(r => Number(r.revenue_89d)), 1);

  return (
    <DashboardPage title="Sales · ICP Engine" subtitle="Ideal Customer Profiles · 89-day rolling · data from PMS">
      <div style={{ display: 'grid', gap: 20, gridColumn: '1 / -1' }}>

        {/* Header */}
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
          <div style={{ marginLeft: 'auto', fontSize: 11, color: '#888', maxWidth: 280, lineHeight: 1.5 }}>
            ICPs are the foundation. Every YouTube video, newsletter, rate offer, and capex decision should serve one of these profiles.
          </div>
        </div>

        {/* B2C ICPs — Guest Personas */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: INK_M, marginBottom: 12 }}>Guest Personas · B2C</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
            {b2c.map(icp => {
              const revFrac = maxRev > 0 ? Number(icp.revenue_89d) / maxRev : 0;
              const hasData = Number(icp.bookings_89d) > 0;
              return (
                <div key={icp.key} style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, overflow: 'hidden' }}>
                  {/* Color bar + header */}
                  <div style={{ background: icp.color || '#084838', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: WHITE }}>{icp.name}</div>
                    <PriorityBadge p={icp.priority} />
                  </div>

                  {/* 89-day revenue bar */}
                  <div style={{ height: 4, background: CREAM }}>
                    <div style={{ width: `${Math.round(revFrac * 100)}%`, height: '100%', background: icp.color || '#084838' }} />
                  </div>

                  <div style={{ padding: 14 }}>
                    {/* 89-day KPIs */}
                    {hasData ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                        {[
                          { label: 'Revenue', val: fmtK(Number(icp.revenue_89d)) },
                          { label: 'ADR', val: `$${fmt(Number(icp.avg_adr_89d))}` },
                          { label: 'Avg LOS', val: `${Number(icp.avg_los_89d).toFixed(1)}n` },
                          { label: 'Stays', val: String(icp.bookings_89d) },
                        ].map(k => (
                          <div key={k.label} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 9, color: INK_M, textTransform: 'uppercase', letterSpacing: '.05em' }}>{k.label}</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: INK, fontVariantNumeric: 'tabular-nums' }}>{k.val}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: '8px 0', marginBottom: 10, fontSize: 11, color: INK_M, fontStyle: 'italic' }}>
                        No matched stays in last 89 days — refine criteria or broaden geo.
                      </div>
                    )}

                    {/* Description */}
                    <div style={{ fontSize: 11.5, color: INK, lineHeight: 1.6, marginBottom: 10 }}>{icp.description}</div>

                    {/* Use case */}
                    {icp.property_use_case && (
                      <div style={{ fontSize: 10.5, color: INK_M, lineHeight: 1.5, padding: '6px 10px', background: CREAM, borderRadius: 3, marginBottom: 10 }}>
                        🏨 {icp.property_use_case}
                      </div>
                    )}

                    {/* Target spec */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                      <span style={{ fontSize: 10, padding: '2px 7px', background: CREAM, borderRadius: 10 }}>ADR ${icp.target_adr_min}–${icp.target_adr_max}</span>
                      <span style={{ fontSize: 10, padding: '2px 7px', background: CREAM, borderRadius: 10 }}>LOS {icp.target_los_min}–{icp.target_los_max}n</span>
                      {(icp.booking_channels ?? []).map(c => (
                        <span key={c} style={{ fontSize: 10, padding: '2px 7px', background: CREAM, borderRadius: 10 }}>{c}</span>
                      ))}
                    </div>

                    {/* Countries */}
                    <div style={{ fontSize: 10, color: INK_M, marginBottom: 8 }}>
                      <span style={{ fontWeight: 600 }}>Markets: </span>
                      {(icp.source_countries ?? []).join(' · ')}
                      {hasData && icp.top_countries_89d && (
                        <span style={{ color: OK }}> · Live: {icp.top_countries_89d.join(', ')}</span>
                      )}
                    </div>

                    {/* YT + Newsletter tags */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(icp.yt_content_tags ?? []).slice(0, 4).map(t => (
                        <span key={t} style={{ fontSize: 9, padding: '1px 6px', border: `1px solid ${HAIR}`, borderRadius: 10, color: INK_M }}>▶ {t}</span>
                      ))}
                      {icp.newsletter_segment && (
                        <span style={{ fontSize: 9, padding: '1px 6px', border: `1px solid ${HAIR}`, borderRadius: 10, color: INK_M }}>✉ {icp.newsletter_segment}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* B2B ICPs */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: INK_M, marginBottom: 12 }}>Outreach Segments · B2B</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
            {b2b.map(icp => (
              <div key={icp.key} style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ background: icp.color || '#B48A3A', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: WHITE }}>{icp.name}</div>
                  <span style={{ fontSize: 9, padding: '2px 7px', background: 'rgba(255,255,255,.2)', color: WHITE, borderRadius: 2, letterSpacing: '.05em' }}>B2B</span>
                </div>
                <div style={{ padding: 14 }}>
                  {Number(icp.bookings_89d) > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                      {[
                        { label: 'Revenue', val: fmtK(Number(icp.revenue_89d)) },
                        { label: 'ADR', val: `$${fmt(Number(icp.avg_adr_89d))}` },
                        { label: 'Avg LOS', val: `${Number(icp.avg_los_89d).toFixed(1)}n` },
                      ].map(k => (
                        <div key={k.label} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 9, color: INK_M, textTransform: 'uppercase', letterSpacing: '.05em' }}>{k.label}</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: INK, fontVariantNumeric: 'tabular-nums' }}>{k.val}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 11.5, color: INK, lineHeight: 1.6, marginBottom: 8 }}>{icp.description}</div>
                  <div style={{ fontSize: 10, color: INK_M }}>
                    {(icp.source_countries ?? []).join(' · ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Engine note */}
        <div style={{ padding: '12px 16px', background: CREAM, borderRadius: 4, fontSize: 11, color: INK_M, lineHeight: 1.6 }}>
          <strong style={{ color: INK }}>ICP Engine · 89-day rolling</strong> — Bookings are matched to ICPs by country, channel, LOS and ADR.
          Revenue and ADR update automatically as new bookings sync from the PMS.
          ICPs drive: YouTube content angles · Newsletter segments · Rate proposals · Retreat outreach · Capex priorities.
        </div>
      </div>
    </DashboardPage>
  );
}
