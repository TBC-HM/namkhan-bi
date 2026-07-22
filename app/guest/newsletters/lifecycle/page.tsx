// app/guest/newsletters/lifecycle/page.tsx
// PBS 2026-07-22 EOD · Group-boxed layout — one visual box per group.
// Real Guest bucket first (group_slug=NULL), then OTA Traveller + any others with rows.
// Each box: color-chip header + inline campaign list (compact table).

import type { CSSProperties } from 'react';
import TenantLink from '@/components/nav/TenantLink';
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { GUEST_SUBPAGES } from '../../_subpages';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import ScheduleDrawer from '../_components/ScheduleDrawer';
import HaltButton from '../_components/HaltButton';
import RecipientsButton from '../_components/RecipientsButton';
import DeleteCampaignButton from '../_components/DeleteCampaignButton';
import NewslettersSubStrip from '../_components/NewslettersSubStrip';
import ProposeNewsletterButton from '../_components/ProposeNewsletterButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type CampaignRow = {
  campaign_id: string; property_id: number; name: string; status: string; subject: string;
  schedule_kind: string; scheduled_at: string | null; next_run_at: string | null; last_run_at: string | null;
  relative_kind: string | null; relative_days: number | null; relative_hour: number | null;
  template_key: string | null; booking_code: string | null;
  send_count: number; opens_count: number; clicks_count: number; unsub_count: number; booking_count: number;
  recipients_count: number; pending_count: number; queued_count: number; failed_count: number;
  created_by: string | null; created_at: string; updated_at: string; archived_at: string | null;
  planned_date: string | null;
  campaign_kind?: string | null;
  audience_type?: string | null;
  goal_tag?: string | null;
  group_slug?: string | null;
};

type GroupMeta = { slug: string; name: string; color: string; sort_order: number };

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
  catch { return '—'; }
}
function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }); }
  catch { return '—'; }
}
function fmtLifecycleTrigger(row: CampaignRow): string {
  if (row.relative_kind === 'booking_confirm' && row.relative_days != null)
    return row.relative_days === 0
      ? `On booking · ${String(row.relative_hour ?? 10).padStart(2,'0')}:00`
      : `${row.relative_days}d after booking · ${String(row.relative_hour ?? 10).padStart(2,'0')}:00`;
  if (row.relative_kind === 'before_checkin' && row.relative_days != null)
    return `${row.relative_days}d before check-in · ${String(row.relative_hour ?? 10).padStart(2,'0')}:00`;
  if (row.relative_kind === 'after_checkout' && row.relative_days != null)
    return `${row.relative_days}d after check-out · ${String(row.relative_hour ?? 10).padStart(2,'0')}:00`;
  if (row.schedule_kind === 'birthday') return 'On guest birthday · 10:00';
  if (row.schedule_kind === 'winback') return 'Auto · Winback trigger';
  if (row.planned_date) return fmtDate(row.planned_date);
  return row.schedule_kind ?? '—';
}
function pctOr(n: number, d: number): string { if (!d) return '—'; return `${((n / d) * 100).toFixed(0)}%`; }

interface PageProps { propertyId?: number }

export default async function LifecyclePage({ propertyId }: PageProps = {}) {
  const pid = propertyId ?? PROPERTY_ID;

  const [campaignsRes, groupsRes] = await Promise.all([
    supabase.from('v_guest_campaigns').select('*').eq('property_id', pid).is('archived_at', null)
      .order('updated_at', { ascending: false }),
    supabase.from('v_subscriber_groups').select('slug, name, color, sort_order, member_count').order('sort_order'),
  ]);
  const allRows: CampaignRow[] = (campaignsRes.data as CampaignRow[]) ?? [];
  const rows = allRows.filter((r) => (r.campaign_kind ?? 'broadcast') === 'lifecycle');
  const groups: (GroupMeta & { member_count?: number })[] = (groupsRes.data as any) ?? [];

  // Membership of the 3 groups that feed the "Real Guest" bucket
  const memCount = (slug: string) => groups.find(g => g.slug === slug)?.member_count ?? 0;
  const seaCount = memCount('guests-sea');
  const intCount = memCount('guests-int');
  const retCount = memCount('returning-guests');
  const realTotal = seaCount + intCount + retCount;

  // bucket rows by group_slug ('__real__' = NULL bucket)
  const byGroup = new Map<string, CampaignRow[]>();
  for (const r of rows) {
    const key = r.group_slug ?? '__real__';
    (byGroup.get(key) ?? byGroup.set(key, []).get(key)!).push(r);
  }

  // canonical order: Real Guest bucket first, then subscriber_groups by sort_order
  const boxOrder: GroupMeta[] = [
    { slug: '__real__', name: 'Real Guest', color: '#4A6A3A', sort_order: -1 },
    ...groups,
  ];

  const tabs: DashboardTab[] = GUEST_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/guest/newsletters',
  }));

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage title="Contacts · Lifecycle emails"
        subtitle={`${rows.length} lifecycle campaign${rows.length === 1 ? '' : 's'} · one box per audience group.`} tabs={tabs}>
        <NewslettersSubStrip active="lifecycle" />

        <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'flex-end', gap:8, alignItems:'center' }}>
          <TenantLink href="/guest/newsletters/templates" style={secondaryButton}>Manage templates</TenantLink>
          <ProposeNewsletterButton propertyId={pid} defaultKind="lifecycle" />
          <TenantLink href="/guest/directory" style={ctaButton}>+ New lifecycle campaign</TenantLink>
        </div>

        {campaignsRes.error && <div style={{ ...errorBox, gridColumn:'1 / -1' }}>Could not load: {campaignsRes.error.message}</div>}

        {boxOrder.map((g) => {
          const groupRows = byGroup.get(g.slug) ?? [];
          const isRealGuest = g.slug === '__real__';
          const otaCount = g.slug === 'ota-traveller' ? memCount('ota-traveller') : 0;
          // PBS 2026-07-22 late-EOD: render every subscriber_group box always, empty state when no lifecycle campaigns
          const active = groupRows.filter(r => r.status === 'scheduled' || r.status === 'sending');
          const drafts = groupRows.filter(r => r.status === 'draft');
          const sent   = groupRows.filter(r => r.status === 'sent');

          return (
            <div key={g.slug} style={{ ...groupBox, borderTopColor: g.color, gridColumn:'1 / -1' }}>
              <div style={{ padding:'10px 14px', borderBottom:`1px solid ${HAIR}`, background:'#FAFAF7' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ width:12, height:12, borderRadius:2, background:g.color, border:`1px solid ${HAIR}` }} />
                  <div style={{ fontSize:13, fontWeight:700, color:INK }}>{g.name}</div>
                  <div style={{ marginLeft:'auto', fontSize:11, color:INK_S }}>
                    {groupRows.length} campaign{groupRows.length === 1 ? '' : 's'} · {active.length} active · {drafts.length} draft · {sent.length} sent
                  </div>
                </div>
                {isRealGuest && (
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:6, fontSize:11, color:INK_S, paddingLeft:22, flexWrap:'wrap' }}>
                    <span style={{ color:INK_S }}>Fires for reservation guests in:</span>
                    <span style={pillStyle('#E88B3B')}>Guests SEA · {seaCount.toLocaleString()}</span>
                    <span style={pillStyle('#3B78E8')}>Guests Int · {intCount.toLocaleString()}</span>
                    <span style={pillStyle('#8AC479')}>Returning · {retCount.toLocaleString()}</span>
                    <span style={{ marginLeft:'auto', fontWeight:600, color:INK }}>Total audience: {realTotal.toLocaleString()}</span>
                  </div>
                )}
                {g.slug === 'ota-traveller' && (
                  <div style={{ marginTop:6, fontSize:11, color:INK_S, paddingLeft:22 }}>
                    Fires for OTA-relay emails only (@guest.booking.com · @m.expediapartnercentral.com · @stayntouch.com · @guest.airbnb) · <strong style={{ color:INK }}>{otaCount.toLocaleString()}</strong> subscribers · plain text · no links.
                  </div>
                )}
              </div>

              <div style={{ padding:'8px 14px 14px' }}>
                {active.length > 0 && (<>
                  <div style={subHeader}>Active</div>
                  <MiniTableActive rows={active} />
                </>)}
                {drafts.length > 0 && (<>
                  <div style={subHeader}>Drafts</div>
                  <MiniTableDrafts rows={drafts} />
                </>)}
                {sent.length > 0 && (<>
                  <div style={subHeader}>Sent</div>
                  <MiniTableSent rows={sent} />
                </>)}
              </div>
            </div>
          );
        })}

        {rows.length === 0 && (
          <div style={{ ...emptyState, gridColumn:'1 / -1' }}>No lifecycle campaigns yet. Use + New lifecycle campaign to add one.</div>
        )}
      </DashboardPage>
    </div>
  );
}

function MiniTableActive({ rows }: { rows: CampaignRow[] }) {
  return (
    <div style={tableWrap}>
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead><tr style={{ background:'#FFFFFF', borderBottom:`1px solid ${HAIR}` }}>
          <th style={th}>Campaign</th><th style={th}>Trigger</th>
          <th style={{ ...th, textAlign:'right' }}>Recipients</th>
          <th style={{ ...th, textAlign:'right' }}>Pending</th>
          <th style={th}>Last edit</th>
          <th style={{ ...th, textAlign:'right', width:260 }}>Actions</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.campaign_id} style={{ borderBottom:`1px solid ${HAIR}`, background:'#FFFFFF' }}>
              <td style={{ ...tdL, maxWidth:260 }}>
                <div style={{ fontWeight:600 }}>{r.name}</div>
                <div style={{ fontSize:11, color:INK_S, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.subject}</div>
              </td>
              <td style={tdL}>{fmtLifecycleTrigger(r)}</td>
              <td style={tdR}><RecipientsButton campaign_id={r.campaign_id} campaign_name={r.name} count={r.recipients_count} /></td>
              <td style={tdR}>{r.pending_count}</td>
              <td style={tdL}>{fmtDateTime(r.updated_at)}</td>
              <td style={{ ...tdR, textAlign:'right' }}>
                <TenantLink href={`/guest/newsletters/${r.campaign_id}/preview`} style={actionBtnLight}>Preview</TenantLink>
                <HaltButton campaign_id={r.campaign_id} campaign_name={r.name} pending_count={r.pending_count} />
                <DeleteCampaignButton campaign_id={r.campaign_id} campaign_name={r.name} pending_count={r.pending_count} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MiniTableDrafts({ rows }: { rows: CampaignRow[] }) {
  return (
    <div style={tableWrap}>
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead><tr style={{ background:'#FFFFFF', borderBottom:`1px solid ${HAIR}` }}>
          <th style={th}>Campaign</th><th style={th}>Trigger</th>
          <th style={th}>Author</th><th style={th}>Last edit</th>
          <th style={{ ...th, textAlign:'right', width:290 }}>Actions</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.campaign_id} style={{ borderBottom:`1px solid ${HAIR}`, background:'#FFFFFF' }}>
              <td style={{ ...tdL, maxWidth:280 }}>
                <div style={{ fontWeight:600 }}>{r.name}</div>
                <div style={{ fontSize:11, color:INK_S, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.subject}</div>
              </td>
              <td style={tdL}>{fmtLifecycleTrigger(r)}</td>
              <td style={tdL}>{r.created_by ?? '—'}</td>
              <td style={tdL}>{fmtDateTime(r.updated_at)}</td>
              <td style={{ ...tdR, textAlign:'right' }}>
                <TenantLink href={`/guest/newsletters/${r.campaign_id}`} style={actionBtnLight}>Edit</TenantLink>
                <TenantLink href={`/guest/newsletters/${r.campaign_id}/preview`} style={actionBtnLight}>Preview</TenantLink>
                <ScheduleDrawer campaign_id={r.campaign_id} campaign_name={r.name} planned_date={r.planned_date} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MiniTableSent({ rows }: { rows: CampaignRow[] }) {
  return (
    <div style={tableWrap}>
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead><tr style={{ background:'#FFFFFF', borderBottom:`1px solid ${HAIR}` }}>
          <th style={th}>Campaign</th><th style={th}>Last sent</th>
          <th style={{ ...th, textAlign:'right' }}>Sent</th>
          <th style={{ ...th, textAlign:'right' }}>Opens</th>
          <th style={{ ...th, textAlign:'right' }}>Clicks</th>
          <th style={{ ...th, textAlign:'right' }}>Bookings</th>
          <th style={{ ...th, textAlign:'right', width:200 }}>Actions</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.campaign_id} style={{ borderBottom:`1px solid ${HAIR}`, background:'#FFFFFF' }}>
              <td style={{ ...tdL, maxWidth:280 }}>
                <div style={{ fontWeight:600 }}>{r.name}</div>
                <div style={{ fontSize:11, color:INK_S, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.subject}</div>
              </td>
              <td style={tdL}>{fmtDate(r.last_run_at ?? r.scheduled_at ?? r.planned_date)}</td>
              <td style={tdR}>{r.send_count}</td>
              <td style={tdR}>{r.opens_count} <span style={pctSub}>({pctOr(r.opens_count, r.send_count)})</span></td>
              <td style={tdR}>{r.clicks_count} <span style={pctSub}>({pctOr(r.clicks_count, r.send_count)})</span></td>
              <td style={tdR}>{r.booking_count}</td>
              <td style={{ ...tdR, textAlign:'right' }}>
                <TenantLink href={`/guest/newsletters/${r.campaign_id}`} style={actionBtnGreen}>Edit</TenantLink>
                <TenantLink href={`/guest/newsletters/${r.campaign_id}/preview`} style={actionBtnLight}>Preview</TenantLink>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_S = '#5A5A5A';
const BRAND = '#1F3A2E';

function pillStyle(bg: string): CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '2px 8px', fontSize: 10, fontWeight: 600,
    background: bg + '22', color: bg, border: `1px solid ${bg}66`, borderRadius: 10,
  };
}

const groupBox: CSSProperties = { border: `1px solid ${HAIR}`, borderTop:'3px solid #4A6A3A', borderRadius:6, background:'#FFFFFF', marginBottom:14 };
const subHeader: CSSProperties = { fontSize:10, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_S, fontWeight:600, margin:'10px 2px 6px' };
const ctaButton: CSSProperties = { padding:'6px 14px', fontSize:12, fontWeight:600, background:BRAND, color:'#FFFFFF', border:`1px solid ${BRAND}`, borderRadius:4, textDecoration:'none' };
const secondaryButton: CSSProperties = { padding:'6px 14px', fontSize:12, fontWeight:600, background:'#FFFFFF', color:BRAND, border:`1px solid ${HAIR}`, borderRadius:4, textDecoration:'none' };
const emptyState: CSSProperties = { padding:'16px 20px', fontSize:12, color:INK_S, background:'#FFFFFF', border:`1px solid ${HAIR}`, borderRadius:6 };
const tableWrap: CSSProperties = { border:`1px solid ${HAIR}`, borderRadius:4, overflow:'hidden', background:'#FFFFFF', marginBottom:6 };
const errorBox: CSSProperties = { padding:12, background:'#FBE8E4', color:'#8A2419', border:'1px solid #E8B7AB', borderRadius:4, marginBottom:16, fontSize:13 };
const th: CSSProperties = { padding:'8px 10px', fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:INK, textAlign:'left' };
const tdL: CSSProperties = { padding:'8px 10px', fontSize:12, color:INK };
const tdR: CSSProperties = { padding:'8px 10px', fontSize:12, textAlign:'right', fontVariantNumeric:'tabular-nums', color:INK };
const pctSub: CSSProperties = { fontSize:10, color:INK_S, marginLeft:4 };
const actionBtnGreen: CSSProperties = { display:'inline-block', padding:'4px 10px', marginLeft:6, fontSize:11, fontWeight:600, background:BRAND, color:'#FFFFFF', border:'none', borderRadius:4, textDecoration:'none' };
const actionBtnLight: CSSProperties = { display:'inline-block', padding:'4px 10px', marginLeft:6, fontSize:11, fontWeight:600, background:'#FFFFFF', color:'#3A3A3A', border:`1px solid ${HAIR}`, borderRadius:4, textDecoration:'none' };
