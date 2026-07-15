'use client';
// Email editor — subject + intro + outro + PS, with AI re-draft + live preview.

import { useState } from 'react';
import { fmtTableUsd, FX_LAK_PER_USD } from '@/lib/format';
import type { ProposalBlock } from '@/lib/sales';

interface Props {
  proposalId: string;
  initialEmail: any | null;
  blocks: ProposalBlock[];
  totalUsd: number;
  proposal: { guest_name: string; date_in: string; date_out: string };
}

export default function EmailEditor({ proposalId, initialEmail, blocks, totalUsd, proposal }: Props) {
  const [subject, setSubject] = useState<string>(initialEmail?.subject ?? `Your stay at The Namkhan, ${proposal.date_in}`);
  const [intro, setIntro] = useState<string>(initialEmail?.intro_md ?? '');
  const [outro, setOutro] = useState<string>(initialEmail?.outro_md ?? '');
  const [ps, setPs] = useState<string>(initialEmail?.ps_md ?? '');
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [aiSource, setAiSource] = useState<string | null>(null);

  async function regenerate() {
    setBusy(true);
    setAiSource(null);
    const r = await fetch(`/api/sales/proposals/${proposalId}/email/regenerate`, { method: 'POST' });
    if (r.ok) {
      const j = await r.json();
      setSubject(j.subject ?? subject);
      setIntro(j.intro_md ?? intro);
      setOutro(j.outro_md ?? outro);
      setPs(j.ps_md ?? ps);
      setAiSource(j.source ?? 'unknown');
    }
    setBusy(false);
  }

  async function save() {
    setBusy(true);
    const r = await fetch(`/api/sales/proposals/${proposalId}/email`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject, intro_md: intro, outro_md: outro, ps_md: ps }),
    });
    if (r.ok) setSavedAt(new Date().toLocaleTimeString());
    setBusy(false);
  }

  return (
    <div className="composer-grid">
      <section className="panel" style={{ background: '#FFFFFF', color: '#1B1B1B', border: '1px solid #E6DFCC' }}>
        <div className="panel-head">
          <span className="panel-head-title" style={{ color: '#1B1B1B' }}>
            Email <em style={{ color: '#084838' }}>copy</em>
          </span>
          <span className="panel-head-meta" style={{ display: 'flex', gap: 6, color: '#5A5A5A' }}>
            <button className="btn" onClick={regenerate} disabled={busy}>
              {busy ? '…' : '↻ Re-draft with AI'}
            </button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              {busy ? '…' : 'Save'}
            </button>
          </span>
        </div>
        {aiSource && (
          <div style={{
            fontSize: 'var(--t-xs)',
            color: aiSource === 'stub' ? '#B04A2F' : '#084838',
            marginBottom: 8,
            fontFamily: 'var(--mono)',
            letterSpacing: 'var(--ls-loose)',
            textTransform: 'uppercase',
          }}>
            AI source: {aiSource}{aiSource === 'stub' ? ' · ANTHROPIC_API_KEY not set, using template' : ''}
          </div>
        )}
        {savedAt && (
          <div style={{
            fontSize: 'var(--t-xs)',
            color: '#084838',
            marginBottom: 8,
            fontFamily: 'var(--mono)',
            letterSpacing: 'var(--ls-loose)',
            textTransform: 'uppercase',
          }}>Saved at {savedAt}</div>
        )}
        <label className="email-editor-label" style={{ color: '#5A5A5A' }}>Subject</label>
        <input className="email-editor-input" value={subject} onChange={e => setSubject(e.target.value)}
          style={{ background: '#FAFAF7', color: '#1B1B1B', border: '1px solid #E6DFCC' }} />
        <label className="email-editor-label" style={{ color: '#5A5A5A' }}>Intro</label>
        <textarea className="email-editor-textarea" value={intro} onChange={e => setIntro(e.target.value)} rows={6}
          style={{ background: '#FAFAF7', color: '#1B1B1B', border: '1px solid #E6DFCC' }} />
        <label className="email-editor-label" style={{ color: '#5A5A5A' }}>Outro</label>
        <textarea className="email-editor-textarea" value={outro} onChange={e => setOutro(e.target.value)} rows={4}
          style={{ background: '#FAFAF7', color: '#1B1B1B', border: '1px solid #E6DFCC' }} />
        <label className="email-editor-label" style={{ color: '#5A5A5A' }}>PS</label>
        <textarea className="email-editor-textarea" value={ps} onChange={e => setPs(e.target.value)} rows={2}
          style={{ background: '#FAFAF7', color: '#1B1B1B', border: '1px solid #E6DFCC' }} />
      </section>

      <aside className="panel" style={{ background: '#FFFFFF', color: '#1B1B1B', border: '1px solid #E6DFCC' }}>
        <div className="panel-head">
          <span className="panel-head-title" style={{ color: '#1B1B1B' }}>
            Live <em style={{ color: '#084838' }}>preview</em>
          </span>
        </div>
        <div style={{ background: '#FAFAF7', color: '#1B1B1B', padding: 18, borderRadius: 4, marginTop: 8, border: '1px solid #E6DFCC' }}>
          <div style={{
            fontSize: 'var(--t-xs)',
            color: '#5A5A5A',
            borderBottom: '1px solid #E6DFCC',
            paddingBottom: 6, marginBottom: 12,
            fontFamily: 'var(--mono)',
            letterSpacing: 'var(--ls-loose)',
          }}>
            From: Sebastian — The Namkhan<br />
            To: {proposal.guest_name}<br />
            Subject: <strong style={{ color: '#1B1B1B' }}>{subject}</strong>
          </div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-md)', lineHeight: 1.65, whiteSpace: 'pre-wrap', color: '#1B1B1B' }}>{intro}</div>
          <div style={{
            margin: '16px 0',
            padding: 14,
            background: '#F5F1E4',
            borderRadius: 4,
            border: '1px solid #E6DFCC',
          }}>
            <div className="t-eyebrow" style={{ color: '#5A5A5A' }}>Your stay</div>
            {blocks.map(b => (
              <div key={b.id} style={{
                padding: '6px 0',
                borderBottom: '1px solid #E6DFCC',
                fontSize: 'var(--t-sm)',
                display: 'flex', justifyContent: 'space-between',
                color: '#1B1B1B',
              }}>
                <span>{b.label} <span style={{ color: '#8A8A8A' }}>· {b.qty} × {b.nights} {b.nights === 1 ? 'nt' : 'nts'}</span></span>
                <strong>{fmtTableUsd(Number(b.total_lak) / FX_LAK_PER_USD)}</strong>
              </div>
            ))}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              marginTop: 10, paddingTop: 10,
              borderTop: '2px solid #084838',
              fontSize: 'var(--t-lg)',
              color: '#1B1B1B',
            }}>
              <strong>Total</strong>
              <strong style={{ color: '#084838' }}>{fmtTableUsd(totalUsd)}</strong>
            </div>
          </div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-md)', lineHeight: 1.65, whiteSpace: 'pre-wrap', color: '#1B1B1B' }}>{outro}</div>
          {ps && (
            <div style={{ marginTop: 12, fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-sm)', color: '#5A5A5A' }}>{ps}</div>
          )}
        </div>
      </aside>
    </div>
  );
}
