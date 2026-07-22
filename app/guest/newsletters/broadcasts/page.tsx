// app/guest/newsletters/broadcasts/page.tsx
// PBS 2026-07-22 late-EOD · matches Lifecycle box design.
// One visual box per subscriber_group (empty when no drafts).
// Boxes auto-fill when Director slots are approved → guest.campaigns rows land.

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
  schedule_kind: string; scheduled_at: string | null; last_run_at: string | null;
  template_key: string | null; recipients_count: number; pending_count: number;
  send_count: number; opens_count: number; clicks_count: number; booking_count: number;
  created_by: string | null; updated_at: string; archived_at: string | null; planned_date: string | null;
  campaign_kind?: string | null; audience_type?: string | null; goal_tag?: string | null;
  director_slot_id?: number | null;
  group_slug?: string | null;
};

type GroupMeta = { slug: string; name: string; color: string | null; sort_order: number | null };

const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_S = '#5A5A5A';
const BRAND = '#1F3A2E';

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
function pctOr(n: number, d: number): string { if (!d) return '—'; return `${((n / d) * 100).toFixed(0)}%`; }

function audienceFallbackSlug(audience_type: string | null | undefined): string | null {
  if (!audience_type) return null;
  // parent 'guests' slug retired 2026-07-22 — default b2c fallback → guests-int
  if (audience_type === 'b2c') return 'guests-int';
  if (audience_type === 'b2b') return 'dmc-contracted';
  return null;
}

export default async function BroadcastsPage() {
  const pid = PROPERTY_ID;

  const [campaignsRes, groupsRes, slotsRes] = await Promise.all([
    supabase.from('v_guest_campaigns').select('*').eq('property_id', pid).is('archived_at', null)
      .order('updated_at', { ascending: false }),
    supabase.from('v_subscriber_groups').select('slug, name, color, sort_order').order('sort_order', { ascending: true, nullsFirst: false }),
    supabase.from('v_director_calendar').select('id, group_slug').eq('property_id', pid),
  ]);

  const allRows: CampaignRow[] = (campaignsRes.data as CampaignRow[]) ?? [];
  const rows = allRows.filter((r) => (r.campaign_kind ?? 'broadcast') !== 'lifecycle');
  const groups: GroupMeta[] = (groupsRes.data as GroupMeta[]) ?? [];

  const slotGroupMap = new Map<number, string | null>();
  for (const s of (slotsRes.data as Array<{ id: number; group_slug: string | null }> | null) ?? []) {
    slotGroupMap.set(s.id, s.group_slug);
  }

  // bucket rows by group_slug ('__unassigned__' fallback)
  const byGroup = new Map<string, CampaignRow[]>();
  for (const r of rows) {
    const slotSlug = r.director_slot_id != null ? slotGroupMap.get(r.director_slot_id) ?? null : null;
    const slug = r.group_slug ?? slotSlug ?? audienceFallbackSlug(r.audience_type) ?? '__unassigned__';
    (byGroup.get(slug) ?? byGroup.set(slug, []).get(slug)!).push(r);
  }

  // canonical order: every subscriber_group + trailing Unassigned bucket if any
  const boxOrder: GroupMeta[] = [...groups];
  if (byGroup.has('__unassigned__')) {
    boxOrder.push({ slug: '__unassigned__', name: 'Unassigned (legacy)', color: '#B0A48C', sort_order: 999 });
  }

  const tabs: DashboardTab[] = GUEST_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/guest/newsletters',
  }));

  const totalDrafts = rows.filter(r => r.status === 'draft').length;
  const totalScheduled = rows.filter(r => r.status === 'scheduled' || r.status === 'sending').length;
  const subtitle = `${totalDrafts} draft${totalDrafts===1?'':'s'} · ${totalScheduled} scheduled · one box per audience group.`;

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage title="Contacts · Broadcasts by Group" subtitle={subtitle} tabs={tabs}>
        <NewslettersSubStrip active="broadcasts" />

        <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'flex-end', gap:8, alignItems:'center' }}>
          <TenantLink href="/guest/newsletters/director" style={secondaryButton}>Open Director</TenantLink>
          <TenantLink href="/guest/newsletters/templates" style={secondaryButton}>Manage templates</TenantLink>
          <ProposeNewsletterButton propertyId={pid} defaultKind="broadcast" />
          <TenantLink href="/guest/directory" style={ctaButton}>+ Compose from Directory</TenantLink>
        </div>

        {campaignsRes.error && <div style={{ ...errorBox, gridColumn:'1 / -1' }}>Could not load: {campaignsRes.error.message}</div>}

        {boxOrder.map((g) => {
          const groupRows = byGroup.get(g.slug) ?? [];
          const active = groupRows.filter(r => r.status === 'scheduled' || r.status === 'sending');
          const drafts = groupRows.filter(r => r.status === 'draft');
          const sent   = groupRows.filter(r => r.status === 'sent');
          const isEmpty = groupRows.length === 0;

          return (
            <div key={g.slug} style={{ ...groupBox, borderTopColor: g.color ?? '#7A4B2A', gridColumn:'1 / -1' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderBottom:`1px solid ${HAIR}`, background:'#FAFAF7' }}>
                <span style={{ width:12, height:12, borderRadius:2, background: g.color ?? '#7A4B2A', border:`1px solid ${HAIR}` }} />
                <div style={{ fontSize:13, fontWeight:700, color:INK }}>{g.name}</div>
                <div style={{ marginLeft:'auto', fontSize:11, color:INK_S }}>
                  {isEmpty
                    ? 'No broadcasts yet · confirm slots in the Director calendar to fill this box'
                    : `${groupRows.length} campaign${groupRows.length === 1 ? '' : 's'} · ${active.length} active · ${drafts.length} draft · ${sent.length} sent`}
                </div>
              </div>

              <div style={{ padding:'8px 14px 14px' }}>
                {isEmpty ? (
                  <div style={emptyState}>
                    Empty. When you confirm a Director slot for <strong style={{ color:INK }}>{g.name}</strong>, it lands here as a draft.
                  </div>
                ) : (
                  <>
                    {active.length > 0 && (<>
                      <div style={subHeader}>Active (scheduled)</div>
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
                  </>
                )}
              </div>
            </div>
          );
        })}
      </DashboardPage>
    </div>
  );
}

function MiniTableActive({ rows }: { rows: CampaignRow[] }) {
  return (
    <div style={tableWrap}>
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead><tr style={{ background:'#FFFFFF', borderBottom:`1px solid ${HAIR}` }}>
          <th style={th}>Campaign</th><th style={th}>Send date</th>
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
              <td style={tdL}>{fmtDateTime(r.scheduled_at ?? null)}</td>
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
          <th style={th}>Campaign</th><th style={th}>Planned</th>
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
              <td style={tdL}>{fmtDate(r.planned_date)}</td>
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
              <td style={tdR}>{r.send_count ?? 0}</td>
              <td style={tdR}>{r.opens_count ?? 0} <span style={pctSub}>({pctOr(r.opens_count ?? 0, r.send_count ?? 0)})</span></td>
              <td style={tdR}>{r.clicks_count ?? 0} <span style={pctSub}>({pctOr(r.clicks_count ?? 0, r.send_count ?? 0)})</span></td>
              <td style={tdR}>{r.booking_count ?? 0}</td>
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

const groupBox: CSSProperties = { border: `1px solid ${HAIR}`, borderTop:'3px solid #4A6A3A', borderRadius:6, background:'#FFFFFF', marginBottom:14 };
const subHeader: CSSProperties = { fontSize:10, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_S, fontWeight:600, margin:'10px 2px 6px' };
const ctaButton: CSSProperties = { padding:'6px 14px', fontSize:12, fontWeight:600, background:BRAND, color:'#FFFFFF', border:`1px solid ${BRAND}`, borderRadius:4, textDecoration:'none' };
const secondaryButton: CSSProperties = { padding:'6px 14px', fontSize:12, fontWeight:600, background:'#FFFFFF', color:BRAND, border:`1px solid ${HAIR}`, borderRadius:4, textDecoration:'none' };
const emptyState: CSSProperties = { padding:'12px 16px', fontSize:12, color:INK_S, background:'#FAFAF7', border:`1px dashed ${HAIR}`, borderRadius:4, fontStyle:'italic' };
const tableWrap: CSSProperties = { border:`1px solid ${HAIR}`, borderRadius:4, overflow:'hidden', background:'#FFFFFF', marginBottom:6 };
const errorBox: CSSProperties = { padding:12, background:'#FBE8E4', color:'#8A2419', border:'1px solid #E8B7AB', borderRadius:4, marginBottom:16, fontSize:13 };
const th: CSSProperties = { padding:'8px 10px', fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:INK, textAlign:'left' };
const tdL: CSSProperties = { padding:'8px 10px', fontSize:12, color:INK };
const tdR: CSSProperties = { padding:'8px 10px', fontSize:12, textAlign:'right', fontVariantNumeric:'tabular-nums', color:INK };
const pctSub: CSSProperties = { fontSize:10, color:INK_S, marginLeft:4 };
const actionBtnGreen: CSSProperties = { display:'inline-block', padding:'4px 10px', marginLeft:6, fontSize:11, fontWeight:600, background:BRAND, color:'#FFFFFF', border:'none', borderRadius:4, textDecoration:'none' };
const actionBtnLight: CSSProperties = { display:'inline-block', padding:'4px 10px', marginLeft:6, fontSize:11, fontWeight:600, background:'#FFFFFF', color:'#3A3A3A', border:`1px solid ${HAIR}`, borderRadius:4, textDecoration:'none' };
