'use client';
// app/guest/newsletters/broadcasts/_components/GroupContainer.tsx
// PBS 2026-07-21 pm (Newsletter Calendar v2): collapsible per-group container.
// Shows two columns: Drafts and Scheduled. Header shows group name, color chip,
// counts. Rows link to editor/preview/schedule/delete.

import { useState } from 'react';
import type { CSSProperties } from 'react';
import TenantLink from '@/components/nav/TenantLink';

export interface BroadcastRow {
  campaign_id: string;
  property_id: number;
  name: string;
  subject: string;
  status: string;
  planned_date: string | null;
  scheduled_at: string | null;
  updated_at: string;
  audience_type: string | null;
  goal_tag: string | null;
  director_slot_id: number | null;
  group_slug: string | null;
  recipients_count: number;
  pending_count: number;
}

interface Props {
  slug: string;                 // group slug or '__unassigned__'
  name: string;
  color: string;
  drafts: BroadcastRow[];
  scheduled: BroadcastRow[];
  defaultOpen?: boolean;
}

const HAIR = '#E6DFCC';
const INK  = '#1B1B1B';
const INK_M = '#5A5A5A';
const PRIMARY = '#1F3A2E';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }); }
  catch { return '—'; }
}
function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }); }
  catch { return '—'; }
}

export default function GroupContainer({ slug, name, color, drafts, scheduled, defaultOpen = true }: Props) {
  const [open, setOpen] = useState<boolean>(defaultOpen);
  const totalCount = drafts.length + scheduled.length;

  return (
    <section style={panel}>
      <button type="button" onClick={()=>setOpen(!open)} style={header}>
        <span style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
          <span style={{ display:'inline-block', width:12, height:12, borderRadius:3, background:color, border:`1px solid ${HAIR}` }} />
          <span style={{ fontWeight:700, fontSize:13, color:INK }}>{name}</span>
          <span style={{ fontSize:11, color:INK_M }}>({slug})</span>
        </span>
        <span style={{ fontSize:11, color:INK_M }}>
          {drafts.length} draft{drafts.length===1?'':'s'} · {scheduled.length} scheduled · {open ? '▾' : '▸'}
        </span>
      </button>

      {open && (
        <div style={body}>
          {totalCount === 0 ? (
            <div style={emptyState}>No campaigns yet in this group. Accept a slot from the Director or compose from Directory.</div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {/* DRAFTS */}
              <div style={column}>
                <div style={columnHeader}>Drafts ({drafts.length})</div>
                {drafts.length === 0 ? (
                  <div style={{ ...cellEmpty }}>No drafts.</div>
                ) : (
                  drafts.map(r => (
                    <div key={r.campaign_id} style={campaignCard}>
                      <div style={{ fontWeight:600, fontSize:12, color:INK, overflow:'hidden', textOverflow:'ellipsis' }}>{r.name}</div>
                      <div style={{ fontSize:11, color:INK_M, marginTop:2 }}>{r.subject}</div>
                      <div style={{ fontSize:10, color:INK_M, marginTop:4 }}>
                        Planned: {fmtDate(r.planned_date)} · updated {fmtDateTime(r.updated_at)}
                      </div>
                      <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
                        <TenantLink href={`/guest/newsletters/${r.campaign_id}`} style={actionBtnGreen}>Edit</TenantLink>
                        <TenantLink href={`/guest/newsletters/${r.campaign_id}/preview`} style={actionBtnLight}>Preview</TenantLink>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* SCHEDULED */}
              <div style={column}>
                <div style={columnHeader}>Scheduled ({scheduled.length})</div>
                {scheduled.length === 0 ? (
                  <div style={{ ...cellEmpty }}>No scheduled campaigns.</div>
                ) : (
                  scheduled.map(r => (
                    <div key={r.campaign_id} style={campaignCard}>
                      <div style={{ fontWeight:600, fontSize:12, color:INK, overflow:'hidden', textOverflow:'ellipsis' }}>{r.name}</div>
                      <div style={{ fontSize:11, color:INK_M, marginTop:2 }}>{r.subject}</div>
                      <div style={{ fontSize:10, color:INK_M, marginTop:4 }}>
                        Sends: {fmtDateTime(r.scheduled_at)} · {r.recipients_count} recipient{r.recipients_count===1?'':'s'}
                      </div>
                      <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
                        <TenantLink href={`/guest/newsletters/${r.campaign_id}/preview`} style={actionBtnLight}>Preview</TenantLink>
                        <TenantLink href={`/guest/newsletters/${r.campaign_id}`} style={actionBtnLight}>Details</TenantLink>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

const panel: CSSProperties = { border:`1px solid ${HAIR}`, borderRadius:6, background:'#FFFFFF', overflow:'hidden' };
const header: CSSProperties = { width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'#FAFAF7', border:'none', borderBottom:`1px solid ${HAIR}`, cursor:'pointer', fontFamily:'inherit' };
const body: CSSProperties = { padding:12 };
const column: CSSProperties = { border:`1px solid ${HAIR}`, borderRadius:4, background:'#FFFFFF', padding:8, minHeight:80 };
const columnHeader: CSSProperties = { fontSize:10, textTransform:'uppercase', letterSpacing:'.06em', color:INK_M, fontWeight:700, marginBottom:6 };
const campaignCard: CSSProperties = { padding:8, border:`1px solid ${HAIR}`, borderRadius:4, background:'#FFFFFF', marginBottom:6 };
const cellEmpty: CSSProperties = { padding:8, fontSize:11, color:INK_M, fontStyle:'italic' };
const emptyState: CSSProperties = { padding:12, fontSize:12, color:INK_M };
const actionBtnGreen: CSSProperties = { display:'inline-block', padding:'3px 8px', fontSize:11, fontWeight:600, background:PRIMARY, color:'#FFFFFF', border:'none', borderRadius:3, textDecoration:'none' };
const actionBtnLight: CSSProperties = { display:'inline-block', padding:'3px 8px', fontSize:11, fontWeight:600, background:'#FFFFFF', color:'#3A3A3A', border:`1px solid ${HAIR}`, borderRadius:3, textDecoration:'none' };
