'use client';
// app/guest/newsletters/[campaign_id]/_components/RefineNewsletterButton.tsx
// PBS 2026-07-21 pm: "Refine with AI" for a whole newsletter campaign body.
// Hits unified endpoint /api/marketing/email/refine-block with kind='newsletter_campaign'.
// On accept, calls onAccept(subject, body_md) so CampaignEditor updates local state
// (PBS still hits "Save changes" to persist — same UX as regular editing).

import { useState } from 'react';

interface Props {
  campaignId: string;
  currentSubject?: string | null;
  currentBodyMd?: string | null;
  onAccept: (subject: string | null, bodyMd: string | null) => void;
}

type CampaignProposal = {
  campaign_id: string;
  subject: string | null;
  body_md: string | null;
};

const HAIR = '#E6DFCC'; const INK = '#1B1B1B'; const INK_M = '#5A5A5A';
const GREEN = '#084838'; const RED = '#B03826'; const CREAM = '#F7F0E1';

export default function RefineNewsletterButton(props: Props) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<CampaignProposal | null>(null);
  const [violations, setViolations] = useState<Record<string, string[]>>({});

  async function submit() {
    if (!instruction.trim()) return;
    setLoading(true); setError(null); setProposal(null);
    try {
      const res = await fetch('/api/marketing/email/refine-block', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'newsletter_campaign',
          id: props.campaignId,
          instruction: instruction.trim(),
        }),
      });
      const j = await res.json();
      if (!j?.ok) throw new Error(j?.error ?? `HTTP ${res.status}`);
      setProposal(j.proposal as CampaignProposal);
      setViolations(j.violations ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }

  function accept() {
    if (!proposal) return;
    props.onAccept(proposal.subject ?? null, proposal.body_md ?? null);
    setOpen(false); setProposal(null); setInstruction(''); setViolations({});
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(v => !v)} style={{
        padding: '4px 10px', fontSize: 10, fontWeight: 600,
        background: '#FFFFFF', color: GREEN, border: '1px solid ' + HAIR, borderRadius: 3, cursor: 'pointer',
      }}>✨ Refine with AI</button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300 }} />
          <div style={{
            position: 'fixed', top: '10vh', left: '50%', transform: 'translateX(-50%)',
            width: 'min(720px, 92vw)', maxHeight: '80vh', overflow: 'auto',
            background: '#FFFFFF', border: '1px solid ' + HAIR, borderRadius: 6,
            boxShadow: '0 12px 40px rgba(0,0,0,0.28)', zIndex: 301, padding: 16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>Refine newsletter</div>
              <button type="button" onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', fontSize: 22, color: INK_M, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ fontSize: 11, color: INK_M, marginBottom: 6 }}>
              Same guardrails as sequences (marketing.email_general_rules) — no divergence.
            </div>

            <label style={{ fontSize: 11, color: INK_M, display: 'block', marginBottom: 4 }}>What do you want to change?</label>
            <input
              type="text" value={instruction} onChange={e => setInstruction(e.target.value)}
              placeholder="e.g. shorter, more sensory; swap hero for a food photo; punch up the CTA"
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

            {Object.keys(violations).length > 0 && (
              <div style={{ marginTop: 10, padding: 8, fontSize: 11, background: '#FFF3F0', border: '1px solid ' + RED, borderRadius: 4, color: RED }}>
                <strong>URL guardrail violations (SAVE will be rejected until fixed):</strong>
                {Object.entries(violations).map(([k, arr]) => (
                  <div key={k} style={{ marginTop: 4 }}>
                    <div style={{ fontWeight: 600 }}>{k}</div>
                    <ul style={{ margin: '2px 0 0 18px', padding: 0 }}>{arr.map((v, i) => <li key={i}>{v}</li>)}</ul>
                  </div>
                ))}
              </div>
            )}

            {proposal && (
              <div style={{ marginTop: 14, borderTop: '1px solid ' + HAIR, paddingTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M, marginBottom: 8 }}>Proposal</div>
                <div style={{ background: CREAM, border: '1px solid ' + HAIR, borderRadius: 4, padding: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: INK, marginBottom: 4 }}>{proposal.subject ?? '(no subject)'}</div>
                  <pre style={{ margin: 0, fontSize: 11, whiteSpace: 'pre-wrap', color: INK, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', maxHeight: 300, overflow: 'auto' }}>{proposal.body_md ?? ''}</pre>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button type="button" onClick={accept} style={{
                    padding: '6px 14px', fontSize: 12, fontWeight: 600,
                    background: GREEN, color: '#FFFFFF', border: 'none', borderRadius: 4, cursor: 'pointer',
                  }}>Accept (updates editor · click Save to persist)</button>
                  <button type="button" onClick={() => setProposal(null)} style={{
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
