// app/_components/DocPreviewModal.tsx
// PBS 2026-07-06: reusable inline doc preview (PDF iframe · image tag · text iframe
// · fallback download button for other mimes). Used everywhere docs are shown.
'use client';

import type { DocContainerDoc } from './DocContainer';

const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; const GREEN='#084838';

const fmtSize = (n: number | null) => !n ? '' : n < 1024 ? `${n}B` : n < 1_048_576 ? `${Math.round(n/1024)}KB` : `${(n/1_048_576).toFixed(1)}MB`;

export default function DocPreviewModal({ doc, onClose }: { doc: DocContainerDoc; onClose: () => void }) {
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
