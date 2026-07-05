// app/marketing/prospects/sequences/[funnel_id]/_components/EnrollForm.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Tag = { tag_key: string; label: string; subscriber_count: number };

const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; const GREEN='#084838'; const RED='#B03826'; const CREAM='#F7F0E1';

export default function EnrollForm({ funnel_id, defaultTag, tags }: { funnel_id: string; defaultTag: string; tags: Tag[] }) {
  const router = useRouter();
  const [tag, setTag] = useState(defaultTag);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind:'ok'|'err'; text:string } | null>(null);

  const selected = tags.find(t => t.tag_key === tag);
  const submit = async () => {
    if (!tag) { setMsg({ kind:'err', text:'pick a tag' }); return; }
    if (!confirm(`Enroll ~${selected?.subscriber_count ?? '?'} subscribers tagged "${tag}" into this sequence?`)) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/marketing/sequences/action', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ rpc:'fn_sequence_bulk_enroll_by_tag', p_funnel_id: funnel_id, p_tag_key: tag }),
      });
      const j = await res.json();
      if (j?.ok) { setMsg({ kind:'ok', text: `Enrolled ${j.enrolled} subscribers` }); setTimeout(() => router.push(`/marketing/prospects/sequences/${funnel_id}`), 900); }
      else setMsg({ kind:'err', text: j?.error ?? 'failed' });
    } catch (e) { setMsg({ kind:'err', text: e instanceof Error ? e.message : String(e) }); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ border:'1px solid '+HAIR, background:CREAM, borderRadius:6, padding:20, display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ fontSize:12, color:INK, lineHeight:1.6 }}>
        Every subscriber currently carrying the selected tag gets an enrollment row. Duplicate enrollments are ignored (a subscriber can be in a sequence only once). Rate-limited: 10 sends/hour + 100/24h shared with newsletters.
      </div>
      <label style={{ display:'flex', flexDirection:'column', gap:6 }}>
        <span style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:INK_M }}>Enroll all subscribers with tag</span>
        <select value={tag} onChange={e => setTag(e.target.value)} style={{ padding:'8px 12px', fontSize:12, background:'#FFFFFF', border:'1px solid '+HAIR, borderRadius:3, color:INK }}>
          <option value="">Pick a tag…</option>
          {tags.map(t => <option key={t.tag_key} value={t.tag_key}>{t.label} ({t.subscriber_count})</option>)}
        </select>
      </label>
      <div>
        <button onClick={submit} disabled={busy || !tag} style={{ padding:'8px 18px', fontSize:12, fontWeight:600, background: busy || !tag ? '#C8C0A6' : GREEN, color:'#FFFFFF', border:'1px solid '+(busy || !tag ? '#C8C0A6' : GREEN), borderRadius:4, cursor: busy || !tag ? 'default' : 'pointer' }}>
          {busy ? 'Enrolling…' : `Enroll all "${tag || '(pick tag)'}" subscribers`}
        </button>
        {msg && <span style={{ marginLeft:10, fontSize:11, color: msg.kind==='ok' ? GREEN : RED }}>{msg.text}</span>}
      </div>
    </div>
  );
}
