// app/marketing/docs/upload/_components/DocsUploadForm.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; const GREEN='#084838'; const RED='#B03826'; const CREAM='#F7F0E1';

// Gold container → doc_type/doc_subtype pairs presented as user-friendly choices.
// Matches the classify() logic on the docs list page.
const CONTAINER_OPTIONS: { key: string; label: string; doc_type: string; doc_subtype: string | null }[] = [
  { key: 'brand',            label: 'Brand & positioning',     doc_type: 'marketing', doc_subtype: null },
  { key: 'campaign',         label: 'Campaigns & calendar',    doc_type: 'marketing', doc_subtype: 'campaign' },
  { key: 'partner_material', label: 'Partner material',        doc_type: 'partner',   doc_subtype: 'partner_material' },
  { key: 'hilton_slh',       label: 'Hilton & SLH',            doc_type: 'partner',   doc_subtype: 'faq' },
  { key: 'collateral',       label: 'Collateral & press',      doc_type: 'marketing', doc_subtype: 'collateral' },
  { key: 'sustainability',   label: 'Sustainability & certs',  doc_type: 'partner',   doc_subtype: 'sustainability_toolkit' },
  { key: 'kb',               label: 'Knowledge base',          doc_type: 'kb_article',doc_subtype: null },
  { key: 'template',         label: 'Templates',               doc_type: 'template',  doc_subtype: 'form' },
];

export default function DocsUploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [container, setContainer] = useState(CONTAINER_OPTIONS[0].key);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind:'ok'|'err'; text:string } | null>(null);

  const onPick = (f: File | null) => {
    setFile(f);
    if (f && !title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ''));
  };

  const submit = async () => {
    if (!file) { setMsg({ kind:'err', text:'Pick a file first' }); return; }
    const opt = CONTAINER_OPTIONS.find(o => o.key === container);
    if (!opt) { setMsg({ kind:'err', text:'Pick a container' }); return; }

    setBusy(true); setMsg(null);
    try {
      const fd = new FormData();
      fd.set('file', file);
      fd.set('title', title.trim() || file.name);
      fd.set('doc_type', opt.doc_type);
      if (opt.doc_subtype) fd.set('doc_subtype', opt.doc_subtype);
      const res = await fetch('/api/marketing/docs/upload', { method:'POST', body: fd });
      const j = await res.json();
      if (j?.ok) {
        setMsg({ kind:'ok', text: `Uploaded → ${opt.label}` });
        setFile(null); setTitle('');
        setTimeout(() => router.push('/marketing/docs'), 800);
      } else {
        setMsg({ kind:'err', text: j?.error ?? 'upload failed' });
      }
    } catch (e) {
      setMsg({ kind:'err', text: e instanceof Error ? e.message : String(e) });
    } finally { setBusy(false); }
  };

  const opt = CONTAINER_OPTIONS.find(o => o.key === container);

  return (
    <div style={{ padding:16, background:'#FFFFFF', border:'1px solid '+HAIR, borderRadius:6, display:'flex', flexDirection:'column', gap:14 }}>
      <label style={{ display:'flex', flexDirection:'column', gap:6 }}>
        <span style={lbl}>1. Pick a file</span>
        <input type="file" onChange={e => onPick(e.target.files?.[0] ?? null)} style={{ fontSize:12 }} />
        {file && <div style={{ fontSize:11, color:INK_M }}>{file.name} · {(file.size/1024).toFixed(0)} KB · {file.type || 'unknown mime'}</div>}
      </label>

      <label style={{ display:'flex', flexDirection:'column', gap:6 }}>
        <span style={lbl}>2. Container (Gold category)</span>
        <select value={container} onChange={e => setContainer(e.target.value)} style={inp}>
          {CONTAINER_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        {opt && (
          <div style={{ fontSize:10, color:INK_M }}>
            Registered as <code>doc_type={opt.doc_type}</code>
            {opt.doc_subtype ? <> · <code>doc_subtype={opt.doc_subtype}</code></> : null}
          </div>
        )}
      </label>

      <label style={{ display:'flex', flexDirection:'column', gap:6 }}>
        <span style={lbl}>3. Title (shown on the docs list)</span>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Auto-filled from filename" style={inp} />
      </label>

      <div>
        <button onClick={submit} disabled={busy || !file}
          style={{ padding:'8px 20px', fontSize:12, fontWeight:600, background: busy || !file ? '#C8C0A6' : GREEN, color:'#FFFFFF', border:'1px solid '+(busy || !file ? '#C8C0A6' : GREEN), borderRadius:4, cursor: busy || !file ? 'default' : 'pointer' }}>
          {busy ? 'Uploading…' : 'Upload'}
        </button>
        {msg && <span style={{ marginLeft:10, fontSize:11, color: msg.kind==='ok' ? GREEN : RED }}>{msg.text}</span>}
      </div>
    </div>
  );
}

const lbl = { fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' as const, color:INK_M };
const inp = { padding:'8px 12px', fontSize:12, background:'#FFFFFF', border:'1px solid '+HAIR, borderRadius:3, color:INK };
