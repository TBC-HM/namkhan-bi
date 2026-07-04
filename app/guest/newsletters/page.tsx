// app/guest/newsletters/page.tsx
// PBS 2026-07-04 v4: Planned date column · Schedule button on drafts · Halt button on scheduled.

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { GUEST_SUBPAGES } from '../_subpages';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import ScheduleDrawer from './_components/ScheduleDrawer';
import HaltButton from './_components/HaltButton';

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
function fmtRelSchedule(row: CampaignRow): string {
  if (row.relative_kind === 'before_checkin' && row.relative_days != null) return `${row.relative_days}d before check-in · ${String(row.relative_hour ?? 10).padStart(2,'0')}:00`;
  if (row.relative_kind === 'after_checkout' && row.relative_days != null) return `${row.relative_days}d after check-out · ${String(row.relative_hour ?? 10).padStart(2,'0')}:00`;
  if (row.planned_date) return fmtDate(row.planned_date) + ' · 10:00';
  if (row.schedule_kind && row.schedule_kind !== 'once') return `Repeats ${row.schedule_kind}`;
  if (row.scheduled_at) return fmtDateTime(row.scheduled_at);
  return '—';
}
function pctOr(n: number, d: number): string { if (!d) return '—'; return `${((n / d) * 100).toFixed(0)}%`; }

export default async function NewslettersPage() {
  const { data, error } = await supabase.from('v_guest_campaigns').select('*')
    .eq('property_id', PROPERTY_ID).is('archived_at', null)
    .order('planned_date', { ascending: true, nullsFirst: false })
    .order('updated_at', { ascending: false });
  const rows: CampaignRow[] = (data as CampaignRow[]) ?? [];
  const drafts   = rows.filter(r => r.status === 'draft');
  const upcoming = rows.filter(r => r.status === 'scheduled' || r.status === 'sending');
  const sent     = rows.filter(r => r.status === 'sent');

  const tabs: DashboardTab[] = GUEST_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/guest/newsletters',
  }));

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage title="Guest · Newsletters"
        subtitle={`${rows.length} campaign${rows.length === 1 ? '' : 's'} — Drafts, Scheduled and Sent.`} tabs={tabs}>
        <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <Link href="/guest/newsletters/templates" style={secondaryButton}>Manage templates</Link>
          <Link href="/guest/directory" style={ctaButton}>+ Compose from Directory</Link>
        </div>

        {error && <div style={{ ...errorBox, gridColumn:'1 / -1' }}>Could not load campaigns: {error.message}</div>}

        {/* DRAFTS */}
        <div style={{ gridColumn:'1 / -1' }}>
          <div style={sectionHeader}>Drafts</div>
          {drafts.length === 0 ? <div style={emptyState}>No drafts yet. Compose from Directory or start from a template.</div> : (
            <div style={tableWrap}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ background:'#FAFAF7', borderBottom:'1px solid #E6DFCC' }}>
                  <th style={th}>Campaign</th><th style={th}>Template</th><th style={th}>Planned date</th>
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
                      <td style={tdL}>{r.template_key ?? '—'}</td>
                      <td style={{ ...tdL, fontWeight: r.planned_date ? 600 : 400, color: r.planned_date ? '#084838' : '#5A5A5A' }}>{fmtDate(r.planned_date)}</td>
                      <td style={tdL}>{r.created_by ?? '—'}</td>
                      <td style={tdL}>{fmtDateTime(r.updated_at)}</td>
                      <td style={{ ...tdR, textAlign:'right' }}>
                        <Link href={`/guest/newsletters/${r.campaign_id}`} style={actionBtnLight}>Edit</Link>
                        <Link href={`/guest/newsletters/${r.campaign_id}/preview`} style={actionBtnLight}>Preview</Link>
                        <ScheduleDrawer campaign_id={r.campaign_id} campaign_name={r.name} planned_date={r.planned_date} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SCHEDULED */}
        <div style={{ gridColumn:'1 / -1' }}>
          <div style={sectionHeader}>Scheduled</div>
          {upcoming.length === 0 ? <div style={emptyState}>No scheduled campaigns.</div> : (
            <div style={tableWrap}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ background:'#FAFAF7', borderBottom:'1px solid #E6DFCC' }}>
                  <th style={th}>Campaign</th><th style={th}>Send schedule</th>
                  <th style={{ ...th, textAlign:'right' }}>Recipients</th>
                  <th style={{ ...th, textAlign:'right' }}>Pending</th>
                  <th style={th}>Last edit</th>
                  <th style={{ ...th, textAlign:'right', width:250 }}>Actions</th>
                </tr></thead>
                <tbody>
                  {upcoming.map((r) => (
                    <tr key={r.campaign_id} style={{ borderBottom:'1px solid #E6DFCC', background:'#FFFFFF' }}>
                      <td style={{ ...tdL, maxWidth:260 }}>
                        <div style={{ fontWeight:600 }}>{r.name}</div>
                        <div style={{ fontSize:11, color:'#5A5A5A', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.subject}</div>
                      </td>
                      <td style={tdL}>{fmtRelSchedule(r)}</td>
                      <td style={tdR}>{r.recipients_count}</td>
                      <td style={tdR}>{r.pending_count}</td>
                      <td style={tdL}>{fmtDateTime(r.updated_at)}</td>
                      <td style={{ ...tdR, textAlign:'right' }}>
                        <Link href={`/guest/newsletters/${r.campaign_id}/preview`} style={actionBtnLight}>Preview</Link>
                        <HaltButton campaign_id={r.campaign_id} campaign_name={r.name} pending_count={r.pending_count} />
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
          {sent.length === 0 ? <div style={emptyState}>No campaigns have been sent yet.</div> : (
            <div style={tableWrap}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ background:'#FAFAF7', borderBottom:'1px solid #E6DFCC' }}>
                  <th style={th}>Campaign</th><th style={th}>Sent at</th>
                  <th style={{ ...th, textAlign:'right' }}>Sent</th>
                  <th style={{ ...th, textAlign:'right' }}>Opens</th>
                  <th style={{ ...th, textAlign:'right' }}>Clicks</th>
                  <th style={{ ...th, textAlign:'right' }}>Bookings</th>
                  <th style={{ ...th, textAlign:'right' }}>Unsubs</th>
                  <th style={th}>Code</th>
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
                      <td style={tdR}>{r.unsub_count}</td>
                      <td style={{ ...tdL, fontFamily:'ui-monospace, SFMono-Regular, monospace', fontSize:11 }}>{r.booking_code ?? '—'}</td>
                      <td style={{ ...tdR, textAlign:'right' }}>
                        <Link href={`/guest/newsletters/${r.campaign_id}`} style={actionBtnGreen}>Edit</Link>
                        <Link href={`/guest/newsletters/${r.campaign_id}/preview`} style={actionBtnLight}>Preview</Link>
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
