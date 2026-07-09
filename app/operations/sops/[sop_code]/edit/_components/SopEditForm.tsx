'use client';
// app/operations/sops/[sop_code]/edit/_components/SopEditForm.tsx
// Simple form — POSTs to existing /api/sop/save which relays to fn_sop_upsert.

import { useState } from 'react';

interface InitialRow {
  sop_code: string; title: string; dept_code: string;
  short_summary: string | null; body_md: string | null;
  author: string | null; sop_date: string | null;
  primary_audience: string | null; source: string | null;
  property_id: number | null;
}

export default function SopEditForm({ initial }: { initial: InitialRow }) {
  const [title, setTitle] = useState(initial.title);
  const [summary, setSummary] = useState(initial.short_summary ?? '');
  const [author, setAuthor] = useState(initial.author ?? '');
  const [sopDate, setSopDate] = useState(initial.sop_date ?? new Date().toISOString().slice(0, 10));
  const [audience, setAudience] = useState(initial.primary_audience ?? '');
  const [body, setBody] = useState(initial.body_md ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const r = await fetch('/api/sop/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: initial.property_id ?? 260955,
          dept_code: initial.dept_code,
          sop_code: initial.sop_code,
          title,
          short_summary: summary,
          bullets: body.split('\n').filter(Boolean),
          author,
          sop_date: sopDate,
          primary_audience: audience,
          source: initial.source ?? 'manual',
        }),
      });
      const j = await r.json();
      if (!r.ok || j.error) setMsg({ kind: 'err', text: j.error ?? `HTTP ${r.status}` });
      else setMsg({ kind: 'ok', text: 'Saved.' });
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {msg && (
        <div style={{ padding: '8px 12px', borderRadius: 4, fontSize: 12,
          background: msg.kind === 'ok' ? '#F0F7F2' : '#FFF3F1',
          color: msg.kind === 'ok' ? '#084838' : '#B04A2F',
          border: '1px solid ' + (msg.kind === 'ok' ? '#0848380F' : '#B04A2F33') }}>{msg.text}</div>
      )}
      <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} style={inp} /></Field>
      <Field label="Short summary"><input value={summary} onChange={(e) => setSummary(e.target.value)} style={inp} /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        <Field label="Author"><input value={author} onChange={(e) => setAuthor(e.target.value)} style={inp} /></Field>
        <Field label="SOP date"><input type="date" value={sopDate} onChange={(e) => setSopDate(e.target.value)} style={inp} /></Field>
        <Field label="Primary audience"><input value={audience} onChange={(e) => setAudience(e.target.value)} style={inp} /></Field>
      </div>
      <Field label="Body (one bullet per line)"><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={16} style={{ ...inp, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} /></Field>
      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
        <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? 'Saving…' : 'Save'}</button>
        <a href={`/operations/sops/${encodeURIComponent(initial.sop_code)}/preview`} style={btnGhost}>Preview</a>
        <a href="/operations/sops" style={btnGhost}>← Back</a>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5A5A5A' }}>{label}</span>
      {children}
    </label>
  );
}

const inp: React.CSSProperties = { padding: '8px 10px', border: '1px solid #E6DFCC', borderRadius: 4, fontSize: 13, background: '#FFFFFF', color: '#1B1B1B', width: '100%' };
const btnPrimary: React.CSSProperties = { padding: '8px 16px', background: '#084838', color: '#FFFFFF', border: '1px solid #084838', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { padding: '8px 14px', background: '#FFFFFF', color: '#5A5A5A', border: '1px solid #E6DFCC', borderRadius: 4, fontSize: 12, fontWeight: 500, textDecoration: 'none' };
