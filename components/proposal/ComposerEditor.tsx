'use client';
// The composer screen — unified split-screen editor.
// PBS 2026-07-16 unify pass:
//   item 1  — wizard fields (dates/pax/rooms/rate plan) live at the top of the
//             left pane so a new proposal + an in-flight one land on the SAME page.
//   item 2  — right pane is a real iframe of /email/preview and reloads (cache-buster
//             appended) after any left-pane save.
//   item 4  — "+ Experience" picker sources from content.activities_catalog via a new
//             GET /api/proposals/activities?property_id=... endpoint. Legacy Activity-
//             CatalogDrawer is still available as "+ Activities (advanced)" for the
//             existing sales.activity_catalog set.
//   item 5  — per-block "Add. discount %" input (activities only) writes to a new
//             sales.proposal_blocks.additional_discount_pct column.
//   item 8  — user-facing "Activities" copy → "Experiences" (block_type stays 'activity').

import { useState, useEffect, useCallback, useMemo } from 'react';
import RoomPickerDrawer from './RoomPickerDrawer';
import ActivityCatalogDrawer from './ActivityCatalogDrawer';
import PhotoPickerDrawer, { type BlockContext, type PhotoRow } from './PhotoPickerDrawer';
import EmailEditor from './EmailEditor';
import StatusPill, { type StatusTone } from '@/components/ui/StatusPill';
import { fmtTableUsd, fmtIsoDate, FX_LAK_PER_USD } from '@/lib/format';
import type { ProposalBlock } from '@/lib/sales';

const PAPER = '#FFFFFF';
const HAIRLINE = '#E6DFCC';
const INK = '#1B1B1B';
const INK_SOFT = '#5A5A5A';
const INK_MUTE = '#8A8A8A';
const GREEN = '#084838';
const RED = '#B04A2F';

interface CatalogActivity {
  activity_id: number;
  property_id: number;
  category: string | null;
  name: string;
  description: string | null;
  duration_min: number | null;
  price_amount: number | null;
  price_currency: string | null;
  is_active: boolean;
}

interface RatePlan {
  rate_plan_id: string;
  rate_plan_name: string;
  room_type_id: string;
  room_type_name: string;
  avg_rate_per_night_usd: number;
  total_usd: number;
  total_lak: number;
  nights: number;
  rooms_available_min: number;
  child_policy: string | null;
  cancellation_policy: string | null;
  board: string | null;
}

interface Props {
  proposalId: string;
  propertyId: number;
  initialBlocks: ProposalBlock[];
  initialEmail: any | null;
  proposal: { guest_name: string; date_in: string; date_out: string; status: string; public_token: string | null; };
  wizard: {
    date_in: string | null;
    date_out: string | null;
    adults: number | null;
    children: number | null;
    rooms: number | null;
    rate_plan_id: string | null;
    room_type_id: string | null;
    completed_at: string | null;
  };
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

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function ComposerEditor({ proposalId, propertyId, initialBlocks, initialEmail, proposal, wizard }: Props) {
  const [tab, setTab] = useState<Tab>('blocks');
  const [blocks, setBlocks] = useState<ProposalBlock[]>(initialBlocks);
  const [showRooms, setShowRooms] = useState(false);
  const [showActivities, setShowActivities] = useState(false);
  const [photoPickerFor, setPhotoPickerFor] = useState<{ block: ProposalBlock } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [sentToken, setSentToken] = useState<string | null>(proposal.public_token);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [withPhotos, setWithPhotos] = useState<boolean>(true);
  const [factsheets, setFactsheets] = useState<Array<{ doc_id: string; title: string; for_deal_types: string[] | null }>>([]);
  const [attachedFactsheetId, setAttachedFactsheetId] = useState<string>('');

  // --- Wizard fields (item 1) ---
  const [dateIn, setDateIn] = useState<string>(wizard.date_in || proposal.date_in || todayPlus(30));
  const [dateOut, setDateOut] = useState<string>(wizard.date_out || proposal.date_out || todayPlus(33));
  const [adults, setAdults] = useState<number>(wizard.adults ?? 2);
  const [childrenN, setChildrenN] = useState<number>(wizard.children ?? 0);
  const [rooms, setRooms] = useState<number>(wizard.rooms ?? 1);
  const [ratePlanId, setRatePlanId] = useState<string | null>(wizard.rate_plan_id);
  const [roomTypeId, setRoomTypeId] = useState<string | null>(wizard.room_type_id);
  const [plans, setPlans] = useState<RatePlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [wizardMsg, setWizardMsg] = useState<string | null>(null);

  // Cache-buster so the right-pane iframe reloads after each PATCH.
  const [previewV, setPreviewV] = useState<number>(() => Date.now());
  const bumpPreview = useCallback(() => setPreviewV(Date.now()), []);

  // --- Catalog activity picker (item 4) ---
  const [showExperiencePicker, setShowExperiencePicker] = useState(false);
  const [catalog, setCatalog] = useState<CatalogActivity[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Pre-send availability gate state.
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

  useEffect(() => { refreshCheck(); }, [refreshCheck, blocks.length]);

  useEffect(() => {
    fetch('/api/marketing/factsheets').then(r => r.ok ? r.json() : { rows: [] }).then((j) => {
      setFactsheets(Array.isArray(j.rows) ? j.rows : []);
    }).catch(() => setFactsheets([]));
  }, []);

  // Load available rate plans for the current wizard field values.
  // Debounced fetch: any change to dates/pax/rooms triggers a re-query 450 ms after settle.
  useEffect(() => {
    if (!dateIn || !dateOut || dateOut <= dateIn) return;
    const t = setTimeout(() => {
      let cancelled = false;
      setPlansLoading(true);
      fetch(`/api/sales/proposals/${proposalId}/wizard`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          step: 'query',
          date_in: dateIn, date_out: dateOut,
          adults, children: childrenN, rooms,
        }),
      })
        .then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
        .then((j) => {
          if (cancelled) return;
          setPlans(Array.isArray(j.plans) ? j.plans : []);
        })
        .catch(() => { if (!cancelled) setPlans([]); })
        .finally(() => { if (!cancelled) setPlansLoading(false); });
      return () => { cancelled = true; };
    }, 450);
    return () => clearTimeout(t);
  }, [proposalId, dateIn, dateOut, adults, childrenN, rooms]);

  // Load activity catalog once per open of the picker (item 4).
  useEffect(() => {
    if (!showExperiencePicker || catalog.length > 0) return;
    setCatalogLoading(true);
    fetch(`/api/proposals/activities?property_id=${propertyId}`)
      .then(r => r.ok ? r.json() : { activities: [] })
      .then((j) => setCatalog(Array.isArray(j.activities) ? j.activities : []))
      .catch(() => setCatalog([]))
      .finally(() => setCatalogLoading(false));
  }, [showExperiencePicker, catalog.length, propertyId]);

  // Persist wizard selection whenever a rate plan is chosen.
  // Fires commit on: rate-plan pick, or dates/pax/rooms change AFTER a plan is picked.
  async function commitWizard(planId: string, rtId: string) {
    setWizardMsg(null);
    try {
      const r = await fetch(`/api/sales/proposals/${proposalId}/wizard`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          step: 'commit',
          date_in: dateIn, date_out: dateOut,
          adults, children: childrenN, rooms,
          selected_rate_plan_id: planId,
          selected_room_type_id: rtId,
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        setWizardMsg(`Save failed: ${t.slice(0, 160)}`);
        return;
      }
      setWizardMsg('Saved.');
      bumpPreview();
    } catch (e) {
      setWizardMsg(`Save failed: ${(e as Error).message}`);
    }
  }

  function onPickRatePlan(planId: string) {
    const p = plans.find(x => x.rate_plan_id === planId);
    if (!p) return;
    setRatePlanId(planId);
    setRoomTypeId(p.room_type_id);
    void commitWizard(planId, p.room_type_id);
  }

  // Re-commit when field-level values change AFTER a plan is picked.
  useEffect(() => {
    if (!ratePlanId || !roomTypeId) return;
    const t = setTimeout(() => { void commitWizard(ratePlanId, roomTypeId); }, 650);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateIn, dateOut, adults, childrenN, rooms]);

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
      bumpPreview();
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
    bumpPreview();
    setBusy(null);
  }

  async function removeBlock(id: string) {
    setBusy(id);
    setBlocks(b => b.filter(x => x.id !== id));
    await fetch(`/api/sales/proposals/${proposalId}/blocks?block_id=${id}`, { method: 'DELETE' });
    bumpPreview();
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
        bumpPreview();
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
    bumpPreview();
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
      if (j.check) setCheck(j.check);
      setBusy(null);
      return;
    }
    if (j.token) {
      setSentToken(j.token);
      refreshCheck();
    }
    setBusy(null);
  }

  // Grouped rate plan options for the dropdown (item 1).
  const planGroups = useMemo(() => {
    const groups = new Map<string, { label: string; plans: RatePlan[] }>();
    for (const p of plans) {
      const g = groups.get(p.room_type_id) ?? { label: p.room_type_name || 'Room', plans: [] };
      g.plans.push(p);
      groups.set(p.room_type_id, g);
    }
    return Array.from(groups.entries());
  }, [plans]);

  const previewSrc = `/api/sales/proposals/${proposalId}/email/preview?with_photos=${withPhotos ? 1 : 0}${attachedFactsheetId ? '&factsheet_id=' + attachedFactsheetId : ''}&v=${previewV}`;

  return (
    <>
      <header style={{
        marginTop: 14,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
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

      {/* PBS 2026-07-16 (items 2 / 5) — newsletter-optic chrome bar */}
      <div style={{
        display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
        padding: '10px 12px', margin: '12px 0',
        background: PAPER, border: `1px solid ${HAIRLINE}`, borderRadius: 6,
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: INK, cursor: 'pointer' }}>
          <input type="checkbox" checked={withPhotos} onChange={(e) => { setWithPhotos(e.target.checked); bumpPreview(); }} />
          <span>With photos in preview</span>
        </label>
        <span style={{ width: 1, height: 20, background: HAIRLINE }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: INK }}>
          <span>Factsheet:</span>
          {factsheets.length === 0 ? (
            <a href="/marketing/factsheets" style={{ color: '#B04A2F', fontSize: 11 }}>
              None yet — add one →
            </a>
          ) : (
            <select
              value={attachedFactsheetId}
              onChange={(e) => { setAttachedFactsheetId(e.target.value); bumpPreview(); }}
              style={{ padding: '4px 8px', fontSize: 12, border: `1px solid ${HAIRLINE}`, borderRadius: 3, background: PAPER, color: INK }}
            >
              <option value="">(none)</option>
              {factsheets.map((f) => (
                <option key={f.doc_id} value={f.doc_id}>
                  {f.title}{f.for_deal_types && f.for_deal_types.length ? ' · ' + f.for_deal_types.join('/') : ''}
                </option>
              ))}
            </select>
          )}
        </label>
      </div>

      {tab === 'blocks' && (
        // PBS 2026-07-16 item 2 — real 48% / 52% split; left = editor, right = iframe preview.
        <div style={{ display: 'grid', gridTemplateColumns: '48fr 1px 52fr', gap: 16, alignItems: 'start', gridColumn: '1 / -1' }}>
          <section className="panel" style={{ background: PAPER, color: INK, border: `1px solid ${HAIRLINE}`, maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>

            {/* --- Wizard fields (item 1) --- */}
            <WizardFieldsSection
              dateIn={dateIn} setDateIn={(v) => { setDateIn(v); }}
              dateOut={dateOut} setDateOut={(v) => { setDateOut(v); }}
              adults={adults} setAdults={setAdults}
              childrenN={childrenN} setChildrenN={setChildrenN}
              rooms={rooms} setRooms={setRooms}
              plans={plans} plansLoading={plansLoading}
              ratePlanId={ratePlanId} onPickRatePlan={onPickRatePlan}
              planGroups={planGroups}
              msg={wizardMsg}
              completedAt={wizard.completed_at}
            />

            <div style={{ height: 1, background: HAIRLINE, margin: '14px 0' }} />

            <div className="panel-head">
              <span className="panel-head-title" style={{ color: INK }}>Stay <em style={{ color: GREEN }}>blocks</em></span>
              <span className="panel-head-meta" style={{ display: 'flex', gap: 6, color: INK_SOFT }}>
                <button onClick={() => setShowRooms(true)} className="btn">+ Rooms</button>
                <button onClick={() => setShowExperiencePicker(true)} className="btn">+ Experience</button>
                <button onClick={() => setShowActivities(true)} className="btn" title="Legacy sales.activity_catalog picker">+ Advanced</button>
              </span>
            </div>

            {blocks.length === 0 && (
              <p style={{ color: INK_MUTE, fontSize: 'var(--t-md)', padding: '32px 0', textAlign: 'center' }}>
                No blocks yet. Use the buttons above to add rooms and experiences.
              </p>
            )}

            {blocks.map(b => {
              const disc = Number(b.additional_discount_pct ?? 0);
              const unitAfterDisc = Number(b.unit_price_lak) * (1 - disc / 100);
              const totalUsdEff = Number(b.qty) * Number(b.nights) * unitAfterDisc / FX_LAK_PER_USD;
              return (
                <div key={b.id} style={{ borderBottom: `1px solid ${HAIRLINE}`, padding: '10px 0' }}>
                  <div className="composer-block-row">
                    <div className="composer-block-label" style={{ color: INK, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      {b.hero_asset_id && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/marketing/media/preview?asset_id=${b.hero_asset_id}`}
                          alt=""
                          style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4, border: `1px solid ${HAIRLINE}`, flexShrink: 0 }}
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div>{b.label}</div>
                        <div className="composer-block-meta" style={{ color: INK_MUTE }}>
                          {b.block_type === 'activity' ? 'experience' : b.block_type}{b.note ? ` · ${b.note}` : ''}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input type="number" min={0} value={b.qty}
                        onChange={e => patchBlock(b.id, { qty: Math.max(0, parseInt(e.target.value || '0', 10)) })}
                        className="composer-num-input"
                        style={{ background: '#FAFAF7', color: INK, border: `1px solid ${HAIRLINE}` }} />
                      <span style={{ fontSize: 'var(--t-xs)', color: INK_MUTE }}>×</span>
                      <input type="number" min={1} value={b.nights}
                        onChange={e => patchBlock(b.id, { nights: Math.max(1, parseInt(e.target.value || '1', 10)) })}
                        className="composer-num-input"
                        style={{ background: '#FAFAF7', color: INK, border: `1px solid ${HAIRLINE}` }} />
                      <span style={{ fontSize: 'var(--t-xs)', color: INK_MUTE }}>nt @</span>
                      <input type="number" min={0} step={1000} value={b.unit_price_lak}
                        onChange={e => patchBlock(b.id, { unit_price_lak: parseFloat(e.target.value || '0') })}
                        className="composer-num-input" style={{ width: 90, background: '#FAFAF7', color: INK, border: `1px solid ${HAIRLINE}` }} />
                      <span style={{ fontSize: 'var(--t-xs)', color: INK_MUTE }}>₭</span>
                    </div>
                    <div style={{ minWidth: 80, textAlign: 'right', fontWeight: 500, fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)', color: INK }}>
                      {fmtTableUsd(totalUsdEff)}
                    </div>
                    <button onClick={() => removeBlock(b.id)} disabled={busy === b.id} className="btn"
                      style={{ color: RED, padding: '4px 8px' }}>×</button>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, marginLeft: b.hero_asset_id ? 58 : 0, fontSize: 'var(--t-xs)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button onClick={() => pickPhotoFor(b)} disabled={busy === b.id} className="btn" style={{ padding: '3px 8px', fontSize: 11 }}>
                      {b.hero_asset_id ? 'Change photo' : 'Choose photo'}
                    </button>
                    <button onClick={() => fillFromSettings(b)} disabled={busy === b.id} className="btn" style={{ padding: '3px 8px', fontSize: 11 }}>
                      {busy === b.id ? 'Filling…' : 'Fill from Property Settings'}
                    </button>
                    {/* PBS 2026-07-16 item 5 — per-activity add. discount % */}
                    {b.block_type === 'activity' && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 6, color: INK_SOFT, fontSize: 11 }}>
                        Add. discount %
                        <input type="number" min={0} max={100} step={1}
                          value={Number(b.additional_discount_pct ?? 0)}
                          onChange={(e) => {
                            const v = Math.max(0, Math.min(100, parseFloat(e.target.value || '0')));
                            patchBlock(b.id, { additional_discount_pct: v } as Partial<ProposalBlock>);
                          }}
                          style={{ width: 56, padding: '2px 6px', border: `1px solid ${HAIRLINE}`, borderRadius: 3, fontSize: 11, background: PAPER, color: INK }}
                        />
                        {disc > 0 && (
                          <span style={{ color: INK_MUTE, fontFamily: 'var(--mono)' }}>
                            base {fmtTableUsd(Number(b.qty) * Number(b.nights) * Number(b.unit_price_lak) / FX_LAK_PER_USD)}
                          </span>
                        )}
                      </label>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="composer-total-row" style={{ borderTop: `2px solid ${GREEN}` }}>
              <span className="composer-total-label" style={{ color: INK_MUTE }}>Total</span>
              <span className="composer-total-value" style={{ color: GREEN }}>{fmtTableUsd(totalUsd)}</span>
            </div>
          </section>

          {/* Vertical hairline divider (item 2 design) */}
          <div style={{ width: 1, background: HAIRLINE, alignSelf: 'stretch' }} />

          {/* Right pane — real iframe of the outbound email HTML. */}
          <aside style={{ position: 'sticky', top: 12, background: PAPER, border: `1px solid ${HAIRLINE}`, borderRadius: 6, overflow: 'hidden', height: 'calc(100vh - 220px)', display: 'flex', flexDirection: 'column' }}>
            <header style={{ padding: '8px 12px', borderBottom: `1px solid ${HAIRLINE}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: INK_SOFT, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              <span>Live email preview</span>
              <button onClick={bumpPreview} className="btn" style={{ fontSize: 10, padding: '2px 6px' }}>↻</button>
            </header>
            <iframe
              title="proposal email preview"
              src={previewSrc}
              style={{ flex: 1, border: 0, background: '#F5F0E1' }}
            />
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

      {/* PBS 2026-07-16 item 4 — inline picker driven by content.activities_catalog */}
      {showExperiencePicker && (
        <ExperienceInlinePicker
          onClose={() => setShowExperiencePicker(false)}
          catalog={catalog}
          loading={catalogLoading}
          onPick={(a) => {
            // price_amount is USD in content.activities_catalog when non-null; convert to LAK for consistency.
            const usd = Number(a.price_amount ?? 0);
            const lak = usd > 0 ? Math.round(usd * FX_LAK_PER_USD) : 0;
            addBlockToProposal({
              block_type: 'activity',
              ref_table: 'content.activities_catalog',
              ref_id: String(a.activity_id),
              label: a.name,
              note: a.description ?? undefined,
              unit_price_lak: lak,
              qty: 2,
              nights: 1,
              sort_order: 100,
            });
            setShowExperiencePicker(false);
          }}
        />
      )}

      <PhotoPickerDrawer
        open={!!photoPickerFor}
        onClose={() => setPhotoPickerFor(null)}
        propertyId={propertyId}
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
        <div onClick={() => setShowEmailPreview(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(27,27,27,0.4)', zIndex: 70, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(720px, 96vw)', height: '92vh', background: PAPER, border: `1px solid ${HAIRLINE}`, borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <header style={{ padding: '10px 14px', borderBottom: `1px solid ${HAIRLINE}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: INK_SOFT }}>Newsletter-quality preview</span>
              <button onClick={() => setShowEmailPreview(false)} className="btn">×</button>
            </header>
            <iframe
              title="proposal email preview full"
              src={previewSrc}
              style={{ flex: 1, border: 0, background: '#F5F0E1' }}
            />
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

// ---------------------- wizard fields section (item 1) ----------------------
function WizardFieldsSection(props: {
  dateIn: string; setDateIn: (v: string) => void;
  dateOut: string; setDateOut: (v: string) => void;
  adults: number; setAdults: (v: number) => void;
  childrenN: number; setChildrenN: (v: number) => void;
  rooms: number; setRooms: (v: number) => void;
  plans: RatePlan[]; plansLoading: boolean;
  ratePlanId: string | null; onPickRatePlan: (id: string) => void;
  planGroups: Array<[string, { label: string; plans: RatePlan[] }]>;
  msg: string | null;
  completedAt: string | null;
}) {
  const {
    dateIn, setDateIn, dateOut, setDateOut, adults, setAdults, childrenN, setChildrenN,
    rooms, setRooms, plans, plansLoading, ratePlanId, onPickRatePlan, planGroups, msg, completedAt,
  } = props;
  return (
    <div>
      <div className="panel-head">
        <span className="panel-head-title" style={{ color: INK }}>Stay <em style={{ color: GREEN }}>details</em></span>
        <span className="panel-head-meta" style={{ color: INK_SOFT, fontSize: 11 }}>
          {completedAt ? 'Saved' : 'Not saved yet'}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
        <FieldLabel label="Check-in">
          <FieldInput type="date" value={dateIn} onChange={(e) => setDateIn(e.target.value)} />
        </FieldLabel>
        <FieldLabel label="Check-out">
          <FieldInput type="date" value={dateOut} onChange={(e) => setDateOut(e.target.value)} min={dateIn} />
        </FieldLabel>
        <FieldLabel label="Adults">
          <FieldInput type="number" min={1} max={24} value={adults}
            onChange={(e) => setAdults(Math.max(1, Math.min(24, parseInt(e.target.value || '1', 10))))} />
        </FieldLabel>
        <FieldLabel label="Children">
          <FieldInput type="number" min={0} max={12} value={childrenN}
            onChange={(e) => setChildrenN(Math.max(0, Math.min(12, parseInt(e.target.value || '0', 10))))} />
        </FieldLabel>
        <FieldLabel label="Rooms">
          <FieldInput type="number" min={1} max={24} value={rooms}
            onChange={(e) => setRooms(Math.max(1, Math.min(24, parseInt(e.target.value || '1', 10))))} />
        </FieldLabel>
        <FieldLabel label={plansLoading ? 'Rate plan · checking…' : `Rate plan · ${plans.length} option${plans.length === 1 ? '' : 's'}`}>
          <select
            value={ratePlanId ?? ''}
            onChange={(e) => onPickRatePlan(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', border: `1px solid ${HAIRLINE}`, borderRadius: 3, background: PAPER, color: INK, fontSize: 12 }}
          >
            <option value="">— pick a rate plan —</option>
            {planGroups.map(([rtId, g]) => (
              <optgroup key={rtId} label={g.label}>
                {g.plans.map((p) => (
                  <option key={p.rate_plan_id} value={p.rate_plan_id}>
                    {p.rate_plan_name}{p.board ? ` · ${p.board}` : ''} · ${Math.round(p.total_usd).toLocaleString('en-US')} ({p.rooms_available_min} avail)
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </FieldLabel>
      </div>
      {msg && (
        <div style={{ marginTop: 8, fontSize: 11, color: msg.startsWith('Save failed') ? RED : INK_SOFT }}>{msg}</div>
      )}
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 11, color: INK_SOFT, marginBottom: 3, letterSpacing: 0.2 }}>{label}</span>
      {children}
    </label>
  );
}

function FieldInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props}
      style={{
        width: '100%', padding: '6px 8px',
        border: `1px solid ${HAIRLINE}`, borderRadius: 3,
        background: PAPER, color: INK, fontSize: 12,
        boxSizing: 'border-box',
        ...(props.style || {}),
      }}
    />
  );
}

// ---------------------- experience inline picker (item 4) ----------------------
function ExperienceInlinePicker({
  onClose, catalog, loading, onPick,
}: {
  onClose: () => void;
  catalog: CatalogActivity[];
  loading: boolean;
  onPick: (a: CatalogActivity) => void;
}) {
  const [q, setQ] = useState('');
  const visible = useMemo(() => {
    const rows = catalog.filter(a => a.is_active !== false);
    if (!q) return rows;
    const needle = q.toLowerCase();
    return rows.filter(a =>
      (a.name ?? '').toLowerCase().includes(needle) ||
      (a.description ?? '').toLowerCase().includes(needle) ||
      (a.category ?? '').toLowerCase().includes(needle)
    );
  }, [catalog, q]);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(27,27,27,0.35)',
      zIndex: 70, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 60,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 'min(640px, 96vw)', maxHeight: '80vh', background: PAPER,
        border: `1px solid ${HAIRLINE}`, borderRadius: 6, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <header style={{ padding: '12px 14px', borderBottom: `1px solid ${HAIRLINE}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: INK_SOFT, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Property Settings</div>
            <div style={{ fontSize: 15, color: INK, fontWeight: 600 }}>Pick an experience</div>
          </div>
          <button onClick={onClose} className="btn">Close ✕</button>
        </header>
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${HAIRLINE}` }}>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search experiences…"
            style={{ width: '100%', padding: '8px 10px', border: `1px solid ${HAIRLINE}`, borderRadius: 3, fontSize: 13, background: PAPER, color: INK, boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && <div style={{ padding: 20, color: INK_MUTE, textAlign: 'center', fontSize: 13 }}>Loading catalog…</div>}
          {!loading && visible.length === 0 && (
            <div style={{ padding: 20, color: INK_MUTE, textAlign: 'center', fontSize: 13 }}>
              No experiences match. Add them in <a href="/settings/property/activities" style={{ color: GREEN }}>Property Settings → Activities</a>.
            </div>
          )}
          {!loading && visible.map((a) => {
            const priceLabel = a.price_amount != null
              ? `$${Math.round(Number(a.price_amount))}`
              : '—';
            const dur = a.duration_min != null ? `${a.duration_min}min` : '—';
            return (
              <button
                key={a.activity_id}
                onClick={() => onPick(a)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  background: PAPER, border: 'none',
                  borderBottom: `1px solid ${HAIRLINE}`,
                  padding: '10px 14px', cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 13, color: INK, fontWeight: 500 }}>
                  {a.name} <span style={{ color: INK_MUTE, fontWeight: 400 }}>— {dur} — {priceLabel}</span>
                </div>
                {a.description && (
                  <div style={{ fontSize: 11, color: INK_SOFT, marginTop: 2 }}>{a.description}</div>
                )}
                {a.category && (
                  <div style={{ fontSize: 10, color: INK_MUTE, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 2 }}>{a.category}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function nightCount(from: string, to: string): number {
  if (!from || !to) return 1;
  const d1 = new Date(from); const d2 = new Date(to);
  return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000));
}
