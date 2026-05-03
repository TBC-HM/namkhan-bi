'use client';
// The /p/[token] page (guest-facing) — hero, day-by-day blocks, qty edit, sign.
// Style is intentionally darker / more presentational than the staff portal:
// gradient hero in moss + ink, paper-warm cards, brass total.

import { useEffect, useState } from 'react';
import { fmtTableUsd, fmtIsoDate, FX_LAK_PER_USD } from '@/lib/format';
import type { ProposalBlock } from '@/lib/sales';

interface Props {
  token: string;
  proposal: { guest_name: string; date_in: string; date_out: string; status: string };
  initialBlocks: ProposalBlock[];
  removedBlocks: ProposalBlock[];
}

export default function PublicProposalClient({ token, proposal, initialBlocks, removedBlocks }: Props) {
  const [blocks, setBlocks] = useState<ProposalBlock[]>(initialBlocks);
  const [removed, setRemoved] = useState<ProposalBlock[]>(removedBlocks);
  const [busy, setBusy] = useState<string | null>(null);
  const [showSign, setShowSign] = useState(false);
  const [signedName, setSignedName] = useState('');
  const [signedEmail, setSignedEmail] = useState('');
  const [signed, setSigned] = useState(proposal.status === 'signed');

  useEffect(() => {
    fetch(`/api/p/${token}/view`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event_type: 'open' }),
    }).catch(() => {});
  }, [token]);

  const total = blocks.reduce((s, b) => s + Number(b.total_lak ?? 0), 0);
  const totalUsd = total / FX_LAK_PER_USD;

  async function changeQty(b: ProposalBlock, qty: number) {
    setBusy(b.id);
    const newQty = Math.max(0, qty);
    if (newQty === 0) {
      setBlocks(arr => arr.filter(x => x.id !== b.id));
      setRemoved(arr => [...arr, { ...b, qty: 0 }]);
    } else {
      setBlocks(arr => arr.map(x => x.id === b.id ? { ...x, qty: newQty, total_lak: newQty * x.nights * x.unit_price_lak } : x));
    }
    await fetch(`/api/p/${token}/blocks`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ block_id: b.id, qty: newQty, action: newQty === 0 ? 'remove' : 'qty' }),
    });
    setBusy(null);
  }

  async function restoreBlock(b: ProposalBlock) {
    setBusy(b.id);
    const newQty = 1;
    setRemoved(arr => arr.filter(x => x.id !== b.id));
    setBlocks(arr => [...arr, { ...b, qty: newQty, total_lak: newQty * b.nights * b.unit_price_lak }]);
    await fetch(`/api/p/${token}/blocks`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ block_id: b.id, qty: newQty, action: 'restore' }),
    });
    setBusy(null);
  }

  async function sign(e: React.FormEvent) {
    e.preventDefault();
    setBusy('sign');
    const r = await fetch(`/api/p/${token}/sign`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ signed_by_name: signedName, signed_by_email: signedEmail }),
    });
    if (r.ok) { setSigned(true); setShowSign(false); }
    setBusy(null);
  }

  if (signed) {
    return (
      <div className="public-prop-bg">
        <div className="public-prop-done">
          <h1 className="public-prop-done-h1">Done.</h1>
          <p style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-md)', lineHeight: 1.6, marginTop: 14 }}>
            We have you. Sebastian will write tomorrow with the booking confirmation, the boat departure note, and the airport transfer details.
          </p>
          <p style={{ color: 'var(--ink-mute)', fontSize: 'var(--t-xs)', marginTop: 18, fontFamily: 'var(--mono)', letterSpacing: 'var(--ls-loose)', textTransform: 'uppercase' }}>
            The Namkhan, Luang Prabang · {fmtIsoDate(proposal.date_in)} → {fmtIsoDate(proposal.date_out)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="public-prop-bg">
      <header className="public-prop-hero">
        <div className="public-prop-hero-eyebrow">The Namkhan · Luang Prabang</div>
        <h1 className="public-prop-hero-title">{proposal.guest_name}</h1>
        <div className="public-prop-hero-sub">
          {fmtIsoDate(proposal.date_in)} — {fmtIsoDate(proposal.date_out)}
        </div>
      </header>

      <main className="public-prop-main">
        <p style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-md)', lineHeight: 1.65, color: 'var(--ink-soft)' }}>
          Take what you like, leave what you don't. Tap the minus to remove anything that doesn't fit.
          The page updates the total as you go.
        </p>

        <div style={{ marginTop: 24 }}>
          {blocks.map(b => (
            <article key={b.id} className="public-prop-block">
              <div style={{ flex: 1 }}>
                <div className="public-prop-block-title">{b.label}</div>
                {b.note && <div className="public-prop-block-note">{b.note}</div>}
                <div className="composer-block-meta" style={{ marginTop: 4 }}>
                  {b.qty} × {b.nights} {b.nights === 1 ? 'night' : 'nights'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => changeQty(b, b.qty - 1)} disabled={busy === b.id} className="public-prop-qty-btn">−</button>
                <span style={{ minWidth: 22, textAlign: 'center', fontFamily: 'var(--mono)', fontWeight: 500 }}>{b.qty}</span>
                <button onClick={() => changeQty(b, b.qty + 1)} disabled={busy === b.id} className="public-prop-qty-btn">+</button>
              </div>
              <div style={{
                minWidth: 72, textAlign: 'right',
                fontFamily: 'var(--mono)', fontSize: 'var(--t-md)',
                fontWeight: 600, color: 'var(--brass)',
              }}>
                {fmtTableUsd(Number(b.total_lak) / FX_LAK_PER_USD)}
              </div>
            </article>
          ))}
        </div>

        {removed.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div className="t-eyebrow" style={{ marginBottom: 6 }}>Removed</div>
            {removed.map(b => (
              <article key={b.id} className="public-prop-removed">
                <div style={{ flex: 1, fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>{b.label}</div>
                <button onClick={() => restoreBlock(b)} disabled={busy === b.id} className="btn">Put it back</button>
              </article>
            ))}
          </div>
        )}

        <div className="composer-total-row">
          <span className="composer-total-label" style={{ fontSize: 'var(--t-md)' }}>Total</span>
          <span className="composer-total-value" style={{ fontSize: 'var(--t-3xl)' }}>{fmtTableUsd(totalUsd)}</span>
        </div>

        {!showSign ? (
          <button onClick={() => setShowSign(true)} disabled={blocks.length === 0} className="public-prop-cta">
            Yes, this is right →
          </button>
        ) : (
          <form onSubmit={sign} className="public-prop-sign-form">
            <div style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-md)', marginBottom: 10 }}>
              Type your name and we'll book it.
            </div>
            <input required value={signedName} onChange={e => setSignedName(e.target.value)} placeholder="Full name" className="proposal-input" style={{ marginBottom: 8, width: '100%' }} />
            <input required type="email" value={signedEmail} onChange={e => setSignedEmail(e.target.value)} placeholder="Email" className="proposal-input" style={{ marginBottom: 8, width: '100%' }} />
            <button type="submit" disabled={busy === 'sign'} className="public-prop-cta">
              {busy === 'sign' ? 'Confirming…' : 'Confirm booking'}
            </button>
            <button type="button" onClick={() => setShowSign(false)} className="btn" style={{ display: 'block', margin: '12px auto 0' }}>Cancel</button>
          </form>
        )}

        <p style={{
          marginTop: 32,
          fontSize: 'var(--t-xs)',
          color: 'var(--ink-mute)',
          textAlign: 'center',
          lineHeight: 1.5,
          fontFamily: 'var(--mono)',
          letterSpacing: 'var(--ls-loose)',
          textTransform: 'uppercase',
        }}>
          The Namkhan, Luang Prabang · sebastian@thenamkhan.com<br />
          This page is private to you. Activities subject to availability at confirmation.
        </p>
      </main>
    </div>
  );
}
