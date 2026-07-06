// app/settings/documents/_components/RegistryClient.tsx
// PBS 2026-07-06: doc registry with inline container-reassignment dropdown.
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import DocPreviewModal from '@/app/_components/DocPreviewModal';
import type { DocContainerDoc } from '@/app/_components/DocContainer';

type Row = {
  doc_id: string; property_id: number | null; title: string;
  doc_type: string; doc_subtype: string | null;
  file_name: string | null; storage_bucket: string | null; storage_path: string | null;
  mime: string | null; file_size_bytes: number | null;
  created_at: string; updated_at: string;
  public_url: string | null;
};

const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; const GREEN='#084838'; const RED='#B03826'; const AMBER='#C28F2C';

// Container preset → doc_type/doc_subtype pair. Choosing a container writes both.
const PRESETS: { key: string; label: string; where: string; doc_type: string; doc_subtype: string | null }[] = [
  { key: 'brand',             label: 'Marketing · Brand & positioning',    where: '/marketing/docs',              doc_type: 'marketing', doc_subtype: null },
  { key: 'campaign',          label: 'Marketing · Campaigns',              where: '/marketing/docs',              doc_type: 'marketing', doc_subtype: 'campaign' },
  { key: 'collateral',        label: 'Marketing · Collateral & press',     where: '/marketing/docs',              doc_type: 'marketing', doc_subtype: 'collateral' },
  { key: 'partner_material',  label: 'Marketing · Partner material',       where: '/marketing/docs',              doc_type: 'partner',   doc_subtype: 'partner_material' },
  { key: 'hilton_slh',        label: 'Marketing · Hilton & SLH',           where: '/marketing/docs',              doc_type: 'partner',   doc_subtype: 'faq' },
  { key: 'kb',                label: 'Marketing · Knowledge base',         where: '/marketing/docs',              doc_type: 'kb_article',doc_subtype: null },
  { key: 'template',          label: 'Marketing · Templates',              where: '/marketing/docs',              doc_type: 'template',  doc_subtype: 'form' },
  { key: 'sust_toolkit',      label: 'Ops · Sustainability toolkit',       where: '/operations/sustainability',   doc_type: 'partner',   doc_subtype: 'sustainability_toolkit' },
  { key: 'sust_goals',        label: 'Ops · Sustainability goals',         where: '/operations/sustainability',   doc_type: 'kb_article',doc_subtype: 'sustainability_goals' },
  { key: 'certification',     label: 'Ops · Certification requirements',   where: '/operations/sustainability',   doc_type: 'partner',   doc_subtype: 'certification_requirements' },
  { key: 'vendor_catalog',    label: 'Ops · Vendor product catalog',       where: '/operations/vendors (future)', doc_type: 'vendor_doc',doc_subtype: 'product_catalog' },
  { key: 'hr_payslip',        label: 'HR · Payslip',                       where: '/people/hr (future)',          doc_type: 'hr_doc',    doc_subtype: 'payslip' },
  { key: 'hr_contract',       label: 'HR · Contract (indefinido)',         where: '/people/hr (future)',          doc_type: 'template',  doc_subtype: 'hr_contract_indefinido' },
  { key: 'other_marketing',   label: 'Other · plain marketing',            where: '/marketing/docs',              doc_type: 'marketing', doc_subtype: null },
];

const currentPresetKey = (r: Row): string => {
  for (const p of PRESETS) {
    if (r.doc_type === p.doc_type && (r.doc_subtype ?? null) === (p.doc_subtype ?? null)) return p.key;
  }
  return '';
};

export default function RegistryClient({ initialRows }: { initialRows: Row[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [preview, setPreview] = useState<DocContainerDoc | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind:'ok'|'err'; text:string } | null>(null);

  const types = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of initialRows) m.set(r.doc_type, (m.get(r.doc_type) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [initialRows]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return initialRows.filter(r => {
      if (typeFilter && r.doc_type !== typeFilter) return false;
      if (qq) {
        const bag = [r.title, r.doc_type, r.doc_subtype, r.file_name].filter(Boolean).join(' ').toLowerCase();
        if (!bag.includes(qq)) return false;
      }
      return true;
    });
  }, [initialRows, q, typeFilter]);

  const reassign = async (doc_id: string, presetKey: string) => {
    const preset = PRESETS.find(p => p.key === presetKey);
    if (!preset) return;
    setBusy(doc_id); setMsg(null);
    try {
      const res = await fetch('/api/marketing/docs/reassign', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ doc_id, doc_type: preset.doc_type, doc_subtype: preset.doc_subtype }),
      });
      const j = await res.json();
      if (j?.ok) { setMsg({ kind:'ok', text:`Reassigned → ${preset.label.split('·')[1]?.trim() ?? preset.label}` }); router.refresh(); }
      else setMsg({ kind:'err', text: j?.error ?? 'reassign failed' });
    } catch (e) { setMsg({ kind:'err', text: e instanceof Error ? e.message : String(e) }); }
    finally { setBusy(null); }
  };

  const openPreview = (r: Row) => setPreview({
    doc_id: r.doc_id, title: r.title, doc_type: r.doc_type, doc_subtype: r.doc_subtype,
    file_name: r.file_name, mime: r.mime, file_size_bytes: r.file_size_bytes, updated_at: r.updated_at,
    _url: r.public_url ?? '',
  });

  return (
    <div>
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:10 }}>
        <input type="search" value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search title / file name / subtype…"
          style={{ flex:'1 1 260px', minWidth:220, ...input }} />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={input}>
          <option value="">All types ({initialRows.length})</option>
          {types.map(([t, n]) => <option key={t} value={t}>{t} ({n})</option>)}
        </select>
        <div style={{ marginLeft:'auto', fontSize:11, color:INK_M }}>
          {filtered.length.toLocaleString()} / {initialRows.length.toLocaleString()}
        </div>
        {msg && <div style={{ fontSize:11, color: msg.kind==='ok' ? GREEN : RED }}>{msg.text}</div>}
      </div>

      <div style={{ border:'1px solid '+HAIR, borderRadius:6, background:'#FFFFFF', overflow:'auto', maxHeight:'70vh' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr style={{ background:'#FAFAF7', borderBottom:'1px solid '+HAIR, position:'sticky', top:0 }}>
              <th style={th}>Title</th>
              <th style={th}>Current classification</th>
              <th style={{ ...th, minWidth:280 }}>Reassign to container</th>
              <th style={th}>Updated</th>
              <th style={{ ...th, textAlign:'right', width:100 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 500).map(r => {
              const current = currentPresetKey(r);
              return (
                <tr key={r.doc_id} style={{ borderTop:'1px solid '+HAIR }}>
                  <td style={{ ...tdL, maxWidth:340 }}>
                    <div style={{ fontWeight:600 }}>{r.title}</div>
                    <div style={{ fontSize:10, color:INK_M, marginTop:2 }}>{r.file_name ?? '—'} · {r.mime ?? '—'}</div>
                  </td>
                  <td style={{ ...tdL, fontFamily:'ui-monospace, monospace', fontSize:10 }}>
                    <div>{r.doc_type}</div>
                    <div style={{ color:INK_M }}>{r.doc_subtype ?? '—'}</div>
                  </td>
                  <td style={tdL}>
                    <select value={current} onChange={e => reassign(r.doc_id, e.target.value)} disabled={busy === r.doc_id}
                      style={{ ...input, minWidth:260, opacity: busy === r.doc_id ? 0.5 : 1 }}>
                      {!current && <option value="">— pick container —</option>}
                      {PRESETS.map(p => (
                        <option key={p.key} value={p.key}>{p.label}</option>
                      ))}
                    </select>
                  </td>
                  <td style={tdL}>{new Date(r.updated_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}</td>
                  <td style={{ ...tdL, textAlign:'right' }}>
                    <button onClick={() => openPreview(r)} disabled={!r.public_url}
                      style={{ padding:'3px 10px', fontSize:11, fontWeight:600, background: r.public_url ? '#FFFFFF' : '#F5F0E1', color: r.public_url ? GREEN : INK_M, border:'1px solid '+HAIR, borderRadius:3, cursor: r.public_url ? 'pointer' : 'default' }}>
                      Preview
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length > 500 && (
          <div style={{ padding:'10px 12px', fontSize:11, color:INK_M, textAlign:'center' }}>
            Showing 500 of {filtered.length.toLocaleString()} — refine search.
          </div>
        )}
      </div>

      {preview && <DocPreviewModal doc={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

const input = { padding:'6px 10px', fontSize:12, background:'#FFFFFF', border:'1px solid '+HAIR, borderRadius:3, color:INK };
const th = { padding:'8px 10px', fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' as const, color:INK, textAlign:'left' as const };
const tdL = { padding:'8px 10px', fontSize:12, color:INK };
