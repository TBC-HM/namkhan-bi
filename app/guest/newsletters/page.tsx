// app/guest/newsletters/page.tsx
// PBS 2026-07-22 late-EOD · Overview cockpit rewrite.
// Human-first analytics: Subscribers · Sent this year · This month · In queue ·
// Unsubscribed · New emails 30d · Open/Click/Response rate.
// Per-group breakdown + last 20 sends with metrics.
// Stage 2 (self-learning WHY-annotations) wired later by Mira the Learner.

import type { CSSProperties } from 'react';
import TenantLink from '@/components/nav/TenantLink';
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { GUEST_SUBPAGES } from '../_subpages';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import NewslettersSubStrip from './_components/NewslettersSubStrip';
import ProposeNewsletterButton from './_components/ProposeNewsletterButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type CampaignRow = {
  campaign_id: string; property_id: number; name: string; status: string; subject: string;
  schedule_kind: string | null; scheduled_at: string | null; last_run_at: string | null;
  relative_kind: string | null; relative_days: number | null; relative_hour: number | null;
  template_key: string | null; group_slug: string | null;
  send_count: number; opens_count: number; clicks_count: number; unsub_count: number; booking_count: number;
  recipients_count: number; pending_count: number; queued_count: number; failed_count: number;
  created_by: string | null; created_at: string; updated_at: string; archived_at: string | null;
  planned_date: string | null; campaign_kind?: string | null;
};

type GroupRow = { slug: string; name: string; color: string | null; member_count: number };

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }); }
  catch { return '—'; }
}
function pctOr(n: number, d: number): string { if (!d) return '—'; return `${((n/d)*100).toFixed(1)}%`; }

// KPI tile primitive · gold accent · clean minimal
function KpiTile({ label, value, sub, accent = '#B48A3A' }: { label: string; value: string; sub?: string; accent?: string }) {
  const wrap: CSSProperties = {
    background: '#FFFFFF', border: '1px solid #E6DFCC', borderTop: `3px solid ${accent}`,
    borderRadius: 6, padding: '10px 12px', minHeight: 78,
    display: 'flex', flexDirection: 'column', gap: 2,
  };
  return (
    <div style={wrap}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5A5A5A' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#1B1B1B', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#8A8A8A', marginTop: 'auto' }}>{sub}</div>}
    </div>
  );
}

interface PageProps { propertyId?: number }

export default async function NewslettersPage({ propertyId }: PageProps = {}) {
  const pid = propertyId ?? PROPERTY_ID;
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const past30d = new Date(Date.now() - 30*24*3600*1000).toISOString();

  const [campRes, groupsRes, sendRes, subsRes] = await Promise.all([
    supabase.from('v_guest_campaigns').select('*')
      .eq('property_id', pid).is('archived_at', null)
      .order('updated_at', { ascending: false }),
    supabase.from('v_subscriber_groups').select('slug, name, color, member_count').order('sort_order'),
    supabase.from('v_marketing_email_send_history')
      .select('property_id, sent_at, delivery_status, campaign_id')
      .eq('property_id', pid).gte('sent_at', yearStart),
    supabase.from('marketing.subscribers' as never)
      .select('subscriber_id, created_at, status')
      .eq('property_id', pid).gte('created_at', past30d),
  ]);

  const allRows: CampaignRow[] = (campRes.data as CampaignRow[]) ?? [];
  const groups: GroupRow[] = (groupsRes.data as GroupRow[]) ?? [];
  const sendHistory = (sendRes.data as Array<{ sent_at: string; delivery_status: string; campaign_id: string | null }> | null) ?? [];
  const newSubs30d = ((subsRes.data as Array<{ created_at: string }> | null) ?? []).length;

  // ==== KPIs ====
  const subscribersTotal = groups.reduce((s, g) => s + (g.member_count || 0), 0);
  const sentThisYear = sendHistory.length;
  const sentThisMonth = sendHistory.filter(x => x.sent_at >= monthStart).length;
  const inQueueTotal = allRows.reduce((s, r) => s + (r.pending_count || 0) + (r.queued_count || 0), 0);
  const totalUnsub = allRows.reduce((s, r) => s + (r.unsub_count || 0), 0);
  const totalSent = allRows.reduce((s, r) => s + (r.send_count || 0), 0);
  const totalOpens = allRows.reduce((s, r) => s + (r.opens_count || 0), 0);
  const totalClicks = allRows.reduce((s, r) => s + (r.clicks_count || 0), 0);
  const totalBookings = allRows.reduce((s, r) => s + (r.booking_count || 0), 0);
  const openRate = totalSent > 0 ? (totalOpens / totalSent) * 100 : 0;
  const clickRate = totalSent > 0 ? (totalClicks / totalSent) * 100 : 0;
  const responseRate = totalSent > 0 ? (totalBookings / totalSent) * 100 : 0;

  // ==== Per-group breakdown ====
  const perGroup = groups.map(g => {
    const groupCamps = allRows.filter(r => r.group_slug === g.slug);
    const sent = groupCamps.reduce((s, r) => s + (r.send_count || 0), 0);
    const opens = groupCamps.reduce((s, r) => s + (r.opens_count || 0), 0);
    const clicks = groupCamps.reduce((s, r) => s + (r.clicks_count || 0), 0);
    const unsub = groupCamps.reduce((s, r) => s + (r.unsub_count || 0), 0);
    return { ...g, campaigns: groupCamps.length, sent, opens, clicks, unsub };
  });

  // ==== Last 20 sends for effectiveness table ====
  const recentSent = allRows.filter(r => r.status === 'sent' && (r.send_count || 0) > 0)
    .sort((a,b) => (b.last_run_at ?? b.updated_at).localeCompare(a.last_run_at ?? a.updated_at))
    .slice(0, 20);

  const tabs: DashboardTab[] = GUEST_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/guest/newsletters',
  }));

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage
        title="Contacts · Newsletters"
        subtitle={`${subscribersTotal.toLocaleString()} subscribers · ${sentThisYear.toLocaleString()} sends year-to-date · one cockpit for the whole engine.`}
        tabs={tabs}>
        <NewslettersSubStrip active="broadcasts" />

        {/* KPI stripe · gold accent · 8 human-first tiles */}
        <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10, marginBottom:6 }}>
          <KpiTile label="Subscribers" value={subscribersTotal.toLocaleString()} sub={`across ${groups.length} groups`} />
          <KpiTile label="Sent this year" value={sentThisYear.toLocaleString()} sub={`from ${new Date(yearStart).getFullYear()}-01-01`} />
          <KpiTile label="Sent this month" value={sentThisMonth.toLocaleString()} sub="calendar month to date" />
          <KpiTile label="In queue" value={inQueueTotal.toLocaleString()} sub="pending + queued recipients" accent="#084838" />
          <KpiTile label="Unsubscribed" value={totalUnsub.toLocaleString()} sub="lifetime opt-outs" accent="#B03826" />
          <KpiTile label="New emails · last 30d" value={newSubs30d.toLocaleString()} sub="net new subscribers" accent="#4A6A3A" />
          <KpiTile label="Open rate" value={openRate.toFixed(1) + '%'} sub={`${totalOpens.toLocaleString()} opens / ${totalSent.toLocaleString()} sends`} />
          <KpiTile label="Click rate" value={clickRate.toFixed(1) + '%'} sub={`${totalClicks.toLocaleString()} clicks · ${responseRate.toFixed(2)}% booked`} />
        </div>

        <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'flex-end', gap:8, alignItems:'center', marginTop:6 }}>
          <TenantLink href="/guest/newsletters/broadcasts" style={secondaryButton}>Broadcasts</TenantLink>
          <TenantLink href="/guest/newsletters/lifecycle" style={secondaryButton}>Lifecycle</TenantLink>
          <TenantLink href="/guest/newsletters/director" style={secondaryButton}>Open Director</TenantLink>
          <TenantLink href="/guest/newsletters/templates" style={secondaryButton}>Templates</TenantLink>
          <ProposeNewsletterButton propertyId={pid} defaultKind="broadcast" />
        </div>

        {campRes.error && <div style={{ ...errorBox, gridColumn:'1 / -1' }}>Could not load campaigns: {campRes.error.message}</div>}

        {/* Per-group breakdown */}
        <div style={{ gridColumn:'1 / -1' }}>
          <div style={sectionHeader}>Per-group performance · lifetime</div>
          <div style={tableWrap}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr style={{ background:'#FAFAF7', borderBottom:'1px solid #E6DFCC' }}>
                <th style={th}>Group</th>
                <th style={{ ...th, textAlign:'right' }}>Members</th>
                <th style={{ ...th, textAlign:'right' }}>Campaigns</th>
                <th style={{ ...th, textAlign:'right' }}>Sent</th>
                <th style={{ ...th, textAlign:'right' }}>Opens</th>
                <th style={{ ...th, textAlign:'right' }}>Clicks</th>
                <th style={{ ...th, textAlign:'right' }}>Unsubs</th>
                <th style={{ ...th, textAlign:'right' }}>Open %</th>
                <th style={{ ...th, textAlign:'right' }}>Click %</th>
              </tr></thead>
              <tbody>
                {perGroup.map((g) => (
                  <tr key={g.slug} style={{ borderBottom:'1px solid #E6DFCC', background:'#FFFFFF' }}>
                    <td style={tdL}>
                      <span style={{ display:'inline-block', width:8, height:8, borderRadius:2, background: g.color ?? '#7A4B2A', marginRight:8 }} />
                      {g.name}
                    </td>
                    <td style={tdR}>{g.member_count.toLocaleString()}</td>
                    <td style={tdR}>{g.campaigns}</td>
                    <td style={tdR}>{g.sent.toLocaleString()}</td>
                    <td style={tdR}>{g.opens.toLocaleString()}</td>
                    <td style={tdR}>{g.clicks.toLocaleString()}</td>
                    <td style={tdR}>{g.unsub}</td>
                    <td style={tdR}>{pctOr(g.opens, g.sent)}</td>
                    <td style={tdR}>{pctOr(g.clicks, g.sent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Last 20 sends · effectiveness table · placeholder for Mira's WHY-annotations */}
        <div style={{ gridColumn:'1 / -1' }}>
          <div style={sectionHeader}>Recent sends · effectiveness</div>
          {recentSent.length === 0 ? (
            <div style={emptyState}>No campaigns sent yet. Once real sends happen, each will appear here with its numbers and (stage 2) a one-line WHY-annotation from Mira the Learner explaining what worked.</div>
          ) : (
            <div style={tableWrap}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ background:'#FAFAF7', borderBottom:'1px solid #E6DFCC' }}>
                  <th style={th}>Campaign</th><th style={th}>Sent</th>
                  <th style={{ ...th, textAlign:'right' }}>Recipients</th>
                  <th style={{ ...th, textAlign:'right' }}>Open %</th>
                  <th style={{ ...th, textAlign:'right' }}>Click %</th>
                  <th style={{ ...th, textAlign:'right' }}>Bookings</th>
                  <th style={{ ...th, textAlign:'right' }}>Unsubs</th>
                  <th style={th}>Why this worked / didn&apos;t</th>
                </tr></thead>
                <tbody>
                  {recentSent.map((r) => (
                    <tr key={r.campaign_id} style={{ borderBottom:'1px solid #E6DFCC', background:'#FFFFFF' }}>
                      <td style={{ ...tdL, maxWidth:260 }}>
                        <TenantLink href={`/guest/newsletters/${r.campaign_id}`} style={{ fontWeight:600, color:'#084838', textDecoration:'none' }}>{r.name}</TenantLink>
                        <div style={{ fontSize:11, color:'#5A5A5A', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.subject}</div>
                      </td>
                      <td style={tdL}>{fmtDate(r.last_run_at)}</td>
                      <td style={tdR}>{r.send_count.toLocaleString()}</td>
                      <td style={tdR}>{pctOr(r.opens_count, r.send_count)}</td>
                      <td style={tdR}>{pctOr(r.clicks_count, r.send_count)}</td>
                      <td style={tdR}>{r.booking_count}</td>
                      <td style={tdR}>{r.unsub_count}</td>
                      <td style={{ ...tdL, fontStyle:'italic', color:'#8A8A8A', fontSize:11 }}>Awaiting Mira · stage 2</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DashboardPage>
    </div>
  );
}

const secondaryButton: CSSProperties = { padding:'6px 14px', fontSize:12, fontWeight:600, background:'#FFFFFF', color:'#1F3A2E', border:'1px solid #E6DFCC', borderRadius:4, textDecoration:'none' };
const sectionHeader: CSSProperties = { fontSize:11, letterSpacing:'0.06em', textTransform:'uppercase', color:'#5A5A5A', fontWeight:600, margin:'14px 2px 8px' };
const emptyState: CSSProperties = { padding:'16px 20px', fontSize:12, color:'#5A5A5A', background:'#FAFAF7', border:'1px dashed #E6DFCC', borderRadius:6, fontStyle:'italic' };
const tableWrap: CSSProperties = { border:'1px solid #E6DFCC', borderRadius:6, overflow:'hidden', background:'#FFFFFF' };
const errorBox: CSSProperties = { padding:12, background:'#FBE8E4', color:'#8A2419', border:'1px solid #E8B7AB', borderRadius:4, marginBottom:16, fontSize:13 };
const th: CSSProperties = { padding:'8px 10px', fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'#1B1B1B', textAlign:'left' };
const tdL: CSSProperties = { padding:'8px 10px', fontSize:12, color:'#1B1B1B' };
const tdR: CSSProperties = { padding:'8px 10px', fontSize:12, textAlign:'right', fontVariantNumeric:'tabular-nums', color:'#1B1B1B' };
