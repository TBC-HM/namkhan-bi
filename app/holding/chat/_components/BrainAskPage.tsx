'use client';
// app/holding/chat/_components/BrainAskPage.tsx
// Standalone brain Q&A interface — the correct target for ASK THE BRAIN button.
// Queries /api/brain/ask (document brain: DMS docs, contracts, SOPs, embeddings).
// NOT Felix's general chat — this is the second-brain document search.
// Auto-submits the initial question from the ?q= URL param.

import { useEffect, useRef, useState } from 'react';

const MONO = 'JetBrains Mono, ui-monospace, monospace';

type Source = { doc_id: string; title: string; link: string };

function renderAnswer(md: string): JSX.Element[] {
  const lines = md.split('\n');
  return lines.map((line, i) => {
    const parts: (string | JSX.Element)[] = [];
    let rest = line;
    let k = 0;
    while (rest.length > 0) {
      const m = rest.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (!m || m.index === undefined) { parts.push(rest); break; }
      if (m.index > 0) parts.push(rest.slice(0, m.index));
      parts.push(<a key={`${i}-${k++}`} href={m[2]} target="_blank" rel="noreferrer" style={{ color: '#084838', textDecoration: 'underline' }}>{m[1]}</a>);
      rest = rest.slice(m.index + m[0].length);
    }
    return <div key={i} style={{ minHeight: line.trim() ? undefined : 8 }}>{parts}</div>;
  });
}

interface Props {
  initialQuestion: string;
  propertyId: number | null;
  dept: string;
}

export default function BrainAskPage({ initialQuestion, propertyId, dept }: Props) {
  const [question, setQuestion] = useState(initialQuestion);
  const [asking, setAsking]     = useState(false);
  const [answer, setAnswer]     = useState<string | null>(null);
  const [sources, setSources]   = useState<Source[]>([]);
  const [error, setError]       = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function ask(q: string) {
    if (!q.trim() || asking) return;
    setAsking(true); setAnswer(null); setSources([]); setError(null);
    try {
      const res = await fetch('/api/brain/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: q.trim(), property_id: propertyId }),
      });
      const j = await res.json();
      if (j.ok) {
        setAnswer(j.answer);
        setSources(j.sources ?? []);
      } else {
        setError(j.error ?? 'Brain ask failed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setAsking(false);
    }
  }

  // Auto-submit initial question
  useEffect(() => {
    if (initialQuestion.trim()) {
      ask(initialQuestion);
    } else {
      inputRef.current?.focus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deptLabel = dept ? `· ${dept}` : '';

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF7', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#084838', color: '#FFF', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 20 }}>🧠</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Company Brain {deptLabel}</div>
          <div style={{ fontSize: 11, opacity: 0.75, fontFamily: MONO }}>Document search · contracts · SOPs · certifications · property_id={propertyId ?? 'holding'}</div>
        </div>
        <a href="javascript:history.back()" style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>← Back</a>
      </div>

      {/* Ask form */}
      <div style={{ maxWidth: 760, margin: '32px auto', padding: '0 24px' }}>
        <form onSubmit={(e) => { e.preventDefault(); ask(question); }} style={{ display: 'flex', gap: 8 }}>
          <input
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask the document brain — contracts, SOPs, certifications, company policies…"
            disabled={asking}
            style={{
              flex: 1, padding: '12px 14px', fontSize: 14,
              border: '1px solid #E6DFCC', borderRadius: 6, background: '#FFF',
              color: '#1B1B1B', outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={asking || !question.trim()}
            style={{
              padding: '12px 20px', background: '#084838', color: '#FFF',
              border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 13,
              cursor: asking ? 'default' : 'pointer', opacity: asking ? 0.6 : 1,
            }}
          >
            {asking ? 'Searching…' : 'Ask'}
          </button>
        </form>

        {/* Answer */}
        {answer && (
          <div style={{ marginTop: 24, background: '#FFF', border: '1px solid #E6DFCC', borderRadius: 8, padding: '20px 22px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5A5A5A', marginBottom: 12, fontFamily: MONO }}>
              Brain answer
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: '#1B1B1B' }}>
              {renderAnswer(answer)}
            </div>
            {sources.length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #E6DFCC' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#5A5A5A', fontFamily: MONO, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Sources</div>
                {sources.map((s) => (
                  <div key={s.doc_id} style={{ fontSize: 12, marginBottom: 4 }}>
                    <a href={s.link} target="_blank" rel="noreferrer" style={{ color: '#084838', textDecoration: 'underline' }}>{s.title}</a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ marginTop: 16, padding: '12px 14px', background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: 6, fontSize: 13, color: '#C62828' }}>
            {error}
          </div>
        )}

        {!answer && !asking && !error && (
          <div style={{ marginTop: 32, color: '#888', fontSize: 12, fontFamily: MONO }}>
            Searches DMS documents · contracts · SOPs · certifications · brand docs · verified answers
          </div>
        )}
      </div>
    </div>
  );
}
