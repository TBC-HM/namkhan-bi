'use client';
// components/proposal/ComposerEditor.tsx
//
// Full redesign 2026-07-16 (item 11 · replaces the multi-tab Frankenstein).
// Design brief:
//   - Paper-white split screen. Left = section stack (scroll). Right = sticky email iframe.
//   - Sections (top → bottom): Header, Stay, Rooms & Experiences, Photos & Factsheet,
//     Body copy, Send.
//   - No tabs — subject + intro copy edited inline in the "Body copy" card.
//   - Discount % + auto-hero fallback + factsheet + with-photos toggle preserved from prior
//     iteration (commit 44d261b) but re-organised into consistent cards.
//   - Debounced auto-save for every field. Preview iframe cache-busted after each save.
//
// Palette (locked · never `var(--paper-warm)` — that token is dark on Namkhan scope):
//   #FFFFFF paper · #F5F0E1 warm · #E6DFCC hairline
//   #1B1B1B ink · #5A5A5A ink-soft · #8A8A8A ink-mute
//   #084838 brand green (primary CTA) · #B04A2F brand red (delete/danger)
//
// APIs consumed (all pre-existing — no route changes shipped in this commit):
//   POST /api/sales/proposals/[id]/wizard          {step:'query'|'commit', ...}
//   POST /api/sales/proposals/[id]/blocks          add block
//   PATCH /api/sales/proposals/[id]/blocks         patch block
//   DELETE /api/sales/proposals/[id]/blocks?...    remove block
//   POST /api/sales/proposals/[id]/blocks/fill     auto-fill label/note/hero from settings
//   GET  /api/sales/proposals/[id]/check           availability gate
//   POST /api/sales/proposals/[id]/send            send / re-send
//   PATCH /api/sales/proposals/[id]/email          subject + intro + outro + ps
//   POST /api/sales/proposals/[id]/email/regenerate  AI redraft
//   GET  /api/marketing/factsheets                 factsheet dropdown
//   GET  /api/proposals/activities?property_id=n   experience picker source
//   GET  /api/sales/proposals/[id]/email/preview?with_photos=&factsheet_id=&v= (iframe src)

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import RoomPickerDrawer from './RoomPickerDrawer';
// ActivityCatalogDrawer (legacy sales.activity_catalog) retired 2026-07-18 · replaced by "+ Custom" bespoke-block flow.
import PhotoPickerDrawer, { type BlockContext, type PhotoRow } from './PhotoPickerDrawer';
import StatusPill, { type StatusTone } from '@/components/ui/StatusPill';
import { fmtTableUsd, fmtIsoDate, FX_LAK_PER_USD } from '@/lib/format';
import type { ProposalBlock } from '@/lib/sales';

// ---------- design tokens (inlined; do NOT use CSS vars — see burn memory) ----------
const T = {
  paper:    '#FFFFFF',
  warm:     '#F5F0E1',
  hairline: '#E6DFCC',
  ink:      '#1B1B1B',
  inkSoft:  '#5A5A5A',
  inkMute:  '#8A8A8A',
  green:    '#084838',
  red:      '#B04A2F',
  sans:     '-apple-system, BlinkMacSystemFont, "SF Pro Text", Segoe UI, Helvetica, Arial, sans-serif',
  serif:    'Georgia, "Times New Roman", serif',
};

// ---------- style helpers ----------
const S = {
  page: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 48fr) 1px minmax(0, 52fr)',
    gap: 16,
    alignItems: 'start',
    gridColumn: '1 / -1',
  } as const,
  leftPane: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    maxHeight: 'calc(100vh - 148px)',
    overflowY: 'auto',
    paddingRight: 6,
  } as const,
  divider: { width: 1, background: T.hairline, alignSelf: 'stretch' } as const,
  rightPane: {
    position: 'sticky',
    top: 12,
    background: T.paper,
    border: `1px solid ${T.hairline}`,
    borderRadius: 12,
    overflow: 'hidden',
    height: 'calc(100vh - 148px)',
    display: 'flex',
    flexDirection: 'column',
  } as const,
  card: {
    background: T.paper,
    border: `1px solid ${T.hairline}`,
    borderRadius: 12,
    padding: 16,
    fontFamily: T.sans,
    color: T.ink,
  } as const,
  cardHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  } as const,
  sectionTitle: {
    fontFamily: T.sans,
    fontSize: 12,
    fontWeight: 600,
    color: T.inkSoft,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  } as const,
  label: {
    display: 'block',
    fontSize: 11,
    color: T.inkSoft,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    marginBottom: 4,
  } as const,
  input: {
    width: '100%',
    padding: '7px 10px',
    fontSize: 13,
    fontFamily: T.sans,
    color: T.ink,
    background: T.paper,
    border: `1px solid ${T.hairline}`,
    borderRadius: 6,
    boxSizing: 'border-box' as const,
  } as const,
  textarea: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 13,
    lineHeight: 1.6,
    fontFamily: T.sans,
    color: T.ink,
    background: T.paper,
    border: `1px solid ${T.hairline}`,
    borderRadius: 6,
    boxSizing: 'border-box' as const,
    resize: 'vertical' as const,
  } as const,
  numInput: {
    width: 68,
    padding: '5px 8px',
    fontSize: 12,
    fontFamily: T.sans,
    color: T.ink,
    background: T.paper,
    border: `1px solid ${T.hairline}`,
    borderRadius: 5,
    boxSizing: 'border-box' as const,
    fontVariantNumeric: 'tabular-nums' as const,
  } as const,
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 12px',
    fontSize: 12,
    fontFamily: T.sans,
    fontWeight: 500,
    color: T.ink,
    background: T.paper,
    border: `1px solid ${T.hairline}`,
    borderRadius: 6,
    cursor: 'pointer',
  } as const,
  btnPrimary: {
    padding: '9px 16px',
    fontSize: 13,
    fontFamily: T.sans,
    fontWeight: 600,
    color: '#FFFFFF',
    background: T.green,
    border: `1px solid ${T.green}`,
    borderRadius: 6,
    cursor: 'pointer',
  } as const,
  btnGhost: {
    padding: '6px 10px',
    fontSize: 11,
    fontFamily: T.sans,
    color: T.inkSoft,
    background: 'transparent',
    border: `1px solid ${T.hairline}`,
    borderRadius: 5,
    cursor: 'pointer',
  } as const,
  btnDanger: {
    padding: '6px 10px',
    fontSize: 12,
    color: T.red,
    background: 'transparent',
    border: `1px solid ${T.hairline}`,
    borderRadius: 5,
    cursor: 'pointer',
  } as const,
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    fontSize: 12,
    color: T.ink,
    background: T.warm,
    border: `1px solid ${T.hairline}`,
    borderRadius: 999,
  } as const,
  headerBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: '10px 14px',
    marginBottom: 12,
    background: T.paper,
    border: `1px solid ${T.hairline}`,
    borderRadius: 12,
    gridColumn: '1 / -1',
  } as const,
};

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

// PBS 2026-07-16 (Feature A) — one row per offer stored in sales.proposal_rate_offers.
// Up to 3 per proposal — email renders side-by-side.
interface RateOfferRow {
  id: string;
  proposal_id: string;
  rate_plan_id: string;
  position: number | null;
  label: string | null;
  payment_terms: string | null;
  cancellation_terms: string | null;
  unit_price_lak: number | null;
  total_lak: number | null;
  created_at?: string;
}

const MAX_RATE_OFFERS = 3;
const DEFAULT_PAYMENT_TERMS = 'Pay at property';
const DEFAULT_CANCELLATION_TERMS = 'Free cancellation until 7 days before arrival';

interface Props {
  proposalId: string;
  propertyId: number;
  initialBlocks: ProposalBlock[];
  initialEmail: { subject?: string | null; intro_md?: string | null; outro_md?: string | null; ps_md?: string | null } | null;
  proposal: { guest_name: string; date_in: string; date_out: string; status: string; public_token: string | null };
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

function nightCount(from: string, to: string): number {
  if (!from || !to) return 1;
  const d1 = new Date(from), d2 = new Date(to);
  return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000));
}

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.max(1, Math.round((now - then) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return new Date(iso).toLocaleString();
}

export default function ComposerEditor({
  proposalId, propertyId, initialBlocks, initialEmail, proposal, wizard,
}: Props) {
  // --- state ---
  const [blocks, setBlocks] = useState<ProposalBlock[]>(initialBlocks);
  const [showRooms, setShowRooms] = useState(false);
  // showActivities retired 2026-07-18 (was legacy catalog drawer)
  const [showExperiencePicker, setShowExperiencePicker] = useState(false);
  const [photoPickerFor, setPhotoPickerFor] = useState<ProposalBlock | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [sentToken, setSentToken] = useState<string | null>(proposal.public_token);
  const [withPhotos, setWithPhotos] = useState<boolean>(true);
  const [factsheets, setFactsheets] = useState<Array<{ doc_id: string; title: string; for_deal_types: string[] | null }>>([]);
  const [attachedFactsheetId, setAttachedFactsheetId] = useState<string>('');
  const [lastSavedIso, setLastSavedIso] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState(0); // forces relativeTime re-render

  // Wizard fields
  const [dateIn, setDateIn] = useState<string>(wizard.date_in || proposal.date_in || todayPlus(30));
  const [dateOut, setDateOut] = useState<string>(wizard.date_out || proposal.date_out || todayPlus(33));
  const [adults, setAdults] = useState<number>(wizard.adults ?? 2);
  const [childrenN, setChildrenN] = useState<number>(wizard.children ?? 0);
  const [rooms, setRooms] = useState<number>(wizard.rooms ?? 1);
  const [ratePlanId, setRatePlanId] = useState<string | null>(wizard.rate_plan_id);
  const [roomTypeId, setRoomTypeId] = useState<string | null>(wizard.room_type_id);
  const [plans, setPlans] = useState<RatePlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);

  // PBS 2026-07-16 (Feature A) — multi-rate offers state.
  // Rendered as up to 3 side-by-side cards in the email preview. Empty list
  // means "single rate plan flow" — email falls back to the pre-existing
  // single-card layout.
  const [rateOffers, setRateOffers] = useState<RateOfferRow[]>([]);
  const [rateOffersBusy, setRateOffersBusy] = useState<string | null>(null);

  // Email copy
  const [subject, setSubject] = useState<string>(initialEmail?.subject ?? `Your stay at The Namkhan · ${proposal.date_in}`);
  const [bodyMd, setBodyMd] = useState<string>(initialEmail?.intro_md ?? '');
  const [emailBusy, setEmailBusy] = useState(false);
  const [aiSource, setAiSource] = useState<string | null>(null);

  // Experience picker catalog
  const [catalog, setCatalog] = useState<CatalogActivity[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Availability gate
  const [check, setCheck] = useState<{
    status: 'green' | 'yellow' | 'red' | 'no_rooms';
    message: string;
    rooms: Array<{ block_id: string; label: string; status: 'green' | 'yellow' | 'red'; message: string; min_avail_in_range: number; qty: number }>;
  } | null>(null);

  // PBS 2026-07-17 — send outcome banner. Populated when the send API returns
  // a non-2xx with a message body. Cleared on retry.
  const [sendResult, setSendResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Preview iframe cache-buster
  const [previewV, setPreviewV] = useState<number>(() => Date.now());
  const bumpPreview = useCallback(() => setPreviewV(Date.now()), []);
  const markSaved = useCallback(() => {
    setLastSavedIso(new Date().toISOString());
    bumpPreview();
  }, [bumpPreview]);

  // Debounced email PATCH — one round-trip per pause (500ms).
  const emailDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialEmailStamp = useRef<string>(JSON.stringify({ s: initialEmail?.subject ?? null, b: initialEmail?.intro_md ?? null }));
  useEffect(() => {
    const now = JSON.stringify({ s: subject, b: bodyMd });
    if (now === initialEmailStamp.current) return;
    if (emailDebounce.current) clearTimeout(emailDebounce.current);
    emailDebounce.current = setTimeout(async () => {
      const r = await fetch(`/api/sales/proposals/${proposalId}/email`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subject, intro_md: bodyMd }),
      });
      if (r.ok) { initialEmailStamp.current = now; markSaved(); }
    }, 500);
    return () => { if (emailDebounce.current) clearTimeout(emailDebounce.current); };
  }, [subject, bodyMd, proposalId, markSaved]);

  // Live "Saved Ns ago" ticker (once/sec while a save exists).
  useEffect(() => {
    if (!lastSavedIso) return;
    const t = setInterval(() => setSavedTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [lastSavedIso]);
  void savedTick; // used only to force re-render

  const refreshCheck = useCallback(async () => {
    try {
      const r = await fetch(`/api/sales/proposals/${proposalId}/check`, { cache: 'no-store' });
      if (r.ok) setCheck(await r.json());
    } catch { /* swallow */ }
  }, [proposalId]);
  // PBS 2026-07-16 — also re-run check when dates / pax / rooms change so the
  // "no dates" banner clears as soon as the wizard snapshot persists (was only
  // firing on block count change → banner stuck red on empty new proposals).
  useEffect(() => {
    const t = setTimeout(() => { void refreshCheck(); }, 700);
    return () => clearTimeout(t);
  }, [refreshCheck, blocks.length, dateIn, dateOut, adults, childrenN, rooms]);

  // Load factsheet options on mount.
  useEffect(() => {
    fetch('/api/marketing/factsheets')
      .then((r) => r.ok ? r.json() : { rows: [] })
      .then((j) => setFactsheets(Array.isArray(j.rows) ? j.rows : []))
      .catch(() => setFactsheets([]));
  }, []);

  // Rate-plan availability query (debounced 450ms after any field change).
  useEffect(() => {
    if (!dateIn || !dateOut || dateOut <= dateIn) return;
    const t = setTimeout(() => {
      let cancelled = false;
      setPlansLoading(true);
      fetch(`/api/sales/proposals/${proposalId}/wizard`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ step: 'query', date_in: dateIn, date_out: dateOut, adults, children: childrenN, rooms }),
      })
        .then((r) => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
        .then((j) => { if (!cancelled) setPlans(Array.isArray(j.plans) ? j.plans : []); })
        .catch(() => { if (!cancelled) setPlans([]); })
        .finally(() => { if (!cancelled) setPlansLoading(false); });
      return () => { cancelled = true; };
    }, 450);
    return () => clearTimeout(t);
  }, [proposalId, dateIn, dateOut, adults, childrenN, rooms]);

  // Load activity catalog when picker opens.
  useEffect(() => {
    if (!showExperiencePicker || catalog.length > 0) return;
    setCatalogLoading(true);
    fetch(`/api/proposals/activities?property_id=${propertyId}`)
      .then((r) => r.ok ? r.json() : { activities: [] })
      .then((j) => setCatalog(Array.isArray(j.activities) ? j.activities : []))
      .catch(() => setCatalog([]))
      .finally(() => setCatalogLoading(false));
  }, [showExperiencePicker, catalog.length, propertyId]);

  async function commitWizard(planId: string, rtId: string) {
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
      if (r.ok) markSaved();
    } catch { /* swallow */ }
  }
  function onPickRatePlan(planId: string) {
    const p = plans.find((x) => x.rate_plan_id === planId);
    if (!p) return;
    setRatePlanId(planId);
    setRoomTypeId(p.room_type_id);
    void commitWizard(planId, p.room_type_id);
  }
  // Re-commit when field values change after a plan is picked.
  useEffect(() => {
    if (!ratePlanId || !roomTypeId) return;
    const t = setTimeout(() => { void commitWizard(ratePlanId, roomTypeId); }, 650);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateIn, dateOut, adults, childrenN, rooms]);

  // ---------- block mutations ----------
  async function addBlockToProposal(payload: Partial<ProposalBlock> & { block_type: ProposalBlock['block_type']; label: string; unit_price_lak: number }) {
    setBusy('add');
    const r = await fetch(`/api/sales/proposals/${proposalId}/blocks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (r.ok) {
      const j = await r.json();
      if (j.block) setBlocks((b) => [...b, j.block]);
      markSaved();
    }
    setBusy(null);
  }

  async function patchBlock(id: string, patch: Partial<ProposalBlock>) {
    setBusy(id);
    setBlocks((b) => b.map((x) => x.id === id ? {
      ...x, ...patch,
      total_lak: (patch.qty ?? x.qty) * (patch.nights ?? x.nights) * (patch.unit_price_lak ?? x.unit_price_lak),
    } : x));
    await fetch(`/api/sales/proposals/${proposalId}/blocks`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ block_id: id, ...patch }),
    });
    markSaved();
    setBusy(null);
  }

  async function removeBlock(id: string) {
    setBusy(id);
    setBlocks((b) => b.filter((x) => x.id !== id));
    await fetch(`/api/sales/proposals/${proposalId}/blocks?block_id=${id}`, { method: 'DELETE' });
    markSaved();
    setBusy(null);
  }

  // ---------- rate offer mutations (Feature A · PBS 2026-07-16) ----------
  const refreshRateOffers = useCallback(async () => {
    try {
      const r = await fetch(`/api/sales/proposals/${proposalId}/rate-offers`, { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      setRateOffers(Array.isArray(j.rows) ? j.rows : []);
    } catch { /* swallow */ }
  }, [proposalId]);

  useEffect(() => { refreshRateOffers(); }, [refreshRateOffers]);

  async function addRateOffer(planId: string) {
    if (rateOffers.length >= MAX_RATE_OFFERS) return;
    const plan = plans.find((p) => p.rate_plan_id === planId);
    if (!plan) return;
    setRateOffersBusy('add');
    const nightlyLak = Number(plan.total_lak) / Math.max(1, Number(plan.nights ?? 1));
    const r = await fetch(`/api/sales/proposals/${proposalId}/rate-offers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        rate_plan_id: planId,
        label: plan.rate_plan_name + (plan.board ? ` · ${plan.board}` : ''),
        payment_terms: DEFAULT_PAYMENT_TERMS,
        cancellation_terms: plan.cancellation_policy ?? DEFAULT_CANCELLATION_TERMS,
        unit_price_lak: Math.round(nightlyLak),
        total_lak: Math.round(Number(plan.total_lak)),
      }),
    });
    if (r.ok) {
      await refreshRateOffers();
      markSaved();
    }
    setRateOffersBusy(null);
  }

  async function patchRateOffer(id: string, patch: Partial<RateOfferRow>) {
    setRateOffersBusy(id);
    // optimistic update
    setRateOffers((arr) => arr.map((o) => o.id === id ? { ...o, ...patch } : o));
    await fetch(`/api/sales/proposals/${proposalId}/rate-offers?id=${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    markSaved();
    setRateOffersBusy(null);
  }

  async function deleteRateOffer(id: string) {
    setRateOffersBusy(id);
    setRateOffers((arr) => arr.filter((o) => o.id !== id));
    await fetch(`/api/sales/proposals/${proposalId}/rate-offers?id=${id}`, { method: 'DELETE' });
    markSaved();
    setRateOffersBusy(null);
  }

  async function attachPhoto(blockId: string, asset: PhotoRow) {
    setBusy(blockId);
    setBlocks((prev) => prev.map((x) => x.id === blockId ? { ...x, hero_asset_id: asset.asset_id } : x));
    await fetch(`/api/sales/proposals/${proposalId}/blocks`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ block_id: blockId, hero_asset_id: asset.asset_id }),
    });
    markSaved();
    setBusy(null);
  }

  async function sendProposal(opts: { force?: boolean } = {}) {
    setBusy('send');
    setSendResult(null);
    const url = opts.force ? `/api/sales/proposals/${proposalId}/send?force=1` : `/api/sales/proposals/${proposalId}/send`;
    let j: any = null;
    try {
      const r = await fetch(url, { method: 'POST' });
      j = await r.json().catch(() => ({}));
      if (r.status === 409) {
        if (j.check) setCheck(j.check);
        setSendResult({ ok: false, message: j.message || j.error || 'Rooms unavailable — availability check failed.' });
        setBusy(null);
        return;
      }
      if (r.ok && j.token) {
        setSentToken(j.token);
        setSendResult({ ok: true, message: `Sent to ${j.recipient_email ?? 'guest'} · gmail_message_id=${j.gmail_message_id ?? '—'}` });
        refreshCheck();
      } else {
        // PBS 2026-07-17 — was silently swallowed. Now shown so the operator
        // sees the actual reason (no_recipient / gmail_send_failed / etc).
        setSendResult({ ok: false, message: (j.error ? `${j.error}: ` : '') + (j.message || j.hint || `HTTP ${r.status}`) });
      }
    } catch (e) {
      setSendResult({ ok: false, message: `Network error · ${(e as Error)?.message ?? 'unknown'}` });
    }
    setBusy(null);
  }

  async function regenerateEmail() {
    setEmailBusy(true);
    setAiSource(null);
    const r = await fetch(`/api/sales/proposals/${proposalId}/email/regenerate`, { method: 'POST' });
    if (r.ok) {
      const j = await r.json();
      if (j.subject) setSubject(j.subject);
      if (j.intro_md) setBodyMd(j.intro_md);
      setAiSource(j.source ?? 'unknown');
      markSaved();
    }
    setEmailBusy(false);
  }

  // ---------- derived ----------
  const totalLak = blocks.reduce((s, b) => {
    const disc = Number(b.additional_discount_pct ?? 0);
    const unitEff = Number(b.unit_price_lak ?? 0) * (1 - Math.max(0, Math.min(100, disc)) / 100);
    return s + Number(b.qty ?? 1) * Number(b.nights ?? 1) * unitEff;
  }, 0);
  const totalUsd = totalLak / FX_LAK_PER_USD;
  const nights = nightCount(proposal.date_in, proposal.date_out);
  const status = STATUS_TONE[proposal.status] ?? STATUS_TONE.draft;

  // PBS 2026-07-17 — filter to only WEB + INTERNAL OPEN rate plans.
  // Excludes complimentary/group/corporate/walk-in/staff/test/comp/dormant/
  // archived plans that shouldn't be offered directly to guests. Also drops
  // duplicates from the same rate name+room combination (Cloudbeds emits both
  // OTA-only and channel-agnostic variants).
  const RATE_EXCLUDE_RE = /complimentar|group\s|corporate\s|walk.?in|do.?not.?use|test\s|dormant|archived?|staff|comp\s|internal use/i;
  const filteredPlans = useMemo(() => {
    const seen = new Set<string>();
    return plans.filter((p) => {
      const name = String(p.rate_plan_name ?? '');
      if (RATE_EXCLUDE_RE.test(name)) return false;
      const key = `${p.room_type_id}::${name.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [plans]);

  const planGroups = useMemo(() => {
    const groups = new Map<string, { label: string; plans: RatePlan[] }>();
    for (const p of filteredPlans) {
      const g = groups.get(p.room_type_id) ?? { label: p.room_type_name || 'Room', plans: [] };
      g.plans.push(p);
      groups.set(p.room_type_id, g);
    }
    return Array.from(groups.entries());
  }, [filteredPlans]);

  const previewSrc = `/api/sales/proposals/${proposalId}/email/preview?with_photos=${withPhotos ? 1 : 0}${attachedFactsheetId ? '&factsheet_id=' + attachedFactsheetId : ''}&v=${previewV}`;
  const photosMissing = blocks.filter((b) => !b.hero_asset_id).length;
  const canSend = blocks.length > 0 && check?.status !== 'red' && busy !== 'send';

  // ---------- render ----------
  return (
    <>
      {/* Top bar — breadcrumb, saved indicator, status pill, Send CTA */}
      <div style={S.headerBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: T.inkSoft, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Sales <span style={{ color: T.inkMute, margin: '0 6px' }}>›</span>
            Proposals <span style={{ color: T.inkMute, margin: '0 6px' }}>›</span>
            <span style={{ color: T.ink, textTransform: 'none', letterSpacing: 0 }}>{proposal.guest_name}</span>
          </div>
          <StatusPill tone={status.tone}>{status.label}</StatusPill>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastSavedIso && (
            <span style={{ fontSize: 11, color: T.inkSoft }}>Saved {relativeTime(lastSavedIso)}</span>
          )}
          {sentToken && (
            <a href={`/p/${sentToken}`} target="_blank" rel="noopener"
              style={{ fontSize: 11, color: T.green, letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
              Open public link →
            </a>
          )}
          <button
            onClick={() => sendProposal()}
            disabled={!canSend}
            style={{ ...S.btnPrimary, opacity: canSend ? 1 : 0.5, cursor: canSend ? 'pointer' : 'not-allowed' }}
            title={check?.status === 'red' ? 'Send blocked — fix availability first' : undefined}
          >
            {busy === 'send' ? 'Sending…' : sentToken ? 'Re-send →' : 'Send to guest →'}
          </button>
        </div>
      </div>

      {/* PBS 2026-07-17 — send outcome banner (was silently swallowed). */}
      {sendResult && (
        <div style={{
          padding: '10px 24px', fontSize: 12, lineHeight: 1.5,
          background: sendResult.ok ? '#EAF6EF' : '#FDECE4',
          color: sendResult.ok ? '#0F5B34' : '#7A1A00',
          borderBottom: `1px solid ${sendResult.ok ? '#B9E0C7' : '#E7B4A0'}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <strong>{sendResult.ok ? '✓ Sent' : '✗ Send failed'}</strong>
          <span style={{ flex: 1, minWidth: 0 }}>{sendResult.message}</span>
          <button onClick={() => setSendResult(null)} style={{ ...S.btnGhost, fontSize: 11, padding: '2px 8px' }}>Dismiss</button>
        </div>
      )}

      {/* PBS 2026-07-16 item 6 — prominent date row (MMM dd, yyyy) directly under the top bar. */}
      <div style={{
        padding: '10px 24px 12px',
        borderBottom: `1px solid ${T.hairline}`,
        background: T.paper,
        display: 'flex',
        alignItems: 'baseline',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: T.ink, letterSpacing: 0 }}>
          {new Date(dateIn + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
          {' → '}
          {new Date(dateOut + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
        </span>
        <span style={{ fontSize: 13, color: T.inkSoft }}>
          · {nightCount(dateIn, dateOut)} {nightCount(dateIn, dateOut) === 1 ? 'night' : 'nights'}
          {' · '}{adults} {adults === 1 ? 'adult' : 'adults'}
          {childrenN > 0 ? `, ${childrenN} ${childrenN === 1 ? 'child' : 'children'}` : ''}
          {' · '}{rooms} {rooms === 1 ? 'room' : 'rooms'}
        </span>
      </div>

      {/* Availability banner (kept from prior iteration) */}
      {check && check.status !== 'no_rooms' && check.status !== 'green' && (
        <div style={{
          gridColumn: '1 / -1', marginBottom: 12, padding: '10px 14px', borderRadius: 8,
          background: check.status === 'red' ? '#FDECE4' : '#FBF3D9',
          border: `1px solid ${check.status === 'red' ? '#E7B4A0' : '#E5D48F'}`,
          fontSize: 12, color: T.ink,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <strong>
              {check.status === 'yellow' ? 'Tight or stale inventory' : 'Send blocked — rooms unavailable'}
            </strong>
            <span style={{ color: T.inkSoft }}>{check.message}</span>
            {check.status === 'red' && (
              <button onClick={() => sendProposal({ force: true })} disabled={busy === 'send'} style={S.btnGhost}>
                Force-send anyway
              </button>
            )}
            <button onClick={refreshCheck} style={S.btnGhost}>↻ Re-check</button>
          </div>
          {check.rooms.filter((r) => r.status !== 'green').length > 0 && (
            <ul style={{ margin: '6px 0 0', paddingLeft: 20, fontSize: 12, color: T.inkSoft }}>
              {check.rooms.filter((r) => r.status !== 'green').map((r) => (
                <li key={r.block_id}><strong style={{ color: T.ink }}>{r.label}</strong> · {r.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div style={S.page}>
        {/* -------- LEFT PANE -------- */}
        <div style={S.leftPane}>

          {/* Stay */}
          <section style={S.card}>
            <div style={S.cardHead}>
              <span style={S.sectionTitle}>Stay</span>
              <span style={{ fontSize: 11, color: T.inkMute }}>
                {fmtIsoDate(dateIn)} → {fmtIsoDate(dateOut)} · {nightCount(dateIn, dateOut)} {nightCount(dateIn, dateOut) === 1 ? 'night' : 'nights'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <FieldLabel label="Check-in">
                <input type="date" style={S.input} value={dateIn} onChange={(e) => setDateIn(e.target.value)} />
              </FieldLabel>
              <FieldLabel label="Check-out">
                <input type="date" style={S.input} value={dateOut} min={dateIn} onChange={(e) => setDateOut(e.target.value)} />
              </FieldLabel>
              <FieldLabel label="Rooms">
                <input type="number" style={S.input} min={1} max={24} value={rooms}
                  onChange={(e) => setRooms(Math.max(1, Math.min(24, parseInt(e.target.value || '1', 10))))} />
              </FieldLabel>
              <FieldLabel label="Adults">
                <input type="number" style={S.input} min={1} max={24} value={adults}
                  onChange={(e) => setAdults(Math.max(1, Math.min(24, parseInt(e.target.value || '1', 10))))} />
              </FieldLabel>
              <FieldLabel label="Children">
                <input type="number" style={S.input} min={0} max={12} value={childrenN}
                  onChange={(e) => setChildrenN(Math.max(0, Math.min(12, parseInt(e.target.value || '0', 10))))} />
              </FieldLabel>
              {/* PBS 2026-07-17 — legacy top-level rate plan selector hidden.
                  Rate offers section below is the single source. */}
            </div>
          </section>

          {/* PBS 2026-07-16 (Feature A) — Rate offers (up to 3 side-by-side in the email).
              Falls back to the single-rate-plan flow when this list is empty. */}
          <section style={S.card}>
            <div style={S.cardHead}>
              <span style={S.sectionTitle}>Rate offers</span>
              <span style={{ fontSize: 11, color: T.inkMute }}>
                {rateOffers.length === 0
                  ? 'Optional — add up to 3 for side-by-side cards in the email'
                  : `${rateOffers.length} of ${MAX_RATE_OFFERS}`}
              </span>
            </div>
            {rateOffers.length === 0 ? (
              <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 8, lineHeight: 1.5 }}>
                Skip this to send with the single rate plan picked above. Add offers to give the guest a choice between (e.g.) Flex, Non-Refundable, and Long-Stay.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>
                {rateOffers.map((o) => (
                  <RateOfferCard
                    key={o.id}
                    offer={o}
                    plans={plans}
                    busy={rateOffersBusy === o.id}
                    onPatch={(patch) => patchRateOffer(o.id, patch)}
                    onDelete={() => deleteRateOffer(o.id)}
                  />
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                disabled={rateOffers.length >= MAX_RATE_OFFERS || plansLoading || filteredPlans.length === 0 || rateOffersBusy === 'add'}
                value=""
                onChange={(e) => { if (e.target.value) addRateOffer(e.target.value); }}
                style={{ ...S.input, height: 32, flex: '1 1 200px', fontSize: 12 }}
              >
                <option value="">
                  {rateOffers.length >= MAX_RATE_OFFERS
                    ? `Max ${MAX_RATE_OFFERS} offers reached`
                    : filteredPlans.length === 0
                      ? '+ Add rate offer (pick dates first)'
                      : `+ Add rate offer — pick from ${filteredPlans.length} plan${filteredPlans.length === 1 ? '' : 's'}`}
                </option>
                {/* PBS 2026-07-18 · richer label — room · rate · board · $total ($nightly/nt) · MinLoS */}
                {planGroups.map(([rtId, g]) => (
                  <optgroup key={rtId} label={g.label}>
                    {g.plans.map((p) => {
                      const nightly = p.nights > 0 ? Math.round(p.total_usd / p.nights) : Math.round(p.total_usd);
                      const total   = Math.round(p.total_usd).toLocaleString('en-US');
                      const nightlyStr = nightly.toLocaleString('en-US');
                      const nights = p.nights || 0;
                      const parts = [
                        g.label,                                   // "Explorer Glamping"
                        p.rate_plan_name,                          // "Flex Rate" / "Advance Purchase" etc
                        p.board ? p.board : null,                  // "BB" if present
                        `$${total} total`,                         // "$495 total"
                        `$${nightlyStr}/nt × ${nights}n`,          // "$165/nt × 3n"
                      ].filter(Boolean);
                      return (
                        <option key={p.rate_plan_id} value={p.rate_plan_id}>
                          {parts.join(' · ')}
                        </option>
                      );
                    })}
                  </optgroup>
                ))}
              </select>
              {rateOffers.length > 0 && (
                <span style={{ fontSize: 11, color: T.inkSoft }}>
                  Email will render {rateOffers.length === 1 ? 'a single card' : `${rateOffers.length} side-by-side cards`}.
                </span>
              )}
            </div>
          </section>

          {/* PBS 2026-07-18 · Include-photos toggle promoted to top so operator sees it before adding blocks */}
          <section style={{ ...S.card, borderLeft: `3px solid ${withPhotos ? T.green : '#E6DFCC'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.ink, cursor: 'pointer', fontWeight: 600 }}>
                <input type="checkbox" checked={withPhotos} onChange={(e) => { setWithPhotos(e.target.checked); bumpPreview(); }} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                <span>Include photos in this proposal</span>
              </label>
              <span style={{ fontSize: 11, color: T.inkSoft }}>
                {withPhotos
                  ? (blocks.length === 0
                      ? 'On — each block you add below will show a photo (auto-hero if you don\'t pick one).'
                      : photosMissing === 0
                        ? `On — all ${blocks.length} block${blocks.length === 1 ? '' : 's'} have a photo.`
                        : `On — ${photosMissing} of ${blocks.length} block${blocks.length === 1 ? '' : 's'} use auto-hero (click "Choose photo" per block to override).`)
                  : 'Off — no photos rendered in preview or email.'}
              </span>
            </div>
          </section>

          {/* Rooms & Experiences */}
          <section style={S.card}>
            <div style={S.cardHead}>
              <span style={S.sectionTitle}>Rooms &amp; Experiences</span>
              <span style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setShowRooms(true)} style={S.btn}>+ Room</button>
                <button onClick={() => setShowExperiencePicker(true)} style={S.btn}>+ Experience</button>
                {/* PBS 2026-07-18 · bespoke one-off block (not saved to Settings catalog) */}
                <button
                  onClick={() => addBlockToProposal({
                    block_type: 'activity',
                    ref_table: null as any,
                    ref_id: null as any,
                    label: 'Custom item',
                    note: undefined,
                    unit_price_lak: 0,
                    qty: 1,
                    nights: 1,
                    sort_order: 200,
                  })}
                  style={S.btn}
                  title="One-off item just for this proposal — fill label, price, photo inline. Not saved to Settings."
                >+ Custom</button>
              </span>
            </div>

            {blocks.length === 0 ? (
              <div style={{ padding: '28px 8px', textAlign: 'center', color: T.inkMute, fontSize: 12 }}>
                No blocks yet — add a room or experience to start.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {blocks.map((b) => (
                  <BlockRow
                    key={b.id}
                    block={b}
                    busy={busy === b.id}
                    onPatch={(patch) => patchBlock(b.id, patch)}
                    onRemove={() => removeBlock(b.id)}
                    onPickPhoto={() => setPhotoPickerFor(b)}
                  />
                ))}
              </div>
            )}

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              marginTop: 12, paddingTop: 12, borderTop: `2px solid ${T.green}`,
            }}>
              <span style={{ fontSize: 11, color: T.inkSoft, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Stay total</span>
              <span style={{
                fontFamily: T.sans, fontSize: 18, fontWeight: 600, color: T.green,
                fontVariantNumeric: 'tabular-nums',
              }}>{fmtTableUsd(totalUsd)}</span>
            </div>
          </section>

          {/* Factsheet (Photos toggle moved to top of composer) */}
          <section style={S.card}>
            <div style={S.cardHead}>
              <span style={S.sectionTitle}>Factsheet PDF</span>
            </div>
            <FieldLabel label="Factsheet PDF">
              {factsheets.length === 0 ? (
                <a href="/marketing/factsheets" style={{ color: T.red, fontSize: 12 }}>None yet — add one →</a>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    value={attachedFactsheetId}
                    onChange={(e) => { setAttachedFactsheetId(e.target.value); bumpPreview(); }}
                    style={{ ...S.input, height: 34, flex: 1 }}
                  >
                    <option value="">(none)</option>
                    {factsheets.map((f) => (
                      <option key={f.doc_id} value={f.doc_id}>
                        {f.title}{f.for_deal_types && f.for_deal_types.length ? ' · ' + f.for_deal_types.join('/') : ''}
                      </option>
                    ))}
                  </select>
                  {attachedFactsheetId && (
                    <button onClick={() => { setAttachedFactsheetId(''); bumpPreview(); }} style={S.btnGhost}>× clear</button>
                  )}
                </div>
              )}
            </FieldLabel>
          </section>

          {/* Body copy */}
          <section style={S.card}>
            <div style={S.cardHead}>
              <span style={S.sectionTitle}>Body copy</span>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {aiSource && (
                  <span style={{ fontSize: 10, color: aiSource === 'stub' ? T.red : T.green, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    AI: {aiSource}
                  </span>
                )}
                {/* PBS 2026-07-18 · ✨ Polish — refines the current body copy in place (keeps your intent). */}
                <button
                  onClick={async () => {
                    if (emailBusy || !bodyMd.trim()) return;
                    setEmailBusy(true);
                    try {
                      const res = await fetch('/api/mail/ai/polish', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ draft: bodyMd, tone: 'warm-professional', mode: 'polish' }),
                      });
                      const j = await res.json();
                      if (j?.ok && typeof j.polished === 'string' && j.polished.trim()) {
                        setBodyMd(j.polished.trim());
                        setAiSource('polished');
                      } else {
                        console.warn('[polish] failed', j);
                      }
                    } catch (e) { console.warn('[polish]', e); }
                    finally { setEmailBusy(false); }
                  }}
                  disabled={emailBusy || !bodyMd.trim()}
                  style={S.btnGhost}
                  title="Refines what you typed — keeps your intent, tightens the wording"
                >{emailBusy ? '…' : '✨ Polish'}</button>
                <button onClick={regenerateEmail} disabled={emailBusy} style={S.btnGhost}>
                  {emailBusy ? '…' : '↻ Re-draft with AI'}
                </button>
              </span>
            </div>
            <FieldLabel label="Subject">
              <input style={S.input} value={subject} onChange={(e) => setSubject(e.target.value)} />
            </FieldLabel>
            <div style={{ height: 10 }} />
            <FieldLabel label="Message to guest">
              <textarea
                style={{ ...S.textarea, minHeight: 180 }}
                value={bodyMd}
                onChange={(e) => setBodyMd(e.target.value)}
                placeholder="Write a warm, concise note — dates, room, one signature experience. This appears above the stay summary."
              />
            </FieldLabel>
            <div style={{ marginTop: 6, fontSize: 11, color: T.inkMute }}>
              Auto-saves 500ms after you stop typing. Outro + sign-off are appended automatically from your property signature.
            </div>
          </section>

          {/* Bottom padding so last card isn't flush against the scroll edge */}
          <div style={{ height: 12 }} />
        </div>

        {/* -------- DIVIDER -------- */}
        <div style={S.divider} />

        {/* -------- RIGHT PANE (email iframe) -------- */}
        <aside style={S.rightPane}>
          <header style={{
            padding: '10px 14px', borderBottom: `1px solid ${T.hairline}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 11, color: T.inkSoft, letterSpacing: '0.08em', textTransform: 'uppercase',
            background: T.paper,
          }}>
            <span>Live email preview</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontFamily: T.sans, textTransform: 'none', letterSpacing: 0, color: T.inkMute }}>
                {nights} {nights === 1 ? 'nt' : 'nts'} · {fmtTableUsd(totalUsd)}
              </span>
              <button onClick={bumpPreview} style={S.btnGhost} title="Refresh">↻</button>
            </div>
          </header>
          <iframe
            key={previewV}
            title="proposal email preview"
            src={previewSrc}
            style={{ flex: 1, border: 0, background: T.warm, width: '100%' }}
          />
        </aside>
      </div>

      {/* -------- Drawers -------- */}
      <RoomPickerDrawer
        open={showRooms}
        onClose={() => setShowRooms(false)}
        fromDate={dateIn}
        toDate={dateOut}
        onPick={(room) => {
          addBlockToProposal({
            block_type: 'room',
            ref_table: 'public.room_types',
            ref_id: String(room.room_type_id),
            label: room.room_type_name,
            unit_price_lak: Number(room.avg_nightly_lak),
            qty: 1,
            nights: nightCount(dateIn, dateOut),
            sort_order: 10,
          });
          setShowRooms(false);
        }}
      />
      {/* ActivityCatalogDrawer removed 2026-07-18 — "+ Custom" button replaces it */}
      {showExperiencePicker && (
        <ExperienceInlinePicker
          onClose={() => setShowExperiencePicker(false)}
          catalog={catalog}
          loading={catalogLoading}
          onPick={(a) => {
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
        block={photoPickerFor ? ({
          block_type: photoPickerFor.block_type as BlockContext['block_type'],
          ref_id: photoPickerFor.ref_id ?? null,
          label: photoPickerFor.label,
        }) : null}
        currentAssetId={photoPickerFor?.hero_asset_id ?? null}
        onPick={(asset) => { if (photoPickerFor) attachPhoto(photoPickerFor.id, asset); }}
      />
    </>
  );
}

// ---------- child components ----------

// PBS 2026-07-16 (Feature A) — one editable rate-offer card (up to 3 per proposal).
function RateOfferCard({
  offer, plans, busy, onPatch, onDelete,
}: {
  offer: RateOfferRow;
  plans: RatePlan[];
  busy: boolean;
  onPatch: (patch: Partial<RateOfferRow>) => void;
  onDelete: () => void;
}) {
  const plan = plans.find((p) => p.rate_plan_id === offer.rate_plan_id);
  const nightlyLak = offer.unit_price_lak != null ? Number(offer.unit_price_lak) : (plan ? Number(plan.total_lak) / Math.max(1, Number(plan.nights ?? 1)) : 0);
  const totalLak = offer.total_lak != null ? Number(offer.total_lak) : (plan ? Number(plan.total_lak) : 0);
  const nightlyUsd = nightlyLak / FX_LAK_PER_USD;
  const totalUsd = totalLak / FX_LAK_PER_USD;

  return (
    <div style={{
      background: T.paper,
      border: `1px solid ${T.hairline}`,
      borderRadius: 8,
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: T.inkSoft, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>
            Offer {offer.position ?? 1}
          </div>
          <select
            value={offer.rate_plan_id}
            onChange={(e) => {
              const newId = e.target.value;
              const newPlan = plans.find((p) => p.rate_plan_id === newId);
              if (!newPlan) return;
              const nlLak = Number(newPlan.total_lak) / Math.max(1, Number(newPlan.nights ?? 1));
              onPatch({
                rate_plan_id: newId,
                label: (offer.label && offer.label.trim()) ? offer.label : (newPlan.rate_plan_name + (newPlan.board ? ` · ${newPlan.board}` : '')),
                unit_price_lak: Math.round(nlLak),
                total_lak: Math.round(Number(newPlan.total_lak)),
                cancellation_terms: offer.cancellation_terms ?? newPlan.cancellation_policy ?? DEFAULT_CANCELLATION_TERMS,
              });
            }}
            disabled={busy || plans.length === 0}
            style={{ ...S.input, height: 32, width: '100%', fontSize: 12 }}
          >
            {plan ? null : <option value={offer.rate_plan_id}>(unknown plan {offer.rate_plan_id.slice(0, 8)})</option>}
            {plans.map((p) => (
              <option key={p.rate_plan_id} value={p.rate_plan_id}>
                {p.rate_plan_name}{p.board ? ` · ${p.board}` : ''}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={onDelete}
          disabled={busy}
          title="Remove offer"
          style={{ ...S.btnGhost, color: T.red, borderColor: T.red, padding: '4px 8px' }}
        >
          × delete
        </button>
      </div>

      {/* PBS 2026-07-17 · bug #58 — Guest-facing label removed. Label is set
          automatically to plan.rate_plan_name on plan change (line ~1149). */}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FieldLabel label="Payment terms">
          <textarea
            value={offer.payment_terms ?? ''}
            onChange={(e) => onPatch({ payment_terms: e.target.value })}
            placeholder={DEFAULT_PAYMENT_TERMS}
            rows={2}
            /* PBS 2026-07-17 · bug #62 — do NOT disable during optimistic patch
               (was flipping every keystroke → lost focus after 1 letter). */
            style={{ ...S.textarea, minHeight: 52 }}
          />
        </FieldLabel>
        <FieldLabel label="Cancellation terms">
          <textarea
            value={offer.cancellation_terms ?? ''}
            onChange={(e) => onPatch({ cancellation_terms: e.target.value })}
            placeholder={DEFAULT_CANCELLATION_TERMS}
            rows={2}
            style={{ ...S.textarea, minHeight: 52 }}
          />
        </FieldLabel>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: `1px dashed ${T.hairline}`, fontSize: 11, color: T.inkSoft }}>
        <span>{Math.round(nightlyUsd).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} / night</span>
        <span style={{ fontWeight: 600, color: T.green }}>
          {Math.round(totalUsd).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} total
        </span>
      </div>
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={S.label}>{label}</span>
      {children}
    </label>
  );
}

function BlockRow({
  block, busy, onPatch, onRemove, onPickPhoto,
}: {
  block: ProposalBlock;
  busy: boolean;
  onPatch: (p: Partial<ProposalBlock>) => void;
  onRemove: () => void;
  onPickPhoto: () => void;
}) {
  const disc = Number(block.additional_discount_pct ?? 0);
  const unitAfter = Number(block.unit_price_lak) * (1 - Math.max(0, Math.min(100, disc)) / 100);
  const totalUsdEff = Number(block.qty) * Number(block.nights) * unitAfter / FX_LAK_PER_USD;
  const isExperience = block.block_type === 'activity';
  const kindLabel = isExperience ? 'Experience' : block.block_type === 'room' ? 'Room' : block.block_type;

  return (
    <div style={{
      background: T.paper,
      border: `1px solid ${T.hairline}`,
      borderRadius: 8,
      padding: 10,
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
    }}>
      {block.hero_asset_id ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/marketing/media/preview?asset_id=${block.hero_asset_id}`}
          alt=""
          width={56} height={56}
          style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: `1px solid ${T.hairline}`, flexShrink: 0 }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div style={{
          width: 56, height: 56, borderRadius: 6, flexShrink: 0,
          background: T.warm, border: `1px dashed ${T.hairline}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, color: T.inkMute, textAlign: 'center', padding: 4,
        }}>auto</div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, color: T.inkSoft, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{kindLabel}</div>
            <div style={{ fontSize: 14, color: T.ink, fontWeight: 500, wordBreak: 'break-word' }}>{block.label}</div>
            {block.note && (
              <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2, lineHeight: 1.4 }}>{block.note}</div>
            )}
          </div>
          <button onClick={onRemove} disabled={busy} style={S.btnDanger} title="Remove">×</button>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          <input type="number" min={0} value={block.qty} style={S.numInput}
            onChange={(e) => onPatch({ qty: Math.max(0, parseInt(e.target.value || '0', 10)) })} />
          <span style={{ fontSize: 11, color: T.inkMute }}>×</span>
          <input type="number" min={1} value={block.nights} style={S.numInput}
            onChange={(e) => onPatch({ nights: Math.max(1, parseInt(e.target.value || '1', 10)) })} />
          <span style={{ fontSize: 11, color: T.inkMute }}>nt @</span>
          {/* PBS 2026-07-18 · USD input (LAK stored internally = usd × FX_LAK_PER_USD) */}
          <input type="number" min={0} step={1} value={Math.round((Number(block.unit_price_lak) || 0) / FX_LAK_PER_USD * 100) / 100}
            style={{ ...S.numInput, width: 84 }}
            onChange={(e) => onPatch({ unit_price_lak: Math.round(parseFloat(e.target.value || '0') * FX_LAK_PER_USD) })} />
          <span style={{ fontSize: 11, color: T.inkMute }}>$</span>
          {isExperience && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: T.inkSoft, marginLeft: 4 }}>
              <span>Add. disc %</span>
              <input type="number" min={0} max={100} step={1}
                value={Number(block.additional_discount_pct ?? 0)}
                style={{ ...S.numInput, width: 54 }}
                onChange={(e) => onPatch({ additional_discount_pct: Math.max(0, Math.min(100, parseFloat(e.target.value || '0'))) } as Partial<ProposalBlock>)}
              />
            </label>
          )}
          <span style={{
            marginLeft: 'auto', fontFamily: T.sans, fontSize: 13, fontWeight: 600, color: T.green,
            fontVariantNumeric: 'tabular-nums',
          }}>{fmtTableUsd(totalUsdEff)}</span>
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button onClick={onPickPhoto} disabled={busy} style={S.btnGhost}>
            {block.hero_asset_id ? 'Change photo' : 'Choose photo'}
          </button>
          {!block.hero_asset_id && (
            <span style={{ fontSize: 10, color: T.inkMute, alignSelf: 'center' }}>
              (auto-hero fallback active for preview)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------- experience inline picker ----------------------
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
    const rows = catalog.filter((a) => a.is_active !== false);
    if (!q) return rows;
    const needle = q.toLowerCase();
    return rows.filter((a) =>
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
        width: 'min(640px, 96vw)', maxHeight: '80vh', background: T.paper,
        border: `1px solid ${T.hairline}`, borderRadius: 10, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <header style={{ padding: '12px 14px', borderBottom: `1px solid ${T.hairline}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: T.inkSoft, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Property Settings</div>
            <div style={{ fontSize: 15, color: T.ink, fontWeight: 600 }}>Pick an experience</div>
          </div>
          <button onClick={onClose} style={S.btn}>Close ✕</button>
        </header>
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.hairline}` }}>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search experiences…"
            style={S.input}
          />
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && <div style={{ padding: 20, color: T.inkMute, textAlign: 'center', fontSize: 13 }}>Loading catalog…</div>}
          {!loading && visible.length === 0 && (
            <div style={{ padding: 20, color: T.inkMute, textAlign: 'center', fontSize: 13 }}>
              No experiences match. Add them in{' '}
              <a href="/settings/property/activities" style={{ color: T.green }}>Property Settings → Activities</a>.
            </div>
          )}
          {!loading && visible.map((a) => {
            const priceLabel = a.price_amount != null ? `$${Math.round(Number(a.price_amount))}` : '—';
            const dur = a.duration_min != null ? `${a.duration_min}min` : '—';
            return (
              <button
                key={a.activity_id}
                onClick={() => onPick(a)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  background: T.paper, border: 'none',
                  borderBottom: `1px solid ${T.hairline}`,
                  padding: '10px 14px', cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 13, color: T.ink, fontWeight: 500 }}>
                  {a.name} <span style={{ color: T.inkMute, fontWeight: 400 }}>— {dur} — {priceLabel}</span>
                </div>
                {a.description && (
                  <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>{a.description}</div>
                )}
                {a.category && (
                  <div style={{ fontSize: 10, color: T.inkMute, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>{a.category}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
