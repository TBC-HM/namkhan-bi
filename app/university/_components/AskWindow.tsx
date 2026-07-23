'use client';
// app/university/_components/AskWindow.tsx
// TBC University · THE ASK WINDOW — the owner's "prompt window on top".
// Posts to /api/university/ask; renders the grounded answer with "From:"
// citation links. Fallback wording is fixed per the design brief and must
// match the server's fallback exactly.

import { useState } from 'react';

const INK = '#1B1B1B';
const INK_SOFT = '#5A5A5A';
const HAIR = '#E6DFCC';
const GREEN = '#084838';
const CREAM = '#F7F0E1';

type Citation = { slug: string; title: string; module: string };
type AskResult = { ok: boolean; answer?: string; citations?: Citation[]; answered?: boolean; error?: string };

export default function AskWindow({ module, route, placeholder }: { module?: string; route?: string; placeholder?: string }) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<AskResult | null>(null);

  const ask = async () => {
    const question = q.trim();
    if (!question || busy) return;
    setBusy(true);
    setRes(null);
    try {
      const r = await fetch('/api/university/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, module: module ?? null, route: route ?? null }),
      });
      const j = (await r.json()) as AskResult;
      setRes(j.ok ? j : { ok: false, error: j.error ?? 'Something went wrong — try again.' });
    } catch {
      setRes({ ok: false, error: 'Network error — try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ background: '#FFFFFF', border: `1px solid ${HAIR}`, borderTop: `3px solid ${GREEN}`, borderRadius: 6, padding: '16px 18px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK_SOFT, marginBottom: 8 }}>
        Ask TBC University{module ? ` · ${module}` : ''}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') ask(); }}
          placeholder={placeholder ?? 'Ask anything — e.g. "How do I change the hero photo?"'}
          style={{
            flex: 1, fontSize: 14, padding: '10px 12px', border: `1px solid ${HAIR}`, borderRadius: 5,
            fontFamily: 'inherit', color: INK, background: '#FFFFFF', outline: 'none',
          }}
        />
        <button
          type="button" onClick={ask} disabled={busy || !q.trim()}
          style={{
            fontSize: 13, fontWeight: 600, padding: '10px 18px', borderRadius: 5, border: 'none',
            background: GREEN, color: '#FFFFFF', cursor: busy || !q.trim() ? 'default' : 'pointer',
            opacity: busy || !q.trim() ? 0.6 : 1, fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}
        >
          {busy ? 'Thinking…' : 'Ask'}
        </button>
      </div>

      {res && (
        <div style={{ marginTop: 12, background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 5, padding: '12px 14px' }}>
          {res.ok ? (
            <>
              <div style={{ fontSize: 13.5, lineHeight: 1.65, color: INK, whiteSpace: 'pre-wrap' }}>{res.answer}</div>
              {Array.isArray(res.citations) && res.citations.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${HAIR}`, fontSize: 12, color: INK_SOFT }}>
                  From:{' '}
                  {res.citations.map((c, i) => (
                    <span key={c.slug}>
                      {i > 0 && ' · '}
                      <a href={`/university/${c.module}/${c.slug}`} style={{ color: GREEN, textDecoration: 'underline', textUnderlineOffset: 2 }}>
                        {c.title}
                      </a>
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 13, color: '#B03826' }}>{res.error}</div>
          )}
        </div>
      )}
    </section>
  );
}
