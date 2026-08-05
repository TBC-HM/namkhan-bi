// app/sales/icp/page.tsx — ICP Engine v2 · goal-driven · criteria-based matcher · 100% classified
// PBS 2026-08-04 icp-engine-v2 brief — findings 10/11/12 resolution
import Link from 'next/link';
import { DashboardPage } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { 
  IcpCriteriaEditor, 
  IcpTargetEditor, 
  UnclassifiedDrill, 
  ProposeFromUnclassified,
  ProposalsPanel 
} from './_client/IcpV2Actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WHITE = '#FFFFFF'; const HAIR = '#E6DFCC'; const INK = '#1B1B1B';
const INK_M = '#5A5A5A'; const CREAM = '#F5F0E1'; const OK = '#0E7A4B';
const FOREST = '#084838'; const AMBER = '#B48A3A'; const RED = '#B03826';

function fmt(n: number) { return new Intl.NumberFormat('en-US').format(Math.round(n)); }
function fmtPct(n: number) { return n.toFixed(1); }

export default async function IcpEngineV2Page() {
  const sb = getSupabaseAdmin();
  
  // Container 1: Coverage
  const { data: covData } = await sb.from('v_icp_coverage' as any).select('*').single();
  const coverage = covData || { 
    bookings_total: 0, revenue_total: 0, 
    bookings_matched: 0, revenue_matched: 0,
    classified_pct: 0, revenue_matched_pct: 0, bookings_matched_pct: 0
  };

  // Container 2: Goal board
  const { data: goalData } = await sb.from('v_icp_goal_board' as any).select('*').order('sort_order');
  const goals = (goalData ?? []) as Array<{
    key: string; name: string; color: string; icp_type: string;
    criteria: any; target_share_pct: number | null; target_basis: string;
    actual_share_revenue_pct: number; actual_share_bookings_pct: number;
    gap_pct: number | null; revenue_89d: number; bookings_89d: number;
  }>;

  // Split unclassified vs real ICPs
  const unclassified = goals.find(g => g.key === 'unclassified');
  const icps = goals.filter(g => g.key !== 'unclassified');
  const b2c = icps.filter(i => i.icp_type === 'b2c');
  const b2b = icps.filter(i => i.icp_type === 'b2b');

  // Container 4: Snapshots (trend history)
  const { data: snapData } = await sb.from('v_icp_snapshots' as any)
    .select('*')
    .order('week', { ascending: true });
  const snapshots = (snapData ?? []) as Array<{
    week: string; icp_key: string; revenue: number; bookings: number;
    share_revenue_pct: number; share_bookings_pct: number;
  }>;
  const weeks = Array.from(new Set(snapshots.map(s => s.week))).sort();

  // Container 5: Trend feeds
  const { data: feedData } = await sb.from('v_icp_trend_feed_status' as any).select('*');
  const feeds = (feedData ?? []) as Array<{
    feed: string; row_count: number; is_dormant: boolean; 
    status_label: string; latest_data_date: string | null;
  }>;

  // Container 6: Proposals
  const { data: propData } = await sb.from('v_icp_proposals' as any)
    .select('*')
    .eq('status', 'draft')
    .order('rank');
  const proposals = (propData ?? []) as Array<{
    id: number; rank: number; proposal_type: string; icp_key: string;
    proposal: string; evidence: any;
  }>;

  function GapBadge({ gap }: { gap: number | null }) {
    if (gap === null) return <span style={{ fontSize: 9, color: INK_M, fontStyle: 'italic' }}>no target</span>;
    const abs = Math.abs(gap);
    if (abs < 2) return <span style={{ fontSize: 10, fontWeight: 600, color: OK }}>on track</span>;
    if (gap < 0) return <span style={{ fontSize: 10, fontWeight: 600, color: AMBER }}>under {abs.toFixed(1)}pts</span>;
    return <span style={{ fontSize: 10, fontWeight: 600, color: OK }}>over +{abs.toFixed(1)}pts</span>;
  }

  function IcpGoalCard({ icp }: { icp: typeof icps[0] }) {
    const hasData = icp.bookings_89d > 0;
    const basis = icp.target_basis === 'revenue' ? 'revenue' : 'bookings';
    const actualShare = basis === 'revenue' 
      ? icp.actual_share_revenue_pct 
      : icp.actual_share_bookings_pct;
    
    return (
      <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ background: icp.color || FOREST, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: WHITE }}>{icp.name}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {icp.icp_type === 'b2b' && (
              <span style={{ fontSize: 9, padding: '2px 6px', background: 'rgba(255,255,255,.2)', color: WHITE, borderRadius: 2 }}>B2B</span>
            )}
          </div>
        </div>
        
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Target vs Actual */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: 9, color: INK_M, textTransform: 'uppercase', letterSpacing: '.05em' }}>Target</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: INK }}>
                {icp.target_share_pct !== null ? `${icp.target_share_pct}%` : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: INK_M, textTransform: 'uppercase', letterSpacing: '.05em' }}>Actual</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: INK }}>{fmtPct(actualShare)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: INK_M, textTransform: 'uppercase', letterSpacing: '.05em' }}>Gap</div>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}><GapBadge gap={icp.gap_pct} /></div>
            </div>
          </div>

          {/* 89d data */}
          {hasData ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11, padding: '8px 0', borderTop: `1px solid ${HAIR}`, borderBottom: `1px solid ${HAIR}` }}>
              <div><span style={{ color: INK_M }}>Bookings:</span> <strong>{icp.bookings_89d}</strong></div>
              <div><span style={{ color: INK_M }}>Revenue:</span> <strong>${fmt(icp.revenue_89d)}</strong></div>
            </div>
          ) : (
            <div style={{ fontSize: 10, color: RED, fontStyle: 'italic', padding: '6px 0', borderTop: `1px solid ${HAIR}`, borderBottom: `1px solid ${HAIR}` }}>
              {icp.icp_type === 'b2b' 
                ? '⚠️ No matched bookings · B2B pipeline not connected (finding 11)'
                : '⚠️ No matched bookings in 89d — refine criteria or broaden markets'}
            </div>
          )}

          {/* Criteria display */}
          <div style={{ fontSize: 10, color: INK_M, lineHeight: 1.5 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Matching criteria:</div>
            <pre style={{ background: CREAM, padding: 6, borderRadius: 3, fontSize: 9, overflow: 'auto', margin: 0 }}>
              {JSON.stringify(icp.criteria, null, 2)}
            </pre>
          </div>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <IcpCriteriaEditor icpKey={icp.key} icpName={icp.name} currentCriteria={icp.criteria} />
            <IcpTargetEditor 
              icpKey={icp.key} 
              icpName={icp.name} 
              currentTarget={icp.target_share_pct} 
              basis={icp.target_basis}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardPage 
      title="ICP Engine v2 · Goal-Driven" 
      subtitle="100% classified · criteria-driven matcher · findings 10+11+12 resolution"
    >
      <div style={{ display: 'grid', gap: 20, gridColumn: '1 / -1' }}>

        {/* Container 1: Coverage Header */}
        <div style={{ padding: '16px 20px', background: coverage.classified_pct >= 95 ? OK : AMBER, color: WHITE, borderRadius: 6 }}>
          <div style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', opacity: 0.9, marginBottom: 4 }}>
            COVERAGE · LAST 89 DAYS (revenue-bearing stays only)
          </div>
          <div style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{coverage.classified_pct.toFixed(1)}%</div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>
                {coverage.bookings_matched} of {coverage.bookings_total} bookings classified
              </div>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{coverage.revenue_matched_pct.toFixed(1)}%</div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>
                ${fmt(coverage.revenue_matched)} of ${fmt(coverage.revenue_total)} revenue
              </div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 11, maxWidth: 360, lineHeight: 1.5, opacity: 0.95 }}>
              {coverage.classified_pct >= 95 
                ? '✓ Target met: ≥95% classified. Matcher is honest — 100% of stays bucketed (ICP or Unclassified).'
                : `⚠️ Target ≥95% classified. Current: ${coverage.classified_pct.toFixed(1)}%. Review unclassified bucket below.`}
            </div>
          </div>
        </div>

        {/* Container 3: Unclassified Bucket (first-class, before goal ICPs per brief) */}
        {unclassified && (
          <div style={{ background: WHITE, border: `2px solid ${AMBER}`, borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ background: AMBER, padding: '12px 16px', color: WHITE }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Unclassified Bucket · First-Class</div>
              <div style={{ fontSize: 10, opacity: 0.9, marginTop: 2 }}>
                Revenue-bearing stays with no ICP match — opportunity to discover new segments
              </div>
            </div>
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: INK_M, textTransform: 'uppercase', letterSpacing: '.05em' }}>Bookings</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: INK }}>{unclassified.bookings_89d}</div>
                <div style={{ fontSize: 10, color: INK_M }}>{fmtPct(unclassified.actual_share_bookings_pct)}% of total</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: INK_M, textTransform: 'uppercase', letterSpacing: '.05em' }}>Revenue</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: INK }}>${fmt(unclassified.revenue_89d)}</div>
                <div style={{ fontSize: 10, color: INK_M }}>{fmtPct(unclassified.actual_share_revenue_pct)}% of total</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
                <UnclassifiedDrill count={unclassified.bookings_89d} />
                <ProposeFromUnclassified />
              </div>
            </div>
          </div>
        )}

        {/* Container 2: Goal ICP Board — B2C */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: INK_M, marginBottom: 12 }}>
            Goal ICPs · B2C Guest Personas
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {b2c.map(icp => <IcpGoalCard key={icp.key} icp={icp} />)}
          </div>
        </div>

        {/* Container 2: Goal ICP Board — B2B */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: INK_M, marginBottom: 12 }}>
            Goal ICPs · B2B Outreach Segments
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {b2b.map(icp => <IcpGoalCard key={icp.key} icp={icp} />)}
          </div>
        </div>

        {/* Container 4: Actual vs Goal Mix (snapshot history) */}
        {weeks.length > 0 && (
          <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 12 }}>
              Actual vs Goal Mix · Historical Snapshots
            </div>
            <div style={{ fontSize: 10, color: INK_M, marginBottom: 12 }}>
              Weekly snapshots (append-only). Basis: revenue share. Unclassified included.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {weeks.slice(-4).map(week => {
                const weekSnaps = snapshots.filter(s => s.week === week);
                return (
                  <div key={week} style={{ borderBottom: `1px solid ${HAIR}`, paddingBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: INK_M, marginBottom: 6 }}>
                      Week {week}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {weekSnaps.map(s => {
                        const icp = goals.find(g => g.key === s.icp_key);
                        const color = icp?.color || INK_M;
                        const name = icp?.name || s.icp_key;
                        return (
                          <div 
                            key={s.icp_key} 
                            style={{ 
                              fontSize: 9, 
                              padding: '3px 8px', 
                              background: color, 
                              color: WHITE, 
                              borderRadius: 3,
                              display: 'flex',
                              gap: 4
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>{name.slice(0, 20)}</span>
                            <span>{s.share_revenue_pct.toFixed(1)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Container 5: Trend Signals (honest dormant state) */}
        <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ background: FOREST, padding: '12px 16px', color: WHITE }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Trend Signals · Market Intelligence</div>
            <div style={{ fontSize: 10, opacity: 0.9, marginTop: 2 }}>
              External signals mapped to goal ICPs (flight capacity, search volume, market calendar)
            </div>
          </div>
          <div style={{ padding: 16 }}>
            {feeds.every(f => f.is_dormant) ? (
              <div style={{ fontSize: 11, color: INK_M, fontStyle: 'italic', lineHeight: 1.6 }}>
                All trend feeds dormant (no data ever ingested). Signals module lands when ≥1 feed is active.
                Current feeds: {feeds.map(f => f.feed).join(', ')}.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {feeds.map(f => (
                  <div key={f.feed} style={{ fontSize: 11, padding: '8px 12px', background: f.is_dormant ? CREAM : '#E8F5E9', borderRadius: 4 }}>
                    <strong>{f.feed}</strong>: {f.status_label}
                    {f.latest_data_date && <span style={{ color: INK_M }}> · latest {f.latest_data_date}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Container 6: Research Loop Panel (PBS-gated proposals) */}
        <ProposalsPanel proposals={proposals} />

        {/* Footer note */}
        <div style={{ padding: '12px 16px', background: CREAM, borderRadius: 4, fontSize: 11, color: INK_M, lineHeight: 1.6 }}>
          <strong style={{ color: INK }}>ICP Engine v2 (2026-08-04):</strong> Goal-driven, not past-driven. 
          ICPs defined by goals + market trends; bookings VALIDATE, they do not DEFINE. 
          Matcher reads criteria at runtime (sales.icp_segments.criteria — ONLY source). 
          100% of revenue-bearing stays classified. Weekly snapshots append-only. 
          Unclassified is an opportunity signal, not an error. 
          Resolves findings 10 (loop now real), 11 (B2B honest zero-state), 12 (matcher criteria-driven, no hardcoded market rules).
        </div>
      </div>
    </DashboardPage>
  );
}
