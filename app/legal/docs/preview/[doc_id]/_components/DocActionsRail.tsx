'use client';
// app/legal/docs/preview/[doc_id]/_components/DocActionsRail.tsx
// Right-side action rail for the preview page. Calls the new translate +
// summarize APIs, renders results inline below the viewer.

import { useState } from 'react';

interface Props { docId: string }

type Mode = 'translate' | 'summarize';

export default function DocActionsRail({ docId }: Props) {
  const [busy, setBusy] = useState<Mode | null>(null);
  const [result, setResult] = useState<{ mode: Mode; ok: boolean; text?: string; error?: string } | null>(null);

  async function run(mode: Mode, to?: string) {
    setBusy(mode);
    setResult(null);
    try {
      const endpoint = mode === 'translate' ? '/api/legal/docs/translate' : '/api/legal/docs/summarize';
      const body = mode === 'translate' ? { doc_id: docId, to: to ?? 'en' } : { doc_id: docId };
      const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({ ok: false, error: 'invalid response' }));
      if (!r.ok || !j.ok) { setResult({ mode, ok: false, error: j?.error || `${r.status}` }); return; }
      const text = mode === 'translate' ? j.translation : j.summary;
      setResult({ mode, ok: true, text });
    } catch (e: any) {
      setResult({ mode, ok: false, error: e?.message ?? 'unknown error' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <aside style={{ width: 320, flexShrink: 0, padding: 12, borderLeft: '1px solid #E0E0E0', background: '#FCFBF5', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Doc actions</div>

      <button onClick={() => run('translate', 'en')} disabled={busy !== null} style={btn(busy === 'translate')}>
        {busy === 'translate' ? '⏳ Translating…' : '🌐 Translate → English'}
      </button>
      <button onClick={() => run('translate', 'lo')} disabled={busy !== null} style={btnSecondary(busy === 'translate')}>
        Translate → Lao
      </button>
      <button onClick={() => run('summarize')} disabled={busy !== null} style={btn(busy === 'summarize')}>
        {busy === 'summarize' ? '⏳ Summarizing…' : '✍️ Summarize'}
      </button>

      {result && (
        <div style={{
          marginTop: 4, padding: 10,
          border: `1px solid ${result.ok ? '#1B1B1B' : '#C62828'}`,
          background: '#FFFFFF', borderRadius: 4, fontSize: 11, color: '#1B1B1B',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            {result.ok ? '✓ done' : '✗ failed'} · {result.mode}
          </div>
          {result.error && <pre style={{ color: '#C62828', whiteSpace: 'pre-wrap', margin: 0, fontSize: 11 }}>{result.error}</pre>}
          {result.text && (
            <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit', fontSize: 12, lineHeight: 1.45, maxHeight: '60vh', overflow: 'auto' }}>{result.text}</pre>
          )}
        </div>
      )}

      <div style={{ marginTop: 'auto', fontSize: 10, color: '#5A5A5A', lineHeight: 1.4 }}>
        Translation uses Claude Sonnet · faithful, no paraphrase.<br />
        Summary writes back to the doc&rsquo;s <code>summary</code> field, so the ★ note marker will appear across the register.
      </div>
    </aside>
  );
}

const btn = (busy: boolean): React.CSSProperties => ({
  padding: '8px 12px', border: '1px solid #1B1B1B', borderRadius: 3,
  background: busy ? '#5A5A5A' : '#1B1B1B', color: '#FFFFFF',
  fontSize: 12, cursor: busy ? 'wait' : 'pointer', textAlign: 'left',
});
const btnSecondary = (busy: boolean): React.CSSProperties => ({
  padding: '6px 12px', border: '1px solid #1B1B1B', borderRadius: 3,
  background: '#FFFFFF', color: '#1B1B1B',
  fontSize: 11, cursor: busy ? 'wait' : 'pointer', textAlign: 'left',
});
