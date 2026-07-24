'use client';

// components/brain/AskFeedback.tsx
// BRAIN v4 · the two owner feedback loops under every archive/brain answer:
//   CONFIRM — preserve the answer (full, or edited down to the good part) as
//             verified knowledge (brain.verified_answers, embedded, ACL-tiered).
//   TEACH   — point the brain at the right documents (registry picker); flagged
//             unreadable docs jump the OCR queue.
// Used by ArchiveAskClient and the Brain settings console.

import { useCallback, useState } from 'react';

type Source = { doc_id: string; title: string; link: string };
type FoundDoc = { doc_id: string; title: string | null; doc_kind: string | null; extraction_status: string; readable: boolean };

const box: React.CSSProperties = {
  background: 'var(--paper, #FFFFFF)', color: 'var(--ink, #1B1B1B)',
  border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 6, fontSize: 12.5,
};
const btn: React.CSSProperties = { ...box, cursor: 'pointer', padding: '5px 11px' };

export default function AskFeedback({ question, answer, sources }: {
  question: string; answer: string; sources: Source[];
}) {
  const [mode, setMode] = useState<'idle' | 'edit' | 'teach'>('idle');
  const [editText, setEditText] = useState(answer);
  const [sensitivity, setSensitivity] = useState('owner_only');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [teachQ, setTeachQ] = useState('');
  const [found, setFound] = useState<FoundDoc[]>([]);
  const [picked, setPicked] = useState<Record<string, string>>({});

  const confirm = useCallback(async (text: string) => {
    if (busy) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/brain/confirm', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          question, answer_md: text, sensitivity,
          doc_ids: sources.map(s => s.doc_id),
        }),
      });
      const j = await res.json();
      setMsg(j.ok
        ? `✓ Preserved as verified knowledge #${j.verified_id} (${sensitivity}). Future similar questions will use it first.`
        : 'Failed: ' + (j.error ?? '?'));
      if (j.ok) setMode('idle');
    } catch (e) {
      setMsg('Failed: ' + (e instanceof Error ? e.message : '?'));
    } finally { setBusy(false); }
  }, [busy, question, sensitivity, sources]);

  const search = useCallback(async (q: string) => {
    setTeachQ(q);
    if (q.trim().length < 3) { setFound([]); return; }
    try {
      const res = await fetch('/api/brain/docfind?q=' + encodeURIComponent(q), { cache: 'no-store' });
      const j = await res.json();
      if (j.ok) setFound((j.docs ?? []) as FoundDoc[]);
    } catch { /* noop */ }
  }, []);

  const teach = useCallback(async () => {
    const ids = Object.keys(picked);
    if (busy || ids.length === 0) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/brain/teach', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question, doc_ids: ids }),
      });
      const j = await res.json();
      setMsg(j.ok
        ? `✓ Noted. ${ids.length} document(s) linked to this question${j.result?.ocr_prioritized ? `; ${j.result.ocr_prioritized} pushed to the front of the OCR queue` : ''}.`
        : 'Failed: ' + (j.error ?? '?'));
      if (j.ok) { setMode('idle'); setPicked({}); setFound([]); }
    } catch (e) {
      setMsg('Failed: ' + (e instanceof Error ? e.message : '?'));
    } finally { setBusy(false); }
  }, [busy, picked, question]);

  return (
    <div style={{ marginTop: 10 }}>
      {mode === 'idle' ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button style={btn} disabled={busy} onClick={() => void confirm(answer)}>✓ Confirm answer</button>
          <button style={btn} onClick={() => { setEditText(answer); setMode('edit'); }}>Confirm part / edit</button>
          <button style={btn} onClick={() => { setMode('teach'); void search(question); }}>Point the brain at documents</button>
          <select value={sensitivity} onChange={e => setSensitivity(e.target.value)} style={{ ...box, padding: '4px 6px' }}>
            <option value="owner_only">visible: owner only</option>
            <option value="legal_confidential">visible: legal</option>
            <option value="management">visible: management</option>
            <option value="staff_ok">visible: staff</option>
          </select>
        </div>
      ) : null}

      {mode === 'edit' ? (
        <div>
          <div style={{ fontSize: 11.5, opacity: 0.7, marginBottom: 4 }}>
            Cut it down to the part that is correct — only what you save is preserved.
          </div>
          <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={8}
            style={{ ...box, width: '100%', padding: 8, fontFamily: 'ui-monospace, monospace', fontSize: 12 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button style={btn} disabled={busy || editText.trim().length < 20} onClick={() => void confirm(editText)}>Save as verified</button>
            <button style={btn} onClick={() => setMode('idle')}>Cancel</button>
          </div>
        </div>
      ) : null}

      {mode === 'teach' ? (
        <div>
          <div style={{ fontSize: 11.5, opacity: 0.7, marginBottom: 4 }}>
            Search the register, tick the documents that answer this question. Unreadable (scanned) ones jump the OCR queue.
          </div>
          <input value={teachQ} onChange={e => void search(e.target.value)} placeholder="search document titles…"
            style={{ ...box, width: '100%', padding: '7px 10px' }} />
          <div style={{ maxHeight: 220, overflowY: 'auto', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {found.map(d => (
              <label key={d.doc_id} style={{ display: 'flex', gap: 7, alignItems: 'baseline', fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!picked[d.doc_id]}
                  onChange={e => setPicked(p => {
                    const n = { ...p };
                    if (e.target.checked) n[d.doc_id] = d.title ?? ''; else delete n[d.doc_id];
                    return n;
                  })} />
                <span>{d.title ?? d.doc_id.slice(0, 8)}</span>
                <span style={{ opacity: 0.55, fontSize: 11 }}>
                  {d.doc_kind ?? '—'} · {d.readable ? 'readable' : d.extraction_status === 'ocr_needed' ? 'scanned (OCR pending)' : d.extraction_status}
                </span>
              </label>
            ))}
            {found.length === 0 && teachQ.trim().length >= 3 ? <div style={{ fontSize: 12, opacity: 0.6 }}>No register matches.</div> : null}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button style={btn} disabled={busy || Object.keys(picked).length === 0} onClick={() => void teach()}>
              Link {Object.keys(picked).length || ''} document(s) to this question
            </button>
            <button style={btn} onClick={() => setMode('idle')}>Cancel</button>
          </div>
        </div>
      ) : null}

      {msg ? <div style={{ marginTop: 6, fontSize: 12 }}>{msg}</div> : null}
    </div>
  );
}
