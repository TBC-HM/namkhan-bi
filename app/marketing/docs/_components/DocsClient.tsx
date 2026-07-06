// app/marketing/docs/_components/DocsClient.tsx
// PBS 2026-07-06: renders each Gold container's docs as a compact table with a
// "Preview" button that opens the doc inline (iframe for PDFs · <img> for images
// · download link for everything else). Server passes serialized rows with _url.
'use client';

import { useState } from 'react';

type SerializedDoc = {
  doc_id: string;
  title: string;
  doc_type: string;
  doc_subtype: string | null;
  file_name: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  mime: string | null;
  file_size_bytes: number | null;
  updated_at: string | null;
  _url: string;
};

type Section = {
  container: { key: string; label: string; desc: string };
  docs: SerializedDoc[];
};

const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; const GREEN='#084838';

const fmtSize = (n: number | null) => !n ? '' : n < 1024 ? `${n}B` : n < 1_048_576 ? `${Math.round(n/1024)}KB` : `${(n/1_048_576).toFixed(1)}MB`;
const fmtDate = (d: string | null) => !d ? '—' : new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });

export default function DocsClient({ sections }: { sections: Section[] }) {
  const [preview, setPreview] = useState<SerializedDoc | null>(null);

  return (
    <>
      {sections.map(s => (
        <div key={s.container.key} style={{ marginTop: 12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8, gap:8 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:INK }}>{s.container.label}</div>
              <div style={{ fontSize:11, color:INK_M, marginTop:2 }}>{s.container.desc}</div>
            </div>
            <div style={{ fontSize:11, color:INK_M, fontVariantNumeric:'tabular-nums' }}>{s.docs.length} doc{s.docs.length === 1 ? '' : 's'}</div>
          </div>
          {s.docs.length === 0 ? (
            <div style={{ padding:'20px 24px', fontSize:12, color:INK_M, background:'#FFFFFF', border:'1px solid '+HAIR, borderRadius:6, textAlign:'center' }}>
              Nothing in this container yet. Change a doc&apos;s <code>doc_type</code>/<code>doc_subtype</code> in the registry and it will land here on next reload.
            </div>
          ) : (
            <div style={{ border:'1px solid '+HAIR, borderRadius:6, background:'#FFFFFF', overflow:'hidden' }}>
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
                  {s.docs.map(d => (
                    <tr key={d.doc_id} style={{ borderTop:'1px solid '+HAIR }}>
                      <td style={{ ...tdL, maxWidth:400 }}>
                        <span style={{ fontWeight:600 }}>{d.title}</span>
                      </td>
                      <td style={tdL}>{d.doc_subtype ?? '—'}</td>
                      <td style={tdL}>{d.mime?.split('/').pop() ?? d.doc_type}</td>
                      <td style={tdR}>{fmtSize(d.file_size_bytes)}</td>
                      <td style={tdL}>{fmtDate(d.updated_at)}</td>
                      <td style={{ ...tdL, textAlign:'right' }}>
                        <button onClick={() => setPreview(d)} disabled={!d._url}
                          style={{ padding:'3px 10px', fontSize:11, fontWeight:600, background: d._url ? '#FFFFFF' : '#F5F0E1', color: d._url ? GREEN : INK_M, border:'1px solid '+HAIR, borderRadius:3, cursor: d._url ? 'pointer' : 'default' }}>
                          Preview
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {preview && <PreviewModal doc={preview} onClose={() => setPreview(null)} />}
    </>
  );
}

function PreviewModal({ doc, onClose }: { doc: SerializedDoc; onClose: () => void }) {
  const mime = doc.mime ?? '';
  const url = doc._url;

  const isPdf   = mime === 'application/pdf' || (doc.file_name ?? '').toLowerCase().endsWith('.pdf');
  const isImage = mime.startsWith('image/');
  const isText  = mime.startsWith('text/') || mime === 'text/markdown' || (doc.file_name ?? '').match(/\.(md|txt|csv)$/i);

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#FFFFFF', width:'100%', maxWidth:1100, height:'92vh', borderRadius:6, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'12px 18px', background:'#F7F0E1', borderBottom:'1px solid '+HAIR, display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:600, color:INK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{doc.title}</div>
            <div style={{ fontSize:11, color:INK_M, marginTop:2 }}>
              {doc.doc_subtype ?? doc.doc_type}
              {doc.mime ? ` · ${doc.mime}` : ''}
              {doc.file_size_bytes ? ` · ${fmtSize(doc.file_size_bytes)}` : ''}
            </div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <a href={url} target="_blank" rel="noreferrer" style={{ padding:'6px 12px', fontSize:11, fontWeight:600, background:'#FFFFFF', color:GREEN, border:'1px solid '+HAIR, borderRadius:4, textDecoration:'none' }}>Open in new tab ↗</a>
            <a href={url} download={doc.file_name ?? 'document'} style={{ padding:'6px 12px', fontSize:11, fontWeight:600, background:GREEN, color:'#FFFFFF', border:'1px solid '+GREEN, borderRadius:4, textDecoration:'none' }}>Download</a>
            <button onClick={onClose} style={{ padding:'6px 12px', fontSize:11, fontWeight:600, background:'#FFFFFF', color:INK, border:'1px solid '+HAIR, borderRadius:4, cursor:'pointer' }}>Close ×</button>
          </div>
        </div>

        <div style={{ flex:1, background:'#F5F0E1', overflow:'auto', padding: isImage ? 20 : 0 }}>
          {isPdf ? (
            <iframe src={url} style={{ width:'100%', height:'100%', border:'none' }} title={doc.title} />
          ) : isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={doc.title} style={{ maxWidth:'100%', maxHeight:'100%', display:'block', margin:'0 auto' }} />
          ) : isText ? (
            <iframe src={url} style={{ width:'100%', height:'100%', border:'none', background:'#FFFFFF' }} title={doc.title} />
          ) : (
            <div style={{ padding:40, textAlign:'center', color:INK_M, fontSize:13 }}>
              <div style={{ fontSize:14, fontWeight:600, color:INK, marginBottom:8 }}>Inline preview not supported for this file type</div>
              <div>{doc.mime ?? 'unknown mime type'}</div>
              <div style={{ marginTop:16 }}>
                <a href={url} target="_blank" rel="noreferrer" style={{ padding:'8px 16px', fontSize:12, fontWeight:600, background:GREEN, color:'#FFFFFF', border:'1px solid '+GREEN, borderRadius:4, textDecoration:'none' }}>Open in new tab ↗</a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const th = { padding:'8px 10px', fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' as const, color:INK, textAlign:'left' as const };
const tdL = { padding:'8px 10px', fontSize:12, color:INK };
const tdR = { padding:'8px 10px', fontSize:12, color:INK, textAlign:'right' as const, fontVariantNumeric:'tabular-nums' as const };
