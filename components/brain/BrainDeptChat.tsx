'use client';

// components/brain/BrainDeptChat.tsx
// BRAIN v6 · department-scoped brain window (PBS 2026-07-24: "make the brain
// the universal chatter, restricted per area"). Mounted as the DEFAULT answer
// layer on /cockpit/chat?dept=... — the agent chat below stays for ACTIONS
// (reports, rate changes, tickets) until the brain's action layer reaches parity.
// Borders are SQL-enforced per scope (doc kinds + max sensitivity tier).

import { useCallback, useState } from 'react';

const box: React.CSSProperties = {
  background: 'var(--paper, #FFFFFF)', color: 'var(--ink, #1B1B1B)',
  border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 8, fontSize: 13,
};

const SCOPE_LABEL: Record<string, string> = {
  sops: 'SOPs & quality',
  marketing: 'marketing · brand · factsheets · market research',
  revenue: 'DMC & OTA agreements · market research · factsheets',
  operations: 'SOPs · suppliers · licenses · insurance · facilities',
  admin: 'the company archive (management tier)',
};

function renderAnswer(md: string) {
  return md.split('\n').map((line, i) => {
    const parts: Array<string | JSX.Element> = [];
    let rest = line, k = 0;
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

export default function BrainDeptChat({ scope, standalone }: { scope: string; standalone?: boolean }) {
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
        body: JSON.stringify({ question, scope }),
      });
      const j = await res.json();
      setAnswer(j.ok ? (j.answer as string) : 'Error: ' + (j.error ?? 'ask failed'));
    } catch (e) {
      setAnswer('Error: ' + (e instanceof Error ? e.message : 'ask failed'));
    } finally { setAsking(false); }
  }, [q, asking, scope]);

  return (
    <div style={{ ...box, padding: 14, marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Ask the brain</div>
      <div style={{ fontSize: 11.5, opacity: 0.65, marginBottom: 8 }}>
        Instant, cited answers from {SCOPE_LABEL[scope] ?? 'the company knowledge'} — department-bordered.
        {standalone ? ' Actions (adapt docs, reports, exports) are coming to this window next.' : ' For actions (reports, changes, tickets) use the agent chat below.'}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void ask(); }}
          placeholder="ask anything in this department's knowledge…"
          style={{ ...box, flex: 1, padding: '8px 11px' }} />
        <button onClick={() => void ask()} disabled={asking || !q.trim()}
          style={{ ...box, cursor: 'pointer', padding: '8px 14px', background: '#084838', color: '#FFF', opacity: asking || !q.trim() ? 0.5 : 1 }}>
          {asking ? 'Thinking…' : 'Ask'}
        </button>
      </div>
      {answer ? <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.55 }}>{renderAnswer(answer)}</div> : null}
    </div>
  );
}
