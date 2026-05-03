'use client';
// The composer screen — block list (left) + live email preview (right) + tabs to email editor.
// Uses canonical .panel + KpiBox + StatusPill. All format via lib/format.

import { useState, useEffect, useCallback } from 'react';
import RoomPickerDrawer from './RoomPickerDrawer';
import ActivityCatalogDrawer from './ActivityCatalogDrawer';
import EmailEditor from './EmailEditor';
import StatusPill, { type StatusTone } from '@/components/ui/StatusPill';
import { fmtTableUsd, fmtIsoDate, FX_LAK_PER_USD } from '@/lib/format';
import type { ProposalBlock } from '@/lib/sales';

interface Props {
  proposalId: string;
  initialBlocks: ProposalBlock[];
  initialEmail: any | null;
  proposal: { guest_name: string; date_in: string; date_out: string; status: string; public_token: string | null; };
}

type Tab = 'blocks' | 'email';

const STATUS_TONE: Record<string, { tone: StatusTone; label: string }> = {
  draft:    { tone: 'inactive', label: 'Draft' },
  approved: { tone: 'pending',  label: 'Approved' },
  sent:     { tone: 'info',     label: 'Sent' },
  viewed:   { tone: 'info',     label: 'Viewed' },
  signed:   { tone: 'active',   label: 'Signed' },
  won:      { tone: 'active',   label: 'Won' },
  lost:     { tone: 'expired',  label: 'Lost' },
  expired:  { tone: 'expired',  label: 'Expired' },
};

export default function ComposerEditor({ proposalId, initialBlocks, initialEmail, proposal }: Props) {
  const [tab, setTab] = useState<Tab>('blocks');
  const [blocks, setBlocks] = useState<ProposalBlock[]>(initialBlocks);
  const [showRooms, setShowRooms] = useState(false);
  const [showActivities, setShowActivities] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [sentToken, setSentToken] = useState<string | null>(proposal.public_token);

  // Pre-send availability gate state.
  // status: 'green' (fresh + buffer) | 'yellow' (tight or stale) | 'red' (sold out / under-qty) | null (loading)
  const [check, setCheck] = useState<{
    status: 'green' | 'yellow' | 'red' | 'no_rooms';
    message: string;
    inventory_freshness_min: number;
    rooms: Array<{ block_id: string; label: string; status: 'green' | 'yellow' | 'red'; message: string; min_avail_in_range: number; qty: number }>;
  } | null>(null);

  const refreshCheck = useCallback(async () => {
    try {
      const r = await fetch(`/api/sales/proposals/${proposalId}/check`, { cache: 'no-store' });
      if (r.ok) setCheck(await r.json());
    } catch { /* swallow */ }
  }, [proposalId]);

  // Run check on mount and after every block change
  useEffect(() => { refreshCheck(); }, [refreshCheck, blocks.length]);

  const totalLak = blocks.reduce((s, b) => s + Number(b.total_lak ?? 0), 0);
  const totalUsd = totalLak / FX_LAK_PER_USD;
  const nights = nightCount(proposal.date_in, proposal.date_out);
  const status = STATUS_TONE[proposal.status] ?? STATUS_TONE.draft;

  async function addBlockToProposal(payload: Partial<ProposalBlock> & { block_type: ProposalBlock['block_type']; label: string; unit_price_lak: number; }) {
    setBusy('add');
    const r = await fetch(`/api/sales/proposals/${proposalId}/blocks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (r.ok) {
      const j = await r.json();
      if (j.block) setBlocks(b => [...b, j.block]);
    }
    setBusy(null);
  }

  async function patchBlock(id: string, patch: Partial<ProposalBlock>) {
    setBusy(id);
    setBlocks(b => b.map(x => x.id === id ? {
      ...x, ...patch,
      total_lak: (patch.qty ?? x.qty) * (patch.nights ?? x.nights) * (patch.unit_price_lak ?? x.unit_price_lak),
    } : x));
    await fetch(`/api/sales/proposals/${proposalId}/blocks`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ block_id: id, ...patch }),
    });
    setBusy(null);
  }

  async function removeBlock(id: string) {
    setBusy(id);
    setBlocks(b => b.filter(x => x.id !== id));
    await fetch(`/api/sales/proposals/${proposalId}/blocks?block_id=${id}`, { method: 'DELETE' });
    setBusy(null);
  }

  async function sendProposal(opts: { force?: boolean } = {}) {
    setBusy('send');
    const url = opts.force
      ? `/api/sales/proposals/${proposalId}/send?force=1`
      : `/api/sales/proposals/${proposalId}/send`;
    const r = await fetch(url, { method: 'POST' });
    const j = await r.json();
    if (r.status === 409) {
      // Refresh check so the banner shows the current state
      if (j.check) setCheck(j.check);
      setBusy(null);
      return;
    }
    if (j.token) {
      setSentToken(j.token);
      // Re-render check (status now sent)
      refreshCheck();
    }
    setBusy(null);
  }

  return (
    <>
      <header style={{
        marginTop: 14,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t-eyebrow" style={{ marginBottom: 2 }}>
            <strong style={{ color: 'var(--ink-soft)' }}>Sales</strong>
            <span style={{ margin: '0 6px', color: 'var(--ink-faint)' }}>›</span>
            Composer · {proposalId.slice(0, 8)}
          </div>
          <h1 style={{
            margin: '4px 0 2px',
            fontFamily: 'var(--serif)', fontWeight: 500,
            fontSize: 'var(--t-2xl)',
            letterSpacing: 'var(--ls-tight)',
            lineHeight: 1.1,
            fontVariationSettings: '"opsz" 144',
          }}>
            {proposal.guest_name} <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>· stay</em>
          </h1>
          <div style={{ fontSize: 'var(--t-base)', color: 'var(--ink-soft)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
            {fmtIsoDate(proposal.date_in)} → {fmtIsoDate(proposal.date_out)} · {nights} {nights === 1 ? 'night' : 'nights'}
            <StatusPill tone={status.tone}>{status.label}</StatusPill>
            {sentToken && (
              <a href={`/p/${sentToken}`} target="_blank" rel="noopener" style={{ color: 'var(--brass)', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-loose)', textTransform: 'uppercase' }}>
                Open public link →
              </a>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setTab('blocks')} className={`btn${tab === 'blocks' ? ' btn-primary' : ''}`}>1 · Blocks</button>
          <button onClick={() => setTab('email')} className={`btn${tab === 'email' ? ' btn-primary' : ''}`}>2 · Email</button>
          <button
            onClick={() => sendProposal()}
            disabled={busy === 'send' || blocks.length === 0 || check?.status === 'red'}
            className="btn btn-primary"
            title={check?.status === 'red' ? 'Send blocked — fix availability first' : undefined}
          >
            {busy === 'send' ? 'Sending…' : sentToken ? 'Re-send →' : 'Send to guest →'}
          </button>
        </div>
      </header>

      {check && check.status !== 'no_rooms' && (
        <div className={`avail-banner avail-${check.status}`}>
          <div className="avail-banner-head">
            <span className="avail-banner-icon">
              {check.status === 'green' ? '●' : check.status === 'yellow' ? '◐' : '⚠'}
            </span>
            <strong>
              {check.status === 'green' ? 'Rooms available'
                : check.status === 'yellow' ? 'Tight or stale'
                : 'Send blocked — rooms unavailable'}
            </strong>
            <span className="avail-banner-msg">{check.message}</span>
            {check.status === 'red' && (
              <button onClick={() => sendProposal({ force: true })} disabled={busy === 'send'} className="btn">
                Force-send anyway
              </button>
            )}
            <button onClick={refreshCheck} className="btn">↻ Re-check</button>
          </div>
          {check.rooms.filter(r => r.status !== 'green').length > 0 && (
            <ul className="avail-banner-list">
              {check.rooms.filter(r => r.status !== 'green').map(r => (
                <li key={r.block_id}>
                  <span className={`avail-room-pill avail-${r.status}`}>{r.label}</span>
                  <span className="avail-room-msg">{r.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'blocks' && (
        <div className="composer-grid">
          <section className="panel">
            <div className="panel-head">
              <span className="panel-head-title">Stay <em>blocks</em></span>
              <span className="panel-head-meta" style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setShowRooms(true)} className="btn">+ Rooms</button>
                <button onClick={() => setShowActivities(true)} className="btn">+ Activities</button>
              </span>
            </div>

            {blocks.length === 0 && (
              <p style={{ color: 'var(--ink-mute)', fontSize: 'var(--t-md)', padding: '32px 0', textAlign: 'center' }}>
                No blocks yet. Use the buttons above to add rooms and activities.
              </p>
            )}

            {blocks.map(b => (
              <div key={b.id} className="composer-block-row">
                <div className="composer-block-label">
                  {b.label}
                  <div className="composer-block-meta">
                    {b.block_type}{b.note ? ` · ${b.note}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="number" min={0} value={b.qty}
                    onChange={e => patchBlock(b.id, { qty: Math.max(0, parseInt(e.target.value || '0', 10)) })}
                    className="composer-num-input" />
                  <span style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>×</span>
                  <input type="number" min={1} value={b.nights}
                    onChange={e => patchBlock(b.id, { nights: Math.max(1, parseInt(e.target.value || '1', 10)) })}
                    className="composer-num-input" />
                  <span style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>nt @</span>
                  <input type="number" min={0} step={1000} value={b.unit_price_lak}
                    onChange={e => patchBlock(b.id, { unit_price_lak: parseFloat(e.target.value || '0') })}
                    className="composer-num-input" style={{ width: 90 }} />
                  <span style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>₭</span>
                </div>
                <div style={{ minWidth: 80, textAlign: 'right', fontWeight: 500, fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)' }}>
                  {fmtTableUsd(Number(b.total_lak) / FX_LAK_PER_USD)}
                </div>
                <button onClick={() => removeBlock(b.id)} disabled={busy === b.id} className="btn"
                  style={{ color: 'var(--st-bad)', padding: '4px 8px' }}>×</button>
              </div>
            ))}

            <div className="composer-total-row">
              <span className="composer-total-label">Total</span>
              <span className="composer-total-value">{fmtTableUsd(totalUsd)}</span>
            </div>
          </section>

          <aside className="panel" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
            <div className="panel-head">
              <span className="panel-head-title" style={{ color: 'var(--paper-deep)' }}>
                Live <em>preview</em>
              </span>
            </div>
            <h2 style={{
              fontFamily: 'var(--serif)', fontStyle: 'italic',
              fontSize: 'var(--t-xl)',
              margin: '8px 0 14px',
              color: 'var(--paper)',
              fontVariationSettings: '"opsz" 144',
            }}>
              {proposal.guest_name} · {fmtIsoDate(proposal.date_in)} → {fmtIsoDate(proposal.date_out)}
            </h2>
            {blocks.length === 0 && <p style={{ color: 'var(--ink-faint)', fontSize: 'var(--t-sm)' }}>Add blocks to see the preview.</p>}
            {blocks.map(b => (
              <div key={b.id} style={{
                marginBottom: 10,
                paddingBottom: 10,
                borderBottom: '1px solid rgba(216,204,168,0.15)',
              }}>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-md)', color: 'var(--paper)' }}>{b.label}</div>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                  color: 'var(--paper-deep)',
                  letterSpacing: 'var(--ls-loose)',
                  textTransform: 'uppercase',
                  marginTop: 2,
                }}>
                  {b.qty} × {b.nights} {b.nights === 1 ? 'night' : 'nights'} · {fmtTableUsd(Number(b.total_lak) / FX_LAK_PER_USD)}
                </div>
              </div>
            ))}
            {blocks.length > 0 && (
              <div style={{
                marginTop: 18, paddingTop: 14,
                borderTop: '2px solid var(--moss)',
              }}>
                <div className="t-eyebrow" style={{ color: 'var(--paper-deep)' }}>Total</div>
                <div style={{
                  fontFamily: 'var(--serif)', fontStyle: 'italic',
                  fontSize: 'var(--t-2xl)',
                  color: 'var(--brass)',
                  fontVariationSettings: '"opsz" 144',
                }}>
                  {fmtTableUsd(totalUsd)}
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {tab === 'email' && (
        <EmailEditor proposalId={proposalId} initialEmail={initialEmail} blocks={blocks} totalUsd={totalUsd} proposal={proposal} />
      )}

      <RoomPickerDrawer
        open={showRooms}
        onClose={() => setShowRooms(false)}
        fromDate={proposal.date_in}
        toDate={proposal.date_out}
        onPick={(room) => {
          addBlockToProposal({
            block_type: 'room',
            ref_table: 'public.room_types',
            ref_id: String(room.room_type_id),
            label: room.room_type_name,
            unit_price_lak: Number(room.avg_nightly_lak),
            qty: 1,
            nights: nights,
            sort_order: 10,
          });
          setShowRooms(false);
        }}
      />

      <ActivityCatalogDrawer
        open={showActivities}
        onClose={() => setShowActivities(false)}
        onPick={(activity) => {
          addBlockToProposal({
            block_type: 'activity',
            ref_table: 'sales.activity_catalog',
            ref_id: activity.id,
            label: activity.title,
            note: activity.short_summary ?? undefined,
            unit_price_lak: Number(activity.sell_lak),
            qty: 2,
            nights: 1,
            sort_order: 100,
          });
        }}
      />
    </>
  );
}

function nightCount(from: string, to: string): number {
  if (!from || !to) return 1;
  const d1 = new Date(from); const d2 = new Date(to);
  return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000));
}
