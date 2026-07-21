'use client';
// app/marketing/prospects/sequences/[funnel_id]/_components/RefineStepButton.tsx
// PBS 2026-07-21: per-step "Refine with AI" popover (Part D).
// Also handles "Refine ALL" whole-sequence mode when props.mode === 'all'.
// Talks to unified endpoint /api/marketing/email/refine-block.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  mode: 'step' | 'all';
  funnelId: string;
  stepId?: string;
  stepNo?: number | null;
  currentSubject?: string | null;
  currentBodyMd?: string | null;
  currentHeroAssetId?: string | null;
}

type StepProposal = {
  step_id?: string;
  step_no?: number;
  subject?: string | null;
  body_md?: string | null;
  hero_asset_id?: string | null;
  hero_public_url?: string | null;
  click_tag_map?: Record<string, string> | null;
};

const HAIR = '#E6DFCC'; const INK = '#1B1B1B'; const INK_M = '#5A5A5A';
const GREEN = '#084838'; const RED = '#B03826'; const CREAM = '#F7F0E1';

export default function RefineStepButton(props: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<StepProposal | StepProposal[] | null>(null);
  const [applying, setApplying] = useState(false);

  const label = props.mode === 'all' ? '✨ Refine ALL steps' : '✨ Refine with AI';

  async function submit() {
    if (!instruction.trim()) return;
    setLoading(true); setError(null); setProposal(null);
    try {
      const kind = props.mode === 'all' ? 'sequence_all' : 'sequence_step';
      const id = props.mode === 'all' ? props.funnelId : props.stepId;
      if (!id) throw new Error('missing id');
      const res = await fetch('/api/marketing/email/refine-block', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, id, instruction: instruction.trim() }),
      });
      const j = await res.json();
      if (!j?.ok) throw new Error(j?.error ?? `HTTP ${res.status}`);
      setProposal(j.proposal);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }

  async function accept() {
    if (!proposal) return;
    setApplying(true); setError(null);
    try {
      const items: StepProposal[] = Array.isArray(proposal) ? proposal : [proposal];
      const kind = props.mode === 'all' ? 'sequence_all' : 'sequence_step';
      const res = await fetch('/api/marketing/email/refine-block', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, updates: items }),
      });
      const j = await res.json();
      if (!j?.ok) throw new Error(j?.error ?? `HTTP ${res.status}`);
      setOpen(false); setProposal(null); setInstruction('');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setApplying(false); }
  }

  const buttonStyle: React.CSSProperties = {
    padding: props.mode === 'all' ? '6px 14px' : '3px 10px',
    fontSize: props.mode === 'all' ? 12 : 10,
    fontWeight: 600,
    background: '#FFFFFF',
    color: GREEN,
    border: '1px solid ' + HAIR,
    borderRadius: 4,
    cursor: 'pointer',
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(v => !v)} style={buttonStyle}>{label}</button>

      {open && (
        <>
          <div onClick={() => !applying && setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300 }} />
          <div style={{
            position: 'fixed', top: '10vh', left: '50%', transform: 'translateX(-50%)',
            width: 'min(720px, 92vw)', maxHeight: '80vh', overflow: 'auto',
            background: '#FFFFFF', border: '1px solid ' + HAIR, borderRadius: 6,
            boxShadow: '0 12px 40px rgba(0,0,0,0.28)', zIndex: 301, padding: 16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>
                {props.mode === 'all' ? 'Refine ALL steps' : `Refine Step ${props.stepNo}`}
              </div>
              <button type="button" onClick={() => !applying && setOpen(false)} style={{ background: 'none', border: 'none', fontSize: 22, color: INK_M, cursor: 'pointer' }}>×</button>
            </div>

            <label style={{ fontSize: 11, color: INK_M, display: 'block', marginBottom: 4 }}>What do you want to change?</label>
            <input
              type="text" value={instruction} onChange={e => setInstruction(e.target.value)}
              placeholder="e.g. shorter, more sensory; swap hero for a food photo; replace link with /roots"
              style={{ width: '100%', padding: '8px 10px', fontSize: 12, border: '1px solid ' + HAIR, borderRadius: 4, boxSizing: 'border-box' }}
            />

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button type="button" onClick={submit} disabled={loading || !instruction.trim()} style={{
                padding: '6px 14px', fontSize: 12, fontWeight: 600,
                background: loading ? '#8A8A8A' : GREEN, color: '#FFFFFF', border: 'none', borderRadius: 4,
                cursor: loading ? 'default' : 'pointer',
              }}>{loading ? 'Thinking…' : 'Propose changes'}</button>
            </div>

            {error && <div style={{ marginTop: 10, fontSize: 12, color: RED }}>Error: {error}</div>}

            {proposal && (
              <div style={{ marginTop: 14, borderTop: '1px solid ' + HAIR, paddingTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M, marginBottom: 8 }}>Proposal</div>
                {(Array.isArray(proposal) ? proposal : [proposal]).map((p, i) => (
                  <div key={i} style={{ background: CREAM, border: '1px solid ' + HAIR, borderRadius: 4, padding: 10, marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: INK, marginBottom: 4 }}>
                      Step {p.step_no} · {p.subject}
                    </div>
                    {p.hero_public_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.hero_public_url} alt="hero" style={{ maxWidth: 240, height: 'auto', display: 'block', margin: '4px 0', borderRadius: 3 }} />
                    )}
                    <pre style={{ margin: 0, fontSize: 11, whiteSpace: 'pre-wrap', color: INK, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{p.body_md ?? ''}</pre>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button type="button" onClick={accept} disabled={applying} style={{
                    padding: '6px 14px', fontSize: 12, fontWeight: 600,
                    background: applying ? '#8A8A8A' : GREEN, color: '#FFFFFF', border: 'none', borderRadius: 4,
                    cursor: applying ? 'default' : 'pointer',
                  }}>{applying ? 'Applying…' : 'Accept & save'}</button>
                  <button type="button" onClick={() => setProposal(null)} disabled={applying} style={{
                    padding: '6px 14px', fontSize: 12, fontWeight: 600,
                    background: '#FFFFFF', color: RED, border: '1px solid ' + RED, borderRadius: 4, cursor: 'pointer',
                  }}>Reject</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
