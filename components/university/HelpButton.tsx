'use client';

// components/university/HelpButton.tsx
// BRAIN v6 · the University help brain as a floating "?" (PBS 2026-07-24).
// Separate corpus by design: answers come ONLY from university.articles via
// /api/university/ask (FTS, citations, unanswered questions logged for PBS).
// Mounted app-wide in the root layout, bottom-right (BugWidget owns bottom-left).

import { useCallback, useState } from 'react';
import { usePathname } from 'next/navigation';

const panel: React.CSSProperties = {
  position: 'fixed', bottom: 76, right: 18, width: 380, maxWidth: 'calc(100vw - 36px)',
  background: '#FFFFFF', color: '#1B1B1B', border: '1px solid #E6DFCC', borderRadius: 10,
  boxShadow: '0 8px 30px rgba(0,0,0,0.18)', padding: 14, zIndex: 9990, fontSize: 13,
};

function renderAnswer(md: string) {
  return md.split('\n').map((line, i) => {
    const parts: Array<string | JSX.Element> = [];
    let rest = line, k = 0;
    while (rest.length > 0) {
      const m = rest.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (!m || m.index === undefined) { parts.push(rest); break; }
      if (m.index > 0) parts.push(rest.slice(0, m.index));
      parts.push(<a key={`${i}-${k++}`} href={m[2]} style={{ color: '#084838', textDecoration: 'underline' }}>{m[1]}</a>);
      rest = rest.slice(m.index + m[0].length);
    }
    return <div key={i} style={{ minHeight: line.trim() ? undefined : 8 }}>{parts}</div>;
  });
}

export default function HelpButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  const ask = useCallback(async () => {
    const question = q.trim();
    if (!question || asking) return;
    setAsking(true); setAnswer(null);
    try {
      const res = await fetch('/api/university/ask', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question, route: pathname }),
      });
      const j = await res.json();
      setAnswer(j.ok ? (j.answer as string) : 'Error: ' + (j.error ?? 'ask failed'));
    } catch (e) {
      setAnswer('Error: ' + (e instanceof Error ? e.message : 'ask failed'));
    } finally { setAsking(false); }
  }, [q, asking, pathname]);

  // login/public surfaces don't need the help brain
  if (pathname?.startsWith('/login') || pathname?.startsWith('/p/') || pathname?.startsWith('/subscriber/')) return null;

  return (
    <>
      <button aria-label="Help" onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 18, right: 18, width: 44, height: 44, borderRadius: 22,
          background: '#084838', color: '#FFFFFF', border: 'none', cursor: 'pointer',
          fontSize: 20, fontWeight: 700, zIndex: 9990, boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
        }}>
        ?
      </button>
      {open ? (
        <div style={panel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <div style={{ fontWeight: 700 }}>How do I…?</div>
            <button onClick={() => setOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 15, opacity: 0.6 }}>✕</button>
          </div>
          <div style={{ fontSize: 11.5, opacity: 0.65, marginBottom: 8 }}>
            Answers come from the TBC University help articles only. Unanswered questions are flagged so the missing article gets written.
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={q} onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void ask(); }}
              placeholder="e.g. How do I accept a newsletter proposal?"
              style={{ flex: 1, border: '1px solid #E6DFCC', borderRadius: 6, padding: '7px 10px', fontSize: 12.5 }} />
            <button onClick={() => void ask()} disabled={asking || !q.trim()}
              style={{ border: 'none', borderRadius: 6, padding: '7px 12px', background: '#1B1B1B', color: '#FFF', cursor: 'pointer', opacity: asking || !q.trim() ? 0.5 : 1, fontSize: 12.5 }}>
              {asking ? '…' : 'Ask'}
            </button>
          </div>
          {answer ? (
            <div style={{ marginTop: 10, maxHeight: 320, overflowY: 'auto', lineHeight: 1.5 }}>{renderAnswer(answer)}</div>
          ) : null}
          <div style={{ marginTop: 8, fontSize: 11, opacity: 0.55 }}>
            <a href="/university" style={{ textDecoration: 'underline' }}>Open TBC University →</a>
          </div>
        </div>
      ) : null}
    </>
  );
}
