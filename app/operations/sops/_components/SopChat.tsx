'use client';

// app/operations/sops/_components/SopChat.tsx
// BRAIN v6 · SOP & Quality chat (PBS 2026-07-24): staff-facing window that
// talks ONLY about SOPs + QA/certification material. Runs at staff_ok tier
// via /api/brain/ask {scope:'sops'} — no owner corpus, no HR, no legal.

import { useCallback, useState } from 'react';

const box: React.CSSProperties = {
  background: 'var(--paper, #FFFFFF)', color: 'var(--ink, #1B1B1B)',
  border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 6, fontSize: 13,
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

export default function SopChat() {
  const [q, setQ] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  const ask = useCallback(async () => {
    const question = q.trim();
    if (!question || asking) return;
    setAsking(true); setAnswer(null);
    try {
      const res = await fetch('/api/brain/ask', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question, scope: 'sops' }),
      });
      const j = await res.json();
      setAnswer(j.ok ? (j.answer as string) : 'Error: ' + (j.error ?? 'ask failed'));
    } catch (e) {
      setAnswer('Error: ' + (e instanceof Error ? e.message : 'ask failed'));
    } finally { setAsking(false); }
  }, [q, asking]);

  return (
    <div style={{ ...box, padding: 14, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Ask about SOPs &amp; quality</div>
      <div style={{ fontSize: 11.5, opacity: 0.65, marginBottom: 8 }}>
        Answers only from SOPs, QA audits and certification standards — with links to the exact SOP.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void ask(); }}
          placeholder="e.g. How do we handle a guest complaint at breakfast? · What is the room inspection checklist?"
          style={{ ...box, flex: 1, padding: '8px 11px' }} />
        <button onClick={() => void ask()} disabled={asking || !q.trim()}
          style={{ ...box, cursor: 'pointer', padding: '8px 14px', background: '#1B1B1B', color: '#FFF', opacity: asking || !q.trim() ? 0.5 : 1 }}>
          {asking ? 'Reading SOPs…' : 'Ask'}
        </button>
      </div>
      {answer ? <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.55 }}>{renderAnswer(answer)}</div> : null}
    </div>
  );
}
