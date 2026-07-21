// app/guest/newsletters/lifecycle/page.tsx
// PBS 2026-07-22 (Newsletter Engine v2): Lifecycle campaigns tab.
// Filters guest.campaigns to campaign_kind='lifecycle' — anticipation, post-stay
// gratitude, birthday, winback, etc. Same chrome as Broadcasts.

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
};

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
  const { data, error } = await supabase.from('v_guest_campaigns').select('*')
    .eq('property_id', pid).is('archived_at', null)
    .order('updated_at', { ascending: false });
  const allRows: CampaignRow[] = (data as CampaignRow[]) ?? [];
  const rows = allRows.filter((r) => (r.campaign_kind ?? 'broadcast') === 'lifecycle');

  const active = rows.filter(r => r.status === 'scheduled' || r.status === 'sending');
  const drafts = rows.filter(r => r.status === 'draft');
  const sent   = rows.filter(r => r.status === 'sent');

  const tabs: DashboardTab[] = GUEST_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/guest/newsletters',
  }));

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage title="Contacts · Lifecycle emails"
        subtitle={`${rows.length} lifecycle campaign${rows.length === 1 ? '' : 's'} — anticipation, gratitude, birthday, winback.`} tabs={tabs}>
        <NewslettersSubStrip active="lifecycle" />

        <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <TenantLink href="/guest/newsletters/templates" style={secondaryButton}>Manage templates</TenantLink>
          <TenantLink href="/guest/directory" style={ctaButton}>+ New lifecycle campaign</TenantLink>
        </div>

        {error && <div style={{ ...errorBox, gridColumn:'1 / -1' }}>Could not load lifecycle campaigns: {error.message}</div>}

        {/* ACTIVE */}
        <div style={{ gridColumn:'1 / -1' }}>
          <div style={sectionHeader}>Active lifecycle triggers</div>
          {active.length === 0 ? <div style={emptyState}>No active lifecycle triggers yet.</div> : (
            <div style={tableWrap}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ background:'#FAFAF7', borderBottom:'1px solid #E6DFCC' }}>
                  <th style={th}>Campaign</th><th style={th}>Trigger</th>
                  <th style={{ ...th, textAlign:'right' }}>Recipients</th>
                  <th style={{ ...th, textAlign:'right' }}>Pending</th>
                  <th style={th}>Last edit</th>
                  <th style={{ ...th, textAlign:'right', width:260 }}>Actions</th>
                </tr></thead>
                <tbody>
                  {active.map((r) => (
                    <tr key={r.campaign_id} style={{ borderBottom:'1px solid #E6DFCC', background:'#FFFFFF' }}>
                      <td style={{ ...tdL, maxWidth:260 }}>
                        <div style={{ fontWeight:600 }}>{r.name}</div>
                        <div style={{ fontSize:11, color:'#5A5A5A', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.subject}</div>
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
          )}
        </div>

        {/* DRAFTS */}
        <div style={{ gridColumn:'1 / -1' }}>
          <div style={sectionHeader}>Drafts</div>
          {drafts.length === 0 ? <div style={emptyState}>No lifecycle drafts.</div> : (
            <div style={tableWrap}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ background:'#FAFAF7', borderBottom:'1px solid #E6DFCC' }}>
                  <th style={th}>Campaign</th><th style={th}>Trigger</th>
                  <th style={th}>Author</th><th style={th}>Last edit</th>
                  <th style={{ ...th, textAlign:'right', width:290 }}>Actions</th>
                </tr></thead>
                <tbody>
                  {drafts.map((r) => (
                    <tr key={r.campaign_id} style={{ borderBottom:'1px solid #E6DFCC', background:'#FFFFFF' }}>
                      <td style={{ ...tdL, maxWidth:280 }}>
                        <div style={{ fontWeight:600 }}>{r.name}</div>
                        <div style={{ fontSize:11, color:'#5A5A5A', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.subject}</div>
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
          )}
        </div>

        {/* SENT */}
        <div style={{ gridColumn:'1 / -1' }}>
          <div style={sectionHeader}>Sent</div>
          {sent.length === 0 ? <div style={emptyState}>No lifecycle campaigns sent yet.</div> : (
            <div style={tableWrap}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ background:'#FAFAF7', borderBottom:'1px solid #E6DFCC' }}>
                  <th style={th}>Campaign</th><th style={th}>Last sent</th>
                  <th style={{ ...th, textAlign:'right' }}>Sent</th>
                  <th style={{ ...th, textAlign:'right' }}>Opens</th>
                  <th style={{ ...th, textAlign:'right' }}>Clicks</th>
                  <th style={{ ...th, textAlign:'right' }}>Bookings</th>
                  <th style={{ ...th, textAlign:'right', width:200 }}>Actions</th>
                </tr></thead>
                <tbody>
                  {sent.map((r) => (
                    <tr key={r.campaign_id} style={{ borderBottom:'1px solid #E6DFCC', background:'#FFFFFF' }}>
                      <td style={{ ...tdL, maxWidth:280 }}>
                        <div style={{ fontWeight:600 }}>{r.name}</div>
                        <div style={{ fontSize:11, color:'#5A5A5A', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.subject}</div>
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
          )}
        </div>
      </DashboardPage>
    </div>
  );
}

const ctaButton: CSSProperties = { padding:'6px 14px', fontSize:12, fontWeight:600, background:'#1F3A2E', color:'#FFFFFF', border:'1px solid #1F3A2E', borderRadius:4, textDecoration:'none' };
const secondaryButton: CSSProperties = { padding:'6px 14px', fontSize:12, fontWeight:600, background:'#FFFFFF', color:'#1F3A2E', border:'1px solid #E6DFCC', borderRadius:4, textDecoration:'none' };
const sectionHeader: CSSProperties = { fontSize:11, letterSpacing:'0.06em', textTransform:'uppercase', color:'#5A5A5A', fontWeight:600, margin:'8px 2px 8px' };
const emptyState: CSSProperties = { padding:'16px 20px', fontSize:12, color:'#5A5A5A', background:'#FFFFFF', border:'1px solid #E6DFCC', borderRadius:6 };
const tableWrap: CSSProperties = { border:'1px solid #E6DFCC', borderRadius:6, overflow:'hidden', background:'#FFFFFF' };
const errorBox: CSSProperties = { padding:12, background:'#FBE8E4', color:'#8A2419', border:'1px solid #E8B7AB', borderRadius:4, marginBottom:16, fontSize:13 };
const th: CSSProperties = { padding:'8px 10px', fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'#1B1B1B', textAlign:'left' };
const tdL: CSSProperties = { padding:'8px 10px', fontSize:12, color:'#1B1B1B' };
const tdR: CSSProperties = { padding:'8px 10px', fontSize:12, textAlign:'right', fontVariantNumeric:'tabular-nums', color:'#1B1B1B' };
const pctSub: CSSProperties = { fontSize:10, color:'#5A5A5A', marginLeft:4 };
const actionBtnGreen: CSSProperties = { display:'inline-block', padding:'4px 10px', marginLeft:6, fontSize:11, fontWeight:600, background:'#1F3A2E', color:'#FFFFFF', border:'none', borderRadius:4, textDecoration:'none' };
const actionBtnLight: CSSProperties = { display:'inline-block', padding:'4px 10px', marginLeft:6, fontSize:11, fontWeight:600, background:'#FFFFFF', color:'#3A3A3A', border:'1px solid #E6DFCC', borderRadius:4, textDecoration:'none' };
