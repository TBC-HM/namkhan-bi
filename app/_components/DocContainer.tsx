// app/_components/DocContainer.tsx
// PBS 2026-07-06: reusable collapsible container that renders a group of docs
// with a Preview modal. Used on /marketing/docs and /operations/sustainability
// (and any future ops page that surfaces docs).
'use client';

import { useState } from 'react';

export type DocContainerDoc = {
  doc_id: string;
  title: string;
  doc_type: string;
  doc_subtype: string | null;
  file_name: string | null;
  mime: string | null;
  file_size_bytes: number | null;
  updated_at: string | null;
  _url: string;
};

const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; const GREEN='#084838';

const fmtSize = (n: number | null) => !n ? '' : n < 1024 ? `${n}B` : n < 1_048_576 ? `${Math.round(n/1024)}KB` : `${(n/1_048_576).toFixed(1)}MB`;
const fmtDate = (d: string | null) => !d ? '—' : new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });

export default function DocContainer({ label, desc, docs, defaultOpen = false, onPreview }: {
  label: string;
  desc?: string;
  docs: DocContainerDoc[];
  defaultOpen?: boolean;
  onPreview: (doc: DocContainerDoc) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ marginTop: 12 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width:'100%', background:'#FFFFFF', border:'1px solid '+HAIR, borderRadius:6,
          padding:'12px 14px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8,
          cursor:'pointer', textAlign:'left',
        }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:INK, display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:12, color:INK_M, fontFamily:'ui-monospace, monospace' }}>{open ? '▼' : '▶'}</span>
            {label}
            <span style={{ fontSize:11, color:INK_M, fontWeight:400 }}>· {docs.length} doc{docs.length===1?'':'s'}</span>
          </div>
          {desc && <div style={{ fontSize:11, color:INK_M, marginTop:2 }}>{desc}</div>}
        </div>
      </button>

      {open && (
        docs.length === 0 ? (
          <div style={{ padding:'16px 20px', fontSize:12, color:INK_M, background:'#FFFFFF', border:'1px solid '+HAIR, borderTop:'none', borderRadius:'0 0 6px 6px', textAlign:'center' }}>
            Nothing here yet.
          </div>
        ) : (
          <div style={{ border:'1px solid '+HAIR, borderTop:'none', borderRadius:'0 0 6px 6px', background:'#FFFFFF', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:'#FAFAF7', borderBottom:'1px solid '+HAIR }}>
                  <th style={th}>Title</th>
                  <th style={th}>Subtype</th>
                  <th style={th}>Type</th>
                  <th style={{ ...th, textAlign:'right' }}>Size</th>
                  <th style={th}>Updated</th>
                  <th style={{ ...th, textAlign:'right', width:100 }} />
                </tr>
              </thead>
              <tbody>
                {docs.map(d => (
                  <tr key={d.doc_id} style={{ borderTop:'1px solid '+HAIR }}>
                    <td style={{ ...tdL, maxWidth:400 }}>
                      <span style={{ fontWeight:600 }}>{d.title}</span>
                    </td>
                    <td style={tdL}>{d.doc_subtype ?? '—'}</td>
                    <td style={tdL}>{d.mime?.split('/').pop() ?? d.doc_type}</td>
                    <td style={tdR}>{fmtSize(d.file_size_bytes)}</td>
                    <td style={tdL}>{fmtDate(d.updated_at)}</td>
                    <td style={{ ...tdL, textAlign:'right' }}>
                      <button onClick={() => onPreview(d)} disabled={!d._url}
                        style={{ padding:'3px 10px', fontSize:11, fontWeight:600, background: d._url ? '#FFFFFF' : '#F5F0E1', color: d._url ? GREEN : INK_M, border:'1px solid '+HAIR, borderRadius:3, cursor: d._url ? 'pointer' : 'default' }}>
                        Preview
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

const th = { padding:'8px 10px', fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' as const, color:INK, textAlign:'left' as const };
const tdL = { padding:'8px 10px', fontSize:12, color:INK };
const tdR = { padding:'8px 10px', fontSize:12, color:INK, textAlign:'right' as const, fontVariantNumeric:'tabular-nums' as const };
