'use client';
import { useState } from 'react';

const RED = '#B03826'; const HAIR = '#E6DFCC'; const INK_M = '#5A5A5A';
const OK = '#0E7A4B'; const WHITE = '#FFFFFF'; const FOREST = '#084838';
const AMBER = '#B48A3A';

interface IcpProposal {
  key: string; name: string; research_reason: string; description: string;
  icp_type: string; priority: number; color: string;
  target_adr_min: number; target_adr_max: number;
  target_los_min: number; target_los_max: number;
  source_countries: string[]; booking_channels: string[];
  yt_content_tags: string[]; property_use_case: string;
  revenue_potential: string; outreach: string;
}

// ── Delete button ────────────────────────────────────────────────────────────
export function DeleteIcpButton({ icpKey, icpName }: { icpKey: string; icpName: string }) {
  const [step, setStep] = useState<'idle'|'confirm'|'done'|'err'>('idle');
  const [err, setErr] = useState('');

  async function doDelete() {
    setStep('done');
    const res = await fetch('/api/sales/icp', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: icpKey }),
    });
    if (!res.ok) { setErr('failed'); setStep('err'); }
    else window.location.reload();
  }

  if (step === 'done') return <span style={{ fontSize: 10, color: INK_M }}>Removing…</span>;
  if (step === 'err')  return <span style={{ fontSize: 10, color: RED }}>{err}</span>;
  if (step === 'confirm') return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <span style={{ fontSize: 10, color: RED }}>Remove {icpName.slice(0,18)}?</span>
      <button onClick={() => setStep('idle')} style={{ fontSize: 9, padding: '1px 5px', border: '1px solid '+HAIR, borderRadius: 2, cursor: 'pointer', background: WHITE, color: INK_M }}>No</button>
      <button onClick={doDelete} style={{ fontSize: 9, padding: '1px 5px', border: '1px solid '+RED, borderRadius: 2, cursor: 'pointer', background: RED, color: WHITE, fontWeight: 600 }}>Yes</button>
    </div>
  );
  return (
    <button onClick={() => setStep('confirm')} style={{ fontSize: 9, padding: '2px 8px', border: '1px solid '+HAIR, borderRadius: 2, background: WHITE, cursor: 'pointer', color: RED }}>🗑 Remove</button>
  );
}

// ── AI Propose Panel ─────────────────────────────────────────────────────────
export function ProposeIcpPanel() {
  const [state, setState] = useState<'idle'|'loading'|'done'|'err'>('idle');
  const [proposals, setProposals] = useState<IcpProposal[]>([]);
  const [adding, setAdding] = useState<Record<string,boolean>>({});
  const [added, setAdded] = useState<Record<string,boolean>>({});
  const [err, setErr] = useState('');

  async function runPropose() {
    setState('loading');
    const res = await fetch('/api/sales/icp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'propose' }),
    });
    const j = await res.json();
    if (j.ok && Array.isArray(j.proposals)) { setProposals(j.proposals); setState('done'); }
    else { setErr(j.error ?? 'failed'); setState('err'); }
  }

  async function acceptProposal(p: IcpProposal) {
    setAdding(a => ({ ...a, [p.key]: true }));
    const res = await fetch('/api/sales/icp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...p }),
    });
    const j = await res.json();
    if (j.ok) { setAdded(a => ({ ...a, [p.key]: true })); }
    setAdding(a => ({ ...a, [p.key]: false }));
  }

  return (
    <div style={{ background: WHITE, border: '1px solid '+HAIR, borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ background: FOREST, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: WHITE }}>AI · ICP Research Loop</div>
          <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>Analyzes unmatched bookings · cross-references Namkhan positioning · proposes new ICPs with evidence</div>
        </div>
        {state !== 'loading' && (
          <button onClick={runPropose} style={{ fontSize: 12, padding: '8px 16px', background: AMBER, color: WHITE, border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}>
            {state === 'done' ? '↺ Re-run Research' : '▶ Run Research Loop'}
          </button>
        )}
        {state === 'loading' && <span style={{ fontSize: 12, color: AMBER }}>Researching… 30-60s</span>}
      </div>

      {state === 'err' && <div style={{ padding: 16, fontSize: 12, color: RED }}>{err}</div>}

      {state === 'done' && proposals.length === 0 && (
        <div style={{ padding: 20, fontSize: 12, color: INK_M }}>No new ICP proposals — existing ICPs cover all meaningful clusters.</div>
      )}

      {state === 'done' && proposals.length > 0 && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {proposals.map(p => (
            <div key={p.key} style={{ border: '1px solid '+HAIR, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ background: p.color || FOREST, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: WHITE }}>{p.name}</div>
                <span style={{ fontSize: 9, padding: '1px 6px', background: 'rgba(255,255,255,.2)', color: WHITE, borderRadius: 2 }}>{p.icp_type.toUpperCase()}</span>
              </div>
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: FOREST }}>Research reason</div>
                <div style={{ fontSize: 11, color: '#1B1B1B', lineHeight: 1.6 }}>{p.research_reason}</div>
                <div style={{ fontSize: 11, color: INK_M, lineHeight: 1.5 }}>{p.description}</div>
                {p.revenue_potential && (
                  <div style={{ fontSize: 10, padding: '4px 8px', background: '#E8F5E9', borderRadius: 3, color: OK, fontWeight: 600 }}>💰 {p.revenue_potential}</div>
                )}
                {p.outreach && (
                  <div style={{ fontSize: 10, padding: '4px 8px', background: '#FFF8E6', borderRadius: 3, color: AMBER }}>📡 {p.outreach}</div>
                )}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 9, padding: '1px 6px', background: '#F5F0E1', borderRadius: 10 }}>ADR ${p.target_adr_min}–${p.target_adr_max}</span>
                  <span style={{ fontSize: 9, padding: '1px 6px', background: '#F5F0E1', borderRadius: 10 }}>LOS {p.target_los_min}–{p.target_los_max}n</span>
                  <span style={{ fontSize: 9, padding: '1px 6px', background: '#F5F0E1', borderRadius: 10 }}>{(p.source_countries||[]).join(' · ')}</span>
                </div>
                <div style={{ marginTop: 4 }}>
                  {added[p.key] ? (
                    <span style={{ fontSize: 11, color: OK, fontWeight: 700 }}>✓ Added to ICPs — refresh page</span>
                  ) : (
                    <button onClick={() => acceptProposal(p)} disabled={adding[p.key]}
                      style={{ fontSize: 11, padding: '6px 14px', background: FOREST, color: WHITE, border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 600 }}>
                      {adding[p.key] ? 'Adding…' : '✓ Accept — Add to ICPs'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
