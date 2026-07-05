// app/marketing/prospects/import/_components/ImportClient.tsx
// PBS 2026-07-05: Client-side CSV paste + upload UI for prospect import.
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Result = {
  ok: boolean;
  batch_id?: string;
  total?: number;
  new?: number;
  duplicates?: number;
  enriched?: number;
  dropped?: number;
  dropped_sample?: unknown[];
  error?: string;
};

const KNOWN_COLS = ['full_name','name','email','phone','country','company','website','notes','first_name','last_name'];

function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim().length > 0);
  if (lines.length === 0) return { header: [], rows: [] };
  const split = (line: string): string[] => {
    const out: string[] = []; let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
      else if (c === ',' && !inQ) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur); return out.map(s => s.trim());
  };
  const header = split(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
  const rows = lines.slice(1).map(split);
  return { header, rows };
}

function toRowObjects(header: string[], rows: string[][]): Record<string, string>[] {
  return rows.map(r => {
    const o: Record<string, string> = {};
    header.forEach((h, i) => { o[h] = r[i] ?? ''; });
    // Combine first_name + last_name → full_name if needed
    if (!o.full_name && (o.first_name || o.last_name)) {
      o.full_name = [o.first_name, o.last_name].filter(Boolean).join(' ').trim();
    }
    if (!o.full_name && o.name) o.full_name = o.name;
    return o;
  });
}

export default function ImportClient() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [tags, setTags] = useState('imported,tour_operator');
  const [country, setCountry] = useState('');
  const [filename, setFilename] = useState('paste.csv');
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const parsed = useMemo(() => {
    if (!text.trim()) return { header: [], rows: [], objects: [], missing: [] as string[] };
    const p = parseCsv(text);
    const objects = toRowObjects(p.header, p.rows);
    const missing = ['full_name','email','phone','website'].filter(c => !p.header.includes(c) && !(c === 'full_name' && (p.header.includes('name') || (p.header.includes('first_name') && p.header.includes('last_name')))));
    return { ...p, objects, missing };
  }, [text]);

  const canSubmit = parsed.objects.length > 0 && !working;

  const submit = async () => {
    if (!parsed.objects.length) return;
    setWorking(true); setResult(null);
    try {
      const res = await fetch('/api/marketing/prospects/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: parsed.objects,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
          filename,
          default_country: country || null,
        }),
      });
      const j = await res.json();
      setResult(j);
      if (j?.ok) setTimeout(() => router.refresh(), 1200);
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : String(e) });
    } finally { setWorking(false); }
  };

  const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; const GREEN='#084838'; const RED='#B03826'; const CREAM='#F7F0E1';

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:12 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:8 }}>
        <div>
          <label style={label}>Tags (comma-separated)</label>
          <input value={tags} onChange={e=>setTags(e.target.value)} style={input} placeholder="imported,tour_operator" />
        </div>
        <div>
          <label style={label}>Default country (optional)</label>
          <input value={country} onChange={e=>setCountry(e.target.value)} style={input} placeholder="e.g. FR" />
        </div>
        <div>
          <label style={label}>Batch filename (for audit)</label>
          <input value={filename} onChange={e=>setFilename(e.target.value)} style={input} placeholder="touroperator.xlsx" />
        </div>
      </div>

      <div>
        <label style={label}>CSV (paste — first line is header)</label>
        <textarea value={text} onChange={e=>setText(e.target.value)}
          style={{ ...input, minHeight:200, fontFamily:'ui-monospace, Menlo, monospace', fontSize:11, whiteSpace:'pre' }}
          placeholder="full_name,email,phone,country,company,website,notes&#10;Aria Voyages,,+33 1 42 00 00 00,FR,Aria Voyages,https://ariavoyages.com,Retreats specialist" />
      </div>

      {parsed.header.length > 0 && (
        <div style={{ padding:'10px 12px', background:'#FAFAF7', border:'1px solid '+HAIR, borderRadius:4, fontSize:11, color:INK }}>
          <div><strong>{parsed.objects.length}</strong> row{parsed.objects.length===1?'':'s'} parsed · columns: {parsed.header.map((h,i)=>(
            <span key={i} style={{ display:'inline-block', margin:'0 4px 4px 0', padding:'1px 6px', background: KNOWN_COLS.includes(h) ? CREAM : '#F5EAD9', border:'1px solid '+HAIR, borderRadius:8, fontSize:10 }}>{h}</span>
          ))}</div>
          {parsed.missing.length > 0 && (
            <div style={{ marginTop:6, color:'#8B5A1C' }}>
              Heads-up: no <code>{parsed.missing.join(', ')}</code> column found — those enrichment tiers will be skipped for every row.
            </div>
          )}
        </div>
      )}

      <div>
        <button onClick={submit} disabled={!canSubmit}
          style={{ padding:'8px 18px', fontSize:12, fontWeight:600, background: canSubmit ? GREEN : '#C8C0A6',
                   color:'#FFFFFF', border:'1px solid '+(canSubmit ? GREEN : '#C8C0A6'), borderRadius:4,
                   cursor: canSubmit ? 'pointer' : 'default' }}>
          {working ? 'Importing…' : `Import ${parsed.objects.length} row${parsed.objects.length===1?'':'s'}`}
        </button>
      </div>

      {result && (
        <div style={{ padding:14, background: result.ok ? '#E4F0E1' : '#FBE8E4', border:'1px solid '+(result.ok ? '#A9CFA0' : '#E8B7AB'), borderRadius:4, fontSize:12, color:INK }}>
          {result.ok ? (
            <>
              <div style={{ fontWeight:600, color:'#1F5C2C', marginBottom:6 }}>Import complete · batch {String(result.batch_id).slice(0,8)}</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))', gap:8 }}>
                <Stat label="Total rows"  v={result.total ?? 0} />
                <Stat label="New added"   v={result.new ?? 0} color="#1F5C2C" />
                <Stat label="Duplicates"  v={result.duplicates ?? 0} color={INK_M} />
                <Stat label="Enriched"    v={result.enriched ?? 0} color="#8B5A1C" />
                <Stat label="Dropped"     v={result.dropped ?? 0} color={RED} />
              </div>
              {result.dropped_sample && Array.isArray(result.dropped_sample) && result.dropped_sample.length > 0 && (
                <details style={{ marginTop:10, fontSize:11 }}>
                  <summary style={{ cursor:'pointer', color:RED }}>{result.dropped_sample.length} sample dropped rows (no email · no website · no phone)</summary>
                  <pre style={{ marginTop:6, padding:8, background:'#FFFFFF', border:'1px solid '+HAIR, borderRadius:3, overflow:'auto', maxHeight:200 }}>
                    {JSON.stringify(result.dropped_sample, null, 2)}
                  </pre>
                </details>
              )}
            </>
          ) : (
            <div style={{ color:RED, fontWeight:600 }}>Import failed: {result.error ?? 'unknown'}</div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, v, color }: { label: string; v: number; color?: string }) {
  return (
    <div>
      <div style={{ fontSize:10, letterSpacing:'0.06em', textTransform:'uppercase', color:'#5A5A5A' }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:600, color: color ?? '#1B1B1B', fontVariantNumeric:'tabular-nums' }}>{v}</div>
    </div>
  );
}

const label = { display:'block', fontSize:10, letterSpacing:'0.06em', textTransform:'uppercase' as const, color:'#5A5A5A', marginBottom:4, fontWeight:600 };
const input = { width:'100%', padding:'6px 10px', fontSize:12, background:'#FFFFFF', border:'1px solid #E6DFCC', borderRadius:3, color:'#1B1B1B' };
