// app/guest/newsletters/page.tsx
// PBS 2026-07-03 v2: overview with View / Edit / Delete actions per campaign.

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { supabase, PROPERTY_ID } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type CampaignRow = {
  campaign_id: string; property_id: number; name: string; status: string; subject: string;
  schedule_kind: string; scheduled_at: string | null; next_run_at: string | null; last_run_at: string | null;
  relative_kind: string | null; relative_days: number | null; relative_hour: number | null;
  template_key: string | null; booking_code: string | null;
  send_count: number; opens_count: number; clicks_count: number; unsub_count: number; booking_count: number;
  recipients_count: number; pending_count: number; queued_count: number; failed_count: number;
  created_at: string; archived_at: string | null;
};

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
  catch { return '—'; }
}
function fmtRelSchedule(row: CampaignRow): string {
  if (row.relative_kind === 'before_checkin' && row.relative_days != null) return `${row.relative_days}d before check-in · ${String(row.relative_hour ?? 10).padStart(2,'0')}:00`;
  if (row.relative_kind === 'after_checkout' && row.relative_days != null) return `${row.relative_days}d after check-out · ${String(row.relative_hour ?? 10).padStart(2,'0')}:00`;
  if (row.schedule_kind && row.schedule_kind !== 'once') return `Repeats ${row.schedule_kind}`;
  if (row.scheduled_at) return fmtDateTime(row.scheduled_at);
  return '—';
}
function pctOr(n: number, d: number): string { if (!d) return '—'; return `${((n / d) * 100).toFixed(0)}%`; }

export default async function NewslettersPage() {
  const { data, error } = await supabase.from('v_guest_campaigns').select('*')
    .eq('property_id', PROPERTY_ID).order('created_at', { ascending: false });
  const rows: CampaignRow[] = (data as CampaignRow[]) ?? [];
  const drafts   = rows.filter(r => r.status === 'draft');
  const upcoming = rows.filter(r => r.status === 'scheduled' || r.status === 'sending');
  const sent     = rows.filter(r => r.status === 'sent');

  return (
    <div style={{ padding:'24px 32px', maxWidth:1300, margin:'0 auto', background:'#FFFFFF', minHeight:'100vh' }}>
      <div style={{ marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={eyebrow}>Guest</div>
          <h1 style={{ fontSize:26, fontWeight:600, margin:'4px 0 0 0', color:'#1B1B1B' }}>Newsletter overview</h1>
          <div style={{ fontSize:13, color:'#5A5A5A', marginTop:6 }}>{rows.length} campaign{rows.length === 1 ? '' : 's'}</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <Link href="/guest/newsletters/templates" style={secondaryButton}>Manage templates</Link>
          <Link href="/guest/directory" style={ctaButton}>+ Compose from Directory</Link>
        </div>
      </div>
      {error && <div style={errorBox}>Could not load campaigns: {error.message}</div>}
      <Section title="Drafts" empty="No drafts yet. Compose from Directory or create a template." rows={drafts} />
      <Section title="Scheduled" empty="No scheduled campaigns." rows={upcoming} />
      <Section title="Sent" empty="No campaigns have been sent yet." rows={sent} />
    </div>
  );
}

function Section({ title, rows, empty }: { title: string; rows: CampaignRow[]; empty: string }) {
  return (
    <div style={{ marginTop:28 }}>
      <div style={sectionHeader}>{title}</div>
      {rows.length === 0 ? (
        <div style={emptyState}>{empty}</div>
      ) : (
        <div style={tableWrap}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid #E6DFCC', background:'#FAFAF7' }}>
                <th style={th}>Campaign</th>
                <th style={th}>Schedule</th>
                <th style={{...th, textAlign:'right'}}>Recipients</th>
                <th style={{...th, textAlign:'right'}}>Sent</th>
                <th style={{...th, textAlign:'right'}}>Opens</th>
                <th style={{...th, textAlign:'right'}}>Clicks</th>
                <th style={{...th, textAlign:'right'}}>Bookings</th>
                <th style={{...th, textAlign:'right'}}>Unsubs</th>
                <th style={th}>Code</th>
                <th style={{...th, textAlign:'right', width:200}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.campaign_id} style={{ borderBottom:'1px solid #E6DFCC', background:'#FFFFFF' }}>
                  <td style={{...tdL, maxWidth:280}}>
                    <div style={{ fontWeight:600 }}>{r.name}</div>
                    <div style={{ fontSize:11, color:'#5A5A5A', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.subject}</div>
                  </td>
                  <td style={tdL}>{fmtRelSchedule(r)}</td>
                  <td style={tdR}>{r.recipients_count}</td>
                  <td style={tdR}>{r.send_count}
                    {r.pending_count ? <span style={pendingChip}>{r.pending_count} pending</span> : null}
                    {r.queued_count  ? <span style={queuedChip}>{r.queued_count} queued</span>  : null}
                    {r.failed_count  ? <span style={failedChip}>{r.failed_count} failed</span>  : null}
                  </td>
                  <td style={tdR}>{r.opens_count} <span style={pctSub}>({pctOr(r.opens_count, r.send_count)})</span></td>
                  <td style={tdR}>{r.clicks_count} <span style={pctSub}>({pctOr(r.clicks_count, r.send_count)})</span></td>
                  <td style={tdR}>{r.booking_count}</td>
                  <td style={tdR}>{r.unsub_count}</td>
                  <td style={{...tdL, fontFamily:'ui-monospace, SFMono-Regular, monospace', fontSize:11}}>{r.booking_code ?? '—'}</td>
                  <td style={{...tdR, textAlign:'right' }}>
                    <Link href={`/guest/newsletters/${r.campaign_id}`} style={actionBtnGreen}>Open</Link>
                    <Link href={`/guest/newsletters/${r.campaign_id}/preview`} style={actionBtnLight}>Preview</Link>
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

const eyebrow: CSSProperties = { fontSize:10, letterSpacing:'0.08em', textTransform:'uppercase', color:'#5A5A5A' };
const ctaButton: CSSProperties = { padding:'8px 16px', fontSize:13, fontWeight:600, background:'#1F3A2E', color:'#FFFFFF', border:'1px solid #1F3A2E', borderRadius:4, textDecoration:'none' };
const secondaryButton: CSSProperties = { padding:'8px 16px', fontSize:13, fontWeight:600, background:'#FFFFFF', color:'#1F3A2E', border:'1px solid #E6DFCC', borderRadius:4, textDecoration:'none' };
const sectionHeader: CSSProperties = { fontSize:12, letterSpacing:'0.08em', textTransform:'uppercase', color:'#5A5A5A', fontWeight:600, marginBottom:8 };
const emptyState: CSSProperties = { padding:'16px 20px', fontSize:13, color:'#5A5A5A', background:'#FFFFFF', border:'1px solid #E6DFCC', borderRadius:6 };
const tableWrap: CSSProperties = { border:'1px solid #E6DFCC', borderRadius:6, overflow:'hidden', background:'#FFFFFF' };
const errorBox: CSSProperties = { padding:12, background:'#FBE8E4', color:'#8A2419', border:'1px solid #E8B7AB', borderRadius:4, marginBottom:16, fontSize:13 };
const th: CSSProperties = { padding:'10px 12px', fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'#1B1B1B', textAlign:'left' };
const tdL: CSSProperties = { padding:'10px 12px', fontSize:12, color:'#1B1B1B' };
const tdR: CSSProperties = { padding:'10px 12px', fontSize:12, textAlign:'right', fontVariantNumeric:'tabular-nums', color:'#1B1B1B' };
const pctSub: CSSProperties = { fontSize:10, color:'#5A5A5A', marginLeft:4 };
const pendingChip: CSSProperties = { marginLeft:6, padding:'1px 6px', fontSize:9, background:'#F5F0E1', color:'#5A5A5A', borderRadius:99 };
const queuedChip:  CSSProperties = { marginLeft:6, padding:'1px 6px', fontSize:9, background:'#FBEBB4', color:'#8A6E00', borderRadius:99 };
const failedChip:  CSSProperties = { marginLeft:6, padding:'1px 6px', fontSize:9, background:'#FBE8E4', color:'#8A2419', borderRadius:99 };
const actionBtnGreen: CSSProperties = { display:'inline-block', padding:'4px 10px', marginLeft:6, fontSize:11, fontWeight:600, background:'#1F3A2E', color:'#FFFFFF', border:'none', borderRadius:4, textDecoration:'none' };
const actionBtnLight: CSSProperties = { display:'inline-block', padding:'4px 10px', marginLeft:6, fontSize:11, fontWeight:600, background:'#FFFFFF', color:'#3A3A3A', border:'1px solid #E6DFCC', borderRadius:4, textDecoration:'none' };
