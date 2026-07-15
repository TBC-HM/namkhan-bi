'use client';
// The composer screen — block list (left) + live email preview (right) + tabs to email editor.
// Uses canonical .panel + KpiBox + StatusPill. All format via lib/format.

import { useState, useEffect, useCallback } from 'react';
import RoomPickerDrawer from './RoomPickerDrawer';
import ActivityCatalogDrawer from './ActivityCatalogDrawer';
import PhotoPickerDrawer, { type BlockContext, type PhotoRow } from './PhotoPickerDrawer';
import EmailEditor from './EmailEditor';
import StatusPill, { type StatusTone } from '@/components/ui/StatusPill';
import { fmtTableUsd, fmtIsoDate, FX_LAK_PER_USD } from '@/lib/format';
import type { ProposalBlock } from '@/lib/sales';

// Namkhan is the only property currently using the composer.
// Prior sub-agents hard-coded 260955 in cfl_route; keep the same anchor here.
const PROPERTY_ID = 260955;

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
  const [photoPickerFor, setPhotoPickerFor] = useState<{ block: ProposalBlock } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [sentToken, setSentToken] = useState<string | null>(proposal.public_token);
  const [showEmailPreview, setShowEmailPreview] = useState(false);

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

  async function fillFromSettings(b: ProposalBlock) {
    setBusy(b.id);
    try {
      const r = await fetch(`/api/sales/proposals/${proposalId}/blocks/fill`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ block_id: b.id, block_type: b.block_type, ref_id: b.ref_id }),
      });
      if (r.ok) {
        const j = await r.json();
        setBlocks(prev => prev.map(x => x.id === b.id ? {
          ...x,
          label: (j.patch?.label as string) ?? x.label,
          note:  (j.patch?.note  as string) ?? x.note,
          hero_asset_id: (j.hero_asset_id as string) ?? x.hero_asset_id,
        } : x));
      }
    } catch { /* swallow */ }
    setBusy(null);
  }

  function pickPhotoFor(b: ProposalBlock) { setPhotoPickerFor({ block: b }); }

  async function attachPhoto(blockId: string, asset: PhotoRow) {
    setBusy(blockId);
    setBlocks(prev => prev.map(x => x.id === blockId ? { ...x, hero_asset_id: asset.asset_id } : x));
    await fetch(`/api/sales/proposals/${proposalId}/blocks`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ block_id: blockId, hero_asset_id: asset.asset_id }),
    });
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
          <div className="t-eyebrow" style={{ marginBottom: 2, color: '#5A5A5A' }}>
            <strong style={{ color: '#5A5A5A' }}>Sales</strong>
            <span style={{ margin: '0 6px', color: '#8A8A8A' }}>›</span>
            Composer · {proposalId.slice(0, 8)}
          </div>
          <h1 style={{
            margin: '4px 0 2px',
            fontFamily: 'var(--serif)', fontWeight: 500,
            fontSize: 'var(--t-2xl)',
            letterSpacing: 'var(--ls-tight)',
            lineHeight: 1.1,
            fontVariationSettings: '"opsz" 144',
            color: '#1B1B1B',
          }}>
            {proposal.guest_name} <em style={{ color: '#084838', fontStyle: 'italic' }}>· stay</em>
          </h1>
          <div style={{ fontSize: 'var(--t-base)', color: '#5A5A5A', marginTop: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
            {fmtIsoDate(proposal.date_in)} → {fmtIsoDate(proposal.date_out)} · {nights} {nights === 1 ? 'night' : 'nights'}
            <StatusPill tone={status.tone}>{status.label}</StatusPill>
            {sentToken && (
              <a href={`/p/${sentToken}`} target="_blank" rel="noopener" style={{ color: '#084838', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-loose)', textTransform: 'uppercase' }}>
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
          <section className="panel" style={{ background: '#FFFFFF', color: '#1B1B1B', border: '1px solid #E6DFCC' }}>
            <div className="panel-head">
              <span className="panel-head-title" style={{ color: '#1B1B1B' }}>Stay <em style={{ color: '#084838' }}>blocks</em></span>
              <span className="panel-head-meta" style={{ display: 'flex', gap: 6, color: '#5A5A5A' }}>
                <button onClick={() => setShowRooms(true)} className="btn">+ Rooms</button>
                <button onClick={() => setShowActivities(true)} className="btn">+ Activities</button>
              </span>
            </div>

            {blocks.length === 0 && (
              <p style={{ color: '#8A8A8A', fontSize: 'var(--t-md)', padding: '32px 0', textAlign: 'center' }}>
                No blocks yet. Use the buttons above to add rooms and activities.
              </p>
            )}

            {blocks.map(b => (
              <div key={b.id} style={{ borderBottom: '1px solid #E6DFCC', padding: '10px 0' }}>
                <div className="composer-block-row">
                  <div className="composer-block-label" style={{ color: '#1B1B1B', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    {b.hero_asset_id && (
                      // Hero thumbnail (48px). Uses /api/marketing/media/preview (v5 download-through).
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/marketing/media/preview?asset_id=${b.hero_asset_id}`}
                        alt=""
                        style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4, border: '1px solid #E6DFCC', flexShrink: 0 }}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div>{b.label}</div>
                      <div className="composer-block-meta" style={{ color: '#8A8A8A' }}>
                        {b.block_type}{b.note ? ` · ${b.note}` : ''}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input type="number" min={0} value={b.qty}
                      onChange={e => patchBlock(b.id, { qty: Math.max(0, parseInt(e.target.value || '0', 10)) })}
                      className="composer-num-input"
                      style={{ background: '#FAFAF7', color: '#1B1B1B', border: '1px solid #E6DFCC' }} />
                    <span style={{ fontSize: 'var(--t-xs)', color: '#8A8A8A' }}>×</span>
                    <input type="number" min={1} value={b.nights}
                      onChange={e => patchBlock(b.id, { nights: Math.max(1, parseInt(e.target.value || '1', 10)) })}
                      className="composer-num-input"
                      style={{ background: '#FAFAF7', color: '#1B1B1B', border: '1px solid #E6DFCC' }} />
                    <span style={{ fontSize: 'var(--t-xs)', color: '#8A8A8A' }}>nt @</span>
                    <input type="number" min={0} step={1000} value={b.unit_price_lak}
                      onChange={e => patchBlock(b.id, { unit_price_lak: parseFloat(e.target.value || '0') })}
                      className="composer-num-input" style={{ width: 90, background: '#FAFAF7', color: '#1B1B1B', border: '1px solid #E6DFCC' }} />
                    <span style={{ fontSize: 'var(--t-xs)', color: '#8A8A8A' }}>₭</span>
                  </div>
                  <div style={{ minWidth: 80, textAlign: 'right', fontWeight: 500, fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)', color: '#1B1B1B' }}>
                    {fmtTableUsd(Number(b.total_lak) / FX_LAK_PER_USD)}
                  </div>
                  <button onClick={() => removeBlock(b.id)} disabled={busy === b.id} className="btn"
                    style={{ color: '#B04A2F', padding: '4px 8px' }}>×</button>
                </div>
                {/* Per-block content actions — photo picker + fill-from-settings.
                    Placed under the row so they don't compete with qty/nights inputs
                    but stay adjacent to the block they act on. */}
                <div style={{ display: 'flex', gap: 6, marginTop: 6, marginLeft: b.hero_asset_id ? 58 : 0, fontSize: 'var(--t-xs)' }}>
                  <button onClick={() => pickPhotoFor(b)} disabled={busy === b.id} className="btn" style={{ padding: '3px 8px', fontSize: 11 }}>
                    {b.hero_asset_id ? 'Change photo' : 'Choose photo'}
                  </button>
                  <button onClick={() => fillFromSettings(b)} disabled={busy === b.id} className="btn" style={{ padding: '3px 8px', fontSize: 11 }}>
                    {busy === b.id ? 'Filling…' : 'Fill from Property Settings'}
                  </button>
                </div>
              </div>
            ))}

            <div className="composer-total-row" style={{ borderTop: '2px solid #084838' }}>
              <span className="composer-total-label" style={{ color: '#8A8A8A' }}>Total</span>
              <span className="composer-total-value" style={{ color: '#084838' }}>{fmtTableUsd(totalUsd)}</span>
            </div>
          </section>

          <aside className="panel" style={{ background: '#FFFFFF', color: '#1B1B1B', border: '1px solid #E6DFCC' }}>
            <div className="panel-head">
              <span className="panel-head-title" style={{ color: '#1B1B1B' }}>
                Live <em>preview</em>
              </span>
            </div>
            <h2 style={{
              fontFamily: 'var(--serif)', fontStyle: 'italic',
              fontSize: 'var(--t-xl)',
              margin: '8px 0 14px',
              color: '#1B1B1B',
              fontVariationSettings: '"opsz" 144',
            }}>
              {proposal.guest_name} · {fmtIsoDate(proposal.date_in)} → {fmtIsoDate(proposal.date_out)}
            </h2>
            {blocks.length === 0 && <p style={{ color: '#8A8A8A', fontSize: 'var(--t-sm)' }}>Add blocks to see the preview.</p>}
            {blocks.map(b => (
              <div key={b.id} style={{
                marginBottom: 10,
                paddingBottom: 10,
                borderBottom: '1px solid #E6DFCC',
              }}>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-md)', color: '#1B1B1B' }}>{b.label}</div>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                  color: '#5A5A5A',
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
                borderTop: '2px solid #084838',
              }}>
                <div className="t-eyebrow" style={{ color: '#5A5A5A' }}>Total</div>
                <div style={{
                  fontFamily: 'var(--serif)', fontStyle: 'italic',
                  fontSize: 'var(--t-2xl)',
                  color: '#084838',
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

      <PhotoPickerDrawer
        open={!!photoPickerFor}
        onClose={() => setPhotoPickerFor(null)}
        propertyId={PROPERTY_ID}
        block={photoPickerFor?.block ? ({
          block_type: photoPickerFor.block.block_type as BlockContext['block_type'],
          ref_id: photoPickerFor.block.ref_id ?? null,
          label: photoPickerFor.block.label,
        }) : null}
        currentAssetId={photoPickerFor?.block.hero_asset_id ?? null}
        onPick={(asset) => {
          if (photoPickerFor?.block) attachPhoto(photoPickerFor.block.id, asset);
        }}
      />

      {tab === 'email' && showEmailPreview && (
        // Full-screen newsletter-quality preview iframe. Hits the /email/preview route
        // that renders lib/proposalEmailTemplate.ts — same HTML that goes on the wire.
        <div onClick={() => setShowEmailPreview(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(27,27,27,0.4)', zIndex: 70, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(720px, 96vw)', height: '92vh', background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <header style={{ padding: '10px 14px', borderBottom: '1px solid #E6DFCC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#5A5A5A' }}>Newsletter-quality preview</span>
              <button onClick={() => setShowEmailPreview(false)} className="btn">×</button>
            </header>
            <iframe title="proposal email preview" src={`/api/sales/proposals/${proposalId}/email/preview`} style={{ flex: 1, border: 0, background: '#F5F0E1' }} />
          </div>
        </div>
      )}

      {tab === 'email' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={() => setShowEmailPreview(true)} className="btn">Full-screen newsletter preview →</button>
        </div>
      )}
    </>
  );
}

function nightCount(from: string, to: string): number {
  if (!from || !to) return 1;
  const d1 = new Date(from); const d2 = new Date(to);
  return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000));
}
