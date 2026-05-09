'use client';

// app/page.tsx — THE CANVAS.
// Refactored 2026-05-09 to use the locked design-system shell + primitives.
// Same flow as before: ask → brief → approve → kanban → trust unlocks auto-run.

import { useEffect, useRef, useState } from 'react';
import Page from '@/components/page/Page';
import Brief, { type BriefData } from '@/components/page/Brief';
import Lane from '@/components/page/Lane';
import ProposalCard, { type ProposalLite } from '@/components/page/ProposalCard';

interface Proposal extends ProposalLite {
  dept: string | null;
  requires_approval: boolean;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  evidence: unknown;
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
  const [brief, setBrief] = useState<BriefData | null>(null);
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
    await fetch(`/api/canvas/proposal/${id}/done`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evidence: { mock: true, completed_at: new Date().toISOString() } }),
    });
    void loadLanes();
  }

  return (
    <Page eyebrow="Canvas · the hotel" title="What does the hotel need?">

      {/* COMPOSER */}
      <form onSubmit={(e) => { e.preventDefault(); ask(); }} style={composerWrap}>
        <textarea
          ref={inputRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); ask(); } }}
          placeholder="e.g. how do we play the long weekend? · reply to the latest bad review · re-engage silent B2B partners"
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

      {/* BRIEF */}
      {brief && (
        <Brief
          brief={brief}
          proposalSlot={briefProposals.length > 0 && (
            <>
              <div style={sectionEyebrow}>Proposals</div>
              <div style={proposalGrid}>
                {briefProposals.map((p) => (
                  <ProposalCard
                    key={p.id}
                    p={p}
                    cta={p.status === 'in_process' ? [] : [
                      { label: '⏵ Approve', onClick: () => approve(p.id), primary: true },
                      { label: 'Reject',    onClick: () => reject(p.id) },
                    ]}
                  />
                ))}
              </div>
            </>
          )}
        />
      )}

      {/* LANES */}
      <div style={lanesWrap}>
        <div style={sectionEyebrow}>State</div>
        <div style={lanesGrid}>
          <Lane label="Proposal"   accent="#a8854a" count={lanes.proposal.length}   emptyLabel="ask something to seed">
            {lanes.proposal.map((p) => (
              <ProposalCard key={p.id} p={p} variant="lane" cta={[
                { label: 'Approve', onClick: () => approve(p.id), primary: true },
                { label: 'Reject',  onClick: () => reject(p.id) },
              ]} />
            ))}
          </Lane>
          <Lane label="In process" accent="#c79a6b" count={lanes.in_process.length} emptyLabel="nothing running">
            {lanes.in_process.map((p) => (
              <ProposalCard key={p.id} p={p} variant="lane" cta={[
                { label: 'Mark done', onClick: () => complete(p.id), primary: true },
              ]} />
            ))}
          </Lane>
          <Lane label="Done"       accent="#7c9a6b" count={lanes.done.length}       emptyLabel="nothing shipped yet">
            {lanes.done.map((p) => (
              <ProposalCard key={p.id} p={p} variant="lane" />
            ))}
          </Lane>
        </div>

        {lanes.rejected.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={rejectedEyebrow}>Rejected · last 6</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {lanes.rejected.map((p) => (
                <span key={p.id} style={rejectChip}>{p.signal.slice(0, 60)}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* TRUST METER */}
      {trust.length > 0 && (
        <div style={trustWrap}>
          <div style={{ ...sectionEyebrow, marginBottom: 8 }}>Trust meter · auto-run unlocks</div>
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
    </Page>
  );
}

// ─── styles local to canvas ─────────────────────────────────────────────

const sectionEyebrow: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
  color: '#a8854a', marginBottom: 8,
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

const proposalGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 };

const lanesWrap: React.CSSProperties = { maxWidth: 1200, margin: '32px auto 0' };
const lanesGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 };
const rejectedEyebrow: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#f5b1ad', marginBottom: 6,
};
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
