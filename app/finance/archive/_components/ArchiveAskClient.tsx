'use client';

// app/finance/archive/_components/ArchiveAskClient.tsx
// Archive overview · prompt window. Posts to /api/brain/ask (owner view,
// answers only from classified documents, with citations). Same contract as
// the Brain console ask box — kept as its own lean component so the Archive
// page stays a server component.

import { useCallback, useState } from 'react';

type Source = { doc_id: string; title: string; link: string };

/** minimal md → react: [title](link) links + line breaks. No deps. */
function renderAnswer(md: string) {
  const lines = md.split('\n');
  return lines.map((line, i) => {
    const parts: Array<string | JSX.Element> = [];
    let rest = line;
    let k = 0;
    while (rest.length > 0) {
      const m = rest.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (!m || m.index === undefined) { parts.push(rest); break; }
      if (m.index > 0) parts.push(rest.slice(0, m.index));
      parts.push(
        <a key={`${i}-${k++}`} href={m[2]} target="_blank" rel="noreferrer"
           style={{ color: '#084838', textDecoration: 'underline' }}>
          {m[1]}
        </a>
      );
      rest = rest.slice(m.index + m[0].length);
    }
    return <div key={i} style={{ minHeight: line.trim() ? undefined : 8 }}>{parts}</div>;
  });
}

const boxStyle: React.CSSProperties = {
  background: 'var(--paper, #FFFFFF)', color: 'var(--ink, #1B1B1B)',
  border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 6, fontSize: 13,
};

export default function ArchiveAskClient() {
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);

  const ask = useCallback(async () => {
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true); setAnswer(null); setSources([]);
    try {
      const res = await fetch('/api/brain/ask', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const j = await res.json();
      if (j.ok) { setAnswer(j.answer as string); setSources((j.sources ?? []) as Source[]); }
      else setAnswer('Error: ' + (j.error ?? 'ask failed'));
    } catch (e) {
      setAnswer('Error: ' + (e instanceof Error ? e.message : 'ask failed'));
    } finally { setAsking(false); }
  }, [question, asking]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void ask(); }}
          placeholder="e.g. What commission do we pay EXO Travel? · What does the Green Tea land lease say?"
          style={{ ...boxStyle, flex: 1, padding: '9px 12px' }}
        />
        <button onClick={() => void ask()} disabled={asking || !question.trim()}
          style={{
            ...boxStyle, cursor: 'pointer', padding: '9px 16px',
            background: '#1B1B1B', color: '#FFFFFF', fontWeight: 500,
            opacity: asking || !question.trim() ? 0.5 : 1,
          }}>
          {asking ? 'Searching…' : 'Ask the archive'}
        </button>
      </div>
      {answer ? (
        <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.55 }}>
          {renderAnswer(answer)}
          {sources.length > 0 ? (
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
              Sources: {sources.map((s, i) => (
                <span key={s.doc_id}>
                  {i > 0 ? ' · ' : ''}
                  <a href={s.link} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>{s.title}</a>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
