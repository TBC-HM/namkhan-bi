'use client';

// app/page.tsx — THE CANVAS.
// PBS directive 2026-05-09: stop building dashboards. The single surface
// is a question + a brief + proposal cards + a 3-state kanban.
//
// Flow per turn:
//   1. ask                       → POST /api/canvas/ask
//   2. brief renders             ← signal · good · bad · proposal cards
//   3. approve / tweak / reject  → POST /api/canvas/proposal/[id]/{approve,reject}
//   4. proposal slides into the kanban (3 lanes at the bottom)
//   5. audit_log captures every transition; trust meter unlocks auto-run
//      after N approves of (agent, action_type).
//
// No dept dashboards on this surface. Dept entry pages still exist
// (/revenue, /sales, ...) for direct dept work; the architect launcher
// is now parked at /architect.

import { useEffect, useRef, useState } from 'react';

interface Proposal {
  id: number;
  agent_role: string;
  action_type: string;
  dept: string | null;
  signal: string;
  body: string | null;
  status: 'proposal' | 'in_process' | 'done' | 'rejected';
  requires_approval: boolean;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  evidence: unknown;
}
interface Brief {
  signal: string;
  body: string;
  good: string[];
  bad: string[];
}
interface TrustRow {
  agent_role: string;
  action_type: string;
  approve_count: number;
  reject_count: number;
  threshold: number;
  auto_unlocked: boolean;
}

export default function Canvas() {
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [briefProposals, setBriefProposals] = useState<Proposal[]>([]);
  const [lanes, setLanes] = useState<{ proposal: Proposal[]; in_process: Proposal[]; done: Proposal[]; rejected: Proposal[] }>({
    proposal: [], in_process: [], done: [], rejected: [],
  });
  const [trust, setTrust] = useState<TrustRow[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function loadLanes() {
    try {
      const r = await fetch('/api/canvas/lanes', { cache: 'no-store' });
      const j = await r.json();
      if (j.lanes) setLanes(j.lanes);
      if (Array.isArray(j.trust)) setTrust(j.trust);
    } catch { /* silent */ }
  }
  useEffect(() => {
    loadLanes();
    const id = setInterval(loadLanes, 6000);
    inputRef.current?.focus();
    return () => clearInterval(id);
  }, []);

  async function ask() {
    const q = question.trim();
    if (!q) return;
    setBusy(true);
    setError(null);
    setBrief(null);
    setBriefProposals([]);
    try {
      const r = await fetch('/api/canvas/ask', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error || `HTTP ${r.status}`); return; }
      setBrief(j.brief);
      setBriefProposals(Array.isArray(j.proposals) ? j.proposals : []);
      setQuestion('');
      void loadLanes();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ask failed');
    } finally {
      setBusy(false);
    }
  }

  async function approve(id: number) {
    await fetch(`/api/canvas/proposal/${id}/approve`, { method: 'POST' });
    setBriefProposals(prev => prev.map(p => p.id === id ? { ...p, status: 'in_process' } : p));
    void loadLanes();
  }
  async function reject(id: number) {
    const reason = prompt('Why reject? (optional)');
    await fetch(`/api/canvas/proposal/${id}/reject`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    setBriefProposals(prev => prev.filter(p => p.id !== id));
    void loadLanes();
  }
  async function complete(id: number) {
    // Mock executor — flips in_process → done with a pseudo evidence
    // payload so PBS can see the lane move. Real integrations replace this.
    await fetch(`/api/canvas/proposal/${id}/done`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evidence: { mock: true, completed_at: new Date().toISOString() } }),
    });
    void loadLanes();
  }

  return (
    <div style={page}>
      {/* Top — eyebrow + greeting */}
      <div style={{ marginBottom: 24, marginLeft: 56 }}>
        <div style={eyebrow}>Canvas · the hotel</div>
        <h1 style={greeting}>What does the hotel need?</h1>
        <div style={{ color: '#7d7565', fontSize: 13, lineHeight: 1.5, maxWidth: 720, marginTop: 6 }}>
          Ask anything. The agents read the data, surface the signal, propose actions. You approve, tweak, or reject. Approved proposals run; trust unlocks auto-run over time.
        </div>
      </div>

      {/* Composer */}
      <form onSubmit={(e) => { e.preventDefault(); ask(); }} style={composerWrap}>
        <textarea
          ref={inputRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); ask(); } }}
          placeholder="e.g. how do we play the long weekend?  ·  reply to the latest bad review  ·  re-engage silent B2B partners"
          rows={2}
          style={composerInput}
        />
        <button type="submit" disabled={busy || !question.trim()} style={composerBtn(busy || !question.trim())}>
          {busy ? '…' : 'Ask ↑'}
        </button>
      </form>
      {error && (
        <div style={errBanner}>
          ⚠️ {error}
          <button onClick={() => setError(null)} style={errClose}>×</button>
        </div>
      )}

      {/* Brief */}
      {brief && (
        <div style={briefWrap}>
          <div style={signalEyebrow}>✦ Signal</div>
          <div style={signalLine}>{brief.signal}</div>
          {brief.body && <div style={signalBody}>{brief.body}</div>}

          <div style={goodBadGrid}>
            <div style={goodCard}>
              <div style={cardEyebrow('good')}>Good · opportunity</div>
              <ul style={listReset}>{brief.good.map((g, i) => <li key={i} style={listItem('#7c9a6b')}>{g}</li>)}</ul>
            </div>
            <div style={badCard}>
              <div style={cardEyebrow('bad')}>Bad · leakage</div>
              <ul style={listReset}>{brief.bad.map((b, i) => <li key={i} style={listItem('#c0584c')}>{b}</li>)}</ul>
            </div>
          </div>

          {briefProposals.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={signalEyebrow}>Proposals</div>
              <div style={proposalGrid}>
                {briefProposals.map((p) => (
                  <ProposalCard key={p.id} p={p} onApprove={() => approve(p.id)} onReject={() => reject(p.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lanes — kanban */}
      <div style={lanesWrap}>
        <div style={signalEyebrow}>State</div>
        <div style={lanesGrid}>
          <Lane label="Proposal"   accent="#a8854a" items={lanes.proposal}   render={(p) => <LaneCard p={p} cta={[{ label: 'Approve', onClick: () => approve(p.id), primary: true }, { label: 'Reject', onClick: () => reject(p.id) }]} />} />
          <Lane label="In process" accent="#c79a6b" items={lanes.in_process} render={(p) => <LaneCard p={p} cta={[{ label: 'Mark done', onClick: () => complete(p.id), primary: true }]} />} />
          <Lane label="Done"       accent="#7c9a6b" items={lanes.done}       render={(p) => <LaneCard p={p} muted />} />
        </div>
        {lanes.rejected.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ ...cardEyebrow('bad'), marginBottom: 6 }}>Rejected · last 6</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {lanes.rejected.map((p) => (
                <span key={p.id} style={rejectChip}>{p.signal.slice(0, 60)}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Trust meter */}
      {trust.length > 0 && (
        <div style={trustWrap}>
          <div style={{ ...signalEyebrow, marginBottom: 8 }}>Trust meter · auto-run unlocks</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {trust.map((t) => (
              <div key={`${t.agent_role}-${t.action_type}`} style={trustPill(t.auto_unlocked)}>
                <span style={{ fontWeight: 600 }}>{t.agent_role}</span>
                <span style={{ color: '#7d7565' }}>{t.action_type}</span>
                <span>{t.approve_count}/{t.threshold}</span>
                {t.auto_unlocked && <span style={{ color: '#7c9a6b' }}>● auto</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── components ────────────────────────────────────────────────────────

function ProposalCard({ p, onApprove, onReject }: { p: Proposal; onApprove: () => void; onReject: () => void }) {
  const inProcess = p.status === 'in_process';
  return (
    <div style={proposalCard(inProcess)}>
      <div style={proposalAgent}>
        <span style={{ color: '#a8854a' }}>{p.agent_role}</span>
        <span style={{ color: '#5a5448' }}>·</span>
        <span style={{ color: '#7d7565' }}>{p.action_type}</span>
      </div>
      <div style={proposalSignal}>{p.signal}</div>
      {p.body && <div style={proposalBody}>{p.body}</div>}

      <div style={proposalCta}>
        {!inProcess && (
          <>
            <button onClick={onApprove} style={ctaBtn(true)}>⏵ Approve</button>
            <button onClick={onReject}  style={ctaBtn(false)}>Reject</button>
          </>
        )}
        {inProcess && <span style={{ color: '#c79a6b', fontSize: 11, fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: '0.16em', textTransform: 'uppercase' }}>● in process</span>}
      </div>
    </div>
  );
}

function Lane({ label, accent, items, render }: { label: string; accent: string; items: Proposal[]; render: (p: Proposal) => React.ReactNode }) {
  return (
    <div style={{
      background: '#0f0d0a', border: '1px solid #1f1c15', borderRadius: 12,
      padding: '12px 14px', display: 'flex', flexDirection: 'column', minHeight: 220,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #1f1c15',
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: accent,
        }}>{label}</span>
        <span style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 10, color: '#5a5448',
        }}>{items.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.length === 0 && <div style={{ fontSize: 12, color: '#5a5040', fontStyle: 'italic', padding: '8px 4px' }}>nothing here</div>}
        {items.map((p) => <div key={p.id}>{render(p)}</div>)}
      </div>
    </div>
  );
}

function LaneCard({ p, cta = [], muted = false }: { p: Proposal; cta?: { label: string; onClick: () => void; primary?: boolean }[]; muted?: boolean }) {
  return (
    <div style={{
      background: muted ? '#0a0a0a' : '#15110b',
      border: '1px solid #2a261d', borderRadius: 8,
      padding: '8px 10px',
      opacity: muted ? 0.7 : 1,
    }}>
      <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 9, letterSpacing: '0.18em', color: '#7d7565', textTransform: 'uppercase', marginBottom: 4 }}>
        {p.agent_role} · {p.action_type}
      </div>
      <div style={{ fontSize: 12, color: '#d8cca8', lineHeight: 1.45 }}>{p.signal}</div>
      {cta.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {cta.map((c, i) => (
            <button key={i} onClick={c.onClick} style={smallCta(!!c.primary)}>{c.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── styles ────────────────────────────────────────────────────────────

const page: React.CSSProperties = {
  minHeight: '100vh', background: '#0a0a0a', color: '#e9e1ce',
  fontFamily: "'Inter Tight', system-ui, sans-serif",
  padding: '32px 32px 64px', maxWidth: 1280, margin: '0 auto',
};
const eyebrow: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
  color: '#a8854a', marginBottom: 6,
};
const greeting: React.CSSProperties = {
  fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic',
  fontWeight: 300, fontSize: 'clamp(28px, 3.5vw, 40px)', color: '#e9e1ce', margin: 0,
};

const composerWrap: React.CSSProperties = {
  display: 'flex', gap: 8, alignItems: 'stretch', maxWidth: 880, margin: '0 auto 14px',
};
const composerInput: React.CSSProperties = {
  flex: 1, background: '#15110b', border: '1px solid #2a261d', borderRadius: 12,
  color: '#efe6d3', padding: '14px 16px', fontSize: 15, lineHeight: 1.5,
  fontFamily: 'inherit', outline: 'none', resize: 'vertical',
};
const composerBtn = (disabled: boolean): React.CSSProperties => ({
  background: disabled ? '#1c160d' : '#a8854a',
  border: 'none', borderRadius: 12, color: disabled ? '#5a5448' : '#0a0a0a',
  cursor: disabled ? 'not-allowed' : 'pointer',
  padding: '0 24px', fontWeight: 600,
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
});
const errBanner: React.CSSProperties = {
  maxWidth: 880, margin: '0 auto 14px', padding: '8px 12px',
  background: '#2a1614', border: '1px solid #5a2825', borderRadius: 8,
  color: '#f5b1ad', fontSize: 12, display: 'flex', justifyContent: 'space-between',
};
const errClose: React.CSSProperties = { background: 'transparent', border: 'none', color: '#f5b1ad', cursor: 'pointer', fontSize: 16 };

const briefWrap: React.CSSProperties = {
  maxWidth: 880, margin: '20px auto 24px', padding: 22,
  background: 'linear-gradient(180deg, #0f0d0a 0%, #100c08 100%)',
  border: '1px solid #2a261d', borderRadius: 14,
};
const signalEyebrow: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
  color: '#a8854a', marginBottom: 8,
};
const signalLine: React.CSSProperties = {
  fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic',
  fontSize: 22, lineHeight: 1.4, color: '#e9e1ce', marginBottom: 8,
};
const signalBody: React.CSSProperties = {
  fontSize: 14, color: '#c9bb96', lineHeight: 1.6, marginBottom: 14,
};
const goodBadGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginTop: 6 };
const goodCard: React.CSSProperties = { background: '#0a1f12', border: '1px solid #1c3526', borderRadius: 10, padding: '12px 14px' };
const badCard:  React.CSSProperties = { background: '#1f0e0c', border: '1px solid #5a2825', borderRadius: 10, padding: '12px 14px' };
const cardEyebrow = (kind: 'good' | 'bad'): React.CSSProperties => ({
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase',
  color: kind === 'good' ? '#7c9a6b' : '#f5b1ad', marginBottom: 8,
});
const listReset: React.CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 };
const listItem  = (dot: string): React.CSSProperties => ({
  fontSize: 13, color: '#d8cca8', lineHeight: 1.5,
  paddingLeft: 16, position: 'relative',
  textShadow: 'none',
  borderLeft: `2px solid ${dot}`,
  paddingTop: 2, paddingBottom: 2, marginLeft: 0,
});

const proposalGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 };
const proposalCard = (inProcess: boolean): React.CSSProperties => ({
  background: '#15110b',
  border: `1px solid ${inProcess ? '#a8854a' : '#2a261d'}`,
  borderRadius: 10, padding: '12px 14px',
  display: 'flex', flexDirection: 'column', gap: 6,
});
const proposalAgent: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
  display: 'flex', gap: 6,
};
const proposalSignal: React.CSSProperties = { fontSize: 14, color: '#e9e1ce', lineHeight: 1.4, fontWeight: 500 };
const proposalBody:   React.CSSProperties = { fontSize: 12, color: '#9b907a', lineHeight: 1.5 };
const proposalCta:    React.CSSProperties = { display: 'flex', gap: 6, marginTop: 6 };
const ctaBtn = (primary: boolean): React.CSSProperties => ({
  background: primary ? '#a8854a' : 'transparent',
  border: `1px solid ${primary ? '#a8854a' : '#3a3327'}`,
  color: primary ? '#0a0a0a' : '#9b907a',
  borderRadius: 8, padding: '5px 12px',
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: primary ? 600 : 500,
  cursor: 'pointer',
});
const smallCta = (primary: boolean): React.CSSProperties => ({
  background: primary ? '#1c160d' : 'transparent',
  border: '1px solid #2a261d',
  color: primary ? '#a8854a' : '#7d7565',
  borderRadius: 6, padding: '3px 8px',
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase',
  cursor: 'pointer',
});

const lanesWrap: React.CSSProperties = { maxWidth: 1200, margin: '32px auto 0' };
const lanesGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 };
const rejectChip: React.CSSProperties = {
  background: '#1f0e0c', border: '1px solid #3a1a18', color: '#9b907a',
  fontSize: 11, padding: '4px 10px', borderRadius: 999,
};

const trustWrap: React.CSSProperties = { maxWidth: 1200, margin: '32px auto 0' };
const trustPill = (unlocked: boolean): React.CSSProperties => ({
  background: unlocked ? '#0a1f12' : '#15110b',
  border: `1px solid ${unlocked ? '#1c3526' : '#2a261d'}`,
  borderRadius: 999, padding: '4px 12px',
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontSize: 10, color: '#d8cca8',
  display: 'flex', gap: 8, alignItems: 'center',
});
