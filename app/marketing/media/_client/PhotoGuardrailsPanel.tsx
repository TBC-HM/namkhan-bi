// app/marketing/media/_client/PhotoGuardrailsPanel.tsx
// PBS 2026-07-14 · Task B — Photo Guardrails: 7 editable sub-panels.
// Naming · Captions · Alt-text · Tier thresholds · Aspect ratios · Text policy · Brand palette.
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#1F3A2E';
const RED    = '#B03826';

// ---------- shared types ----------
export interface NamingRow {
  id: string;
  property_id: number | null;
  scope: string | null;
  pattern: string;
  regex: string | null;
  examples: string[] | null;
  description: string | null;
  active: boolean;
}
export interface CaptionRow {
  id: string;
  property_id: number | null;
  min_words: number | null;
  max_words: number | null;
  banned_phrases: string[] | null;
  must_include_keywords: string[] | null;
  tone: string | null;
  active: boolean;
}
export interface AltTextRow {
  id: string;
  property_id: number | null;
  min_chars: number;
  max_chars: number;
  must_be_descriptive: boolean;
  must_include_subject: boolean;
  banned_words: string[] | null;
  active: boolean;
}
export interface TierThresholdRow {
  tier: string;
  min_quality_index: number | null;
  min_technical: number | null;
  min_aesthetic: number | null;
  min_marketing: number | null;
  requires_model_release: boolean;
  active: boolean;
}
export interface AspectRatioRow {
  channel: string;
  ratio: string;
  min_width_px: number | null;
  min_height_px: number | null;
  notes: string | null;
  active: boolean;
}
export interface TextPolicyRow {
  id: number;
  allow_on_social: boolean;
  allow_on_hero: boolean;
  allow_on_ota: boolean;
  max_text_area_pct: number;
  blocklist_words: string[] | null;
  active: boolean;
}
export interface BrandPaletteRow {
  id: string;
  property_id: number | null;
  color_name: string;
  hex: string;
  role: string;
  active: boolean;
}

interface Props {
  propertyId: number;
  naming: NamingRow[];
  captions: CaptionRow[];
  altText: AltTextRow[];
  tierThresholds: TierThresholdRow[];
  aspectRatios: AspectRatioRow[];
  textPolicy: TextPolicyRow | null;
  brandPalette: BrandPaletteRow[];
}

type InnerTab = 'naming' | 'captions' | 'alt' | 'tiers' | 'ratios' | 'text' | 'palette';

export default function PhotoGuardrailsPanel(props: Props) {
  const [tab, setTab] = useState<InnerTab>('naming');
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const tabs: Array<{ key: InnerTab; label: string; n: number }> = [
    { key: 'naming',   label: 'Naming',        n: props.naming.length },
    { key: 'captions', label: 'Captions',      n: props.captions.length },
    { key: 'alt',      label: 'Alt-text SEO',  n: props.altText.length },
    { key: 'tiers',    label: 'Tier scores',   n: props.tierThresholds.length },
    { key: 'ratios',   label: 'Aspect ratios', n: props.aspectRatios.length },
    { key: 'text',     label: 'Text on image', n: props.textPolicy ? 1 : 0 },
    { key: 'palette',  label: 'Brand palette', n: props.brandPalette.length },
  ];

  const bannerBg = banner?.tone === 'ok' ? '#EAF3EA' : '#FBE9E7';
  const bannerFg = banner?.tone === 'ok' ? FOREST : RED;

  return (
    <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, padding: 16 }}>
      <div style={{ fontSize: 12, color: INK_M, marginBottom: 10 }}>
        Photo Guardrails — editable rule tables consumed by the QA scorer + brief compiler. Inactive rows are dormant.
      </div>

      {banner && (
        <div style={{ padding: '8px 12px', background: bannerBg, color: bannerFg, border: '1px solid ' + HAIR, borderRadius: 4, marginBottom: 12, fontSize: 12 }}>
          {banner.text}
          <button onClick={() => setBanner(null)} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: INK_M }}>x</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid ' + HAIR, marginBottom: 14 }}>
        {tabs.map(t => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '6px 12px', fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase',
                border: 'none', background: 'transparent',
                color: active ? FOREST : INK_M,
                borderBottom: active ? '2px solid ' + FOREST : '2px solid transparent',
                fontWeight: active ? 700 : 500, cursor: 'pointer', marginBottom: -1,
              }}
            >
              {t.label} <span style={{ opacity: 0.6 }}>· {t.n}</span>
            </button>
          );
        })}
      </div>

      {tab === 'naming'   && <NamingPanel   propertyId={props.propertyId} rows={props.naming}         setBanner={setBanner} />}
      {tab === 'captions' && <CaptionsPanel propertyId={props.propertyId} rows={props.captions}       setBanner={setBanner} />}
      {tab === 'alt'      && <AltTextPanel  propertyId={props.propertyId} rows={props.altText}        setBanner={setBanner} />}
      {tab === 'tiers'    && <TierPanel     rows={props.tierThresholds}                                setBanner={setBanner} />}
      {tab === 'ratios'   && <AspectPanel   rows={props.aspectRatios}                                  setBanner={setBanner} />}
      {tab === 'text'     && <TextPolicyPanel   row={props.textPolicy}                                 setBanner={setBanner} />}
      {tab === 'palette'  && <PalettePanel  propertyId={props.propertyId} rows={props.brandPalette}    setBanner={setBanner} />}
    </div>
  );
}

// ---------- shared UI helpers ----------
type BannerFn = React.Dispatch<React.SetStateAction<{ tone: 'ok' | 'err'; text: string } | null>>;

const th: React.CSSProperties = { textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid ' + HAIR, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: INK_M, fontWeight: 600 };
const td: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid ' + HAIR, fontSize: 12, color: INK, verticalAlign: 'top' };
const input: React.CSSProperties = { border: '1px solid ' + HAIR, borderRadius: 3, padding: '4px 6px', fontSize: 12, background: WHITE, color: INK };

function Btn({ label, onClick, tone = 'ghost', disabled }: { label: string; onClick: () => void; tone?: 'primary' | 'danger' | 'ghost'; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '4px 10px', fontSize: 11, borderRadius: 3, cursor: disabled ? 'not-allowed' : 'pointer',
        border: '1px solid ' + (tone === 'primary' ? FOREST : tone === 'danger' ? RED : HAIR),
        background: tone === 'primary' ? FOREST : WHITE,
        color: tone === 'primary' ? WHITE : tone === 'danger' ? RED : INK,
        opacity: disabled ? 0.5 : 1,
      }}
    >{label}</button>
  );
}

function ChipInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('');
  function addFromDraft() {
    const v = draft.trim();
    if (!v) return;
    onChange([...(value ?? []), v]);
    setDraft('');
  }
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
        {(value ?? []).map((chip, i) => (
          <span key={i} style={{ background: '#F5F0E0', color: INK, padding: '2px 8px', borderRadius: 10, fontSize: 11, border: '1px solid ' + HAIR }}>
            {chip}
            <button
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              style={{ marginLeft: 6, background: 'none', border: 'none', cursor: 'pointer', color: INK_M, fontSize: 12, padding: 0 }}
              aria-label={`remove ${chip}`}
            >x</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFromDraft(); } }}
          placeholder={placeholder ?? 'type + Enter'}
          style={{ ...input, flex: 1 }}
        />
        <Btn label="+ add" onClick={addFromDraft} />
      </div>
    </div>
  );
}

async function postJson(url: string, body: any, method: 'POST' | 'DELETE' = 'POST') {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let j: any = null;
  try { j = await res.json(); } catch { /* noop */ }
  if (!res.ok || j?.ok === false) throw new Error(j?.error ?? res.statusText);
  return j;
}

// ---------- 1. Naming ----------
function NamingPanel({ propertyId, rows, setBanner }: { propertyId: number; rows: NamingRow[]; setBanner: BannerFn }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Partial<NamingRow> | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(r: Partial<NamingRow>) {
    setSaving(true);
    try {
      await postJson('/api/marketing/media/guardrails/naming', {
        id: r.id ?? null,
        property_id: r.property_id ?? propertyId,
        scope: 'photo',
        pattern: r.pattern,
        examples: r.examples ?? [],
        description: r.description ?? null,
        active: r.active ?? true,
      });
      setBanner({ tone: 'ok', text: 'Naming convention saved.' });
      setDraft(null);
      router.refresh();
    } catch (e: any) {
      setBanner({ tone: 'err', text: 'Save failed: ' + e.message });
    } finally { setSaving(false); }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: INK_M }}>{rows.length} row{rows.length === 1 ? '' : 's'} · scope=photo</span>
        <Btn label="+ Add naming rule" tone="primary" onClick={() => setDraft({ pattern: '', examples: [], active: true })} />
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={th}>Pattern</th><th style={th}>Description</th><th style={th}>Examples</th><th style={th}>Active</th><th style={th}></th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td style={{ ...td, fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>{r.pattern}</td>
              <td style={td}>{r.description ?? <span style={{ color: INK_M }}>—</span>}</td>
              <td style={{ ...td, color: INK_M }}>{(r.examples ?? []).join(' · ') || '—'}</td>
              <td style={td}>{r.active ? 'yes' : 'no'}</td>
              <td style={td}><Btn label="edit" onClick={() => setDraft(r)} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      {draft && (
        <div style={{ marginTop: 14, padding: 12, background: '#FAF7EE', border: '1px solid ' + HAIR, borderRadius: 4 }}>
          <div style={{ display: 'grid', gap: 10 }}>
            <label style={{ fontSize: 11, color: INK_M }}>Pattern
              <input value={draft.pattern ?? ''} onChange={e => setDraft({ ...draft, pattern: e.target.value })} placeholder="Location_Scene_ShotType_Orientation" style={{ ...input, width: '100%' }} />
            </label>
            <label style={{ fontSize: 11, color: INK_M }}>Description
              <input value={draft.description ?? ''} onChange={e => setDraft({ ...draft, description: e.target.value })} style={{ ...input, width: '100%' }} />
            </label>
            <label style={{ fontSize: 11, color: INK_M }}>Example filenames
              <ChipInput value={draft.examples ?? []} onChange={v => setDraft({ ...draft, examples: v })} placeholder="MainPool_SunsetView_Wide_Landscape.jpg" />
            </label>
            <label style={{ fontSize: 12, color: INK, display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={draft.active ?? true} onChange={e => setDraft({ ...draft, active: e.target.checked })} /> Active
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <Btn label={saving ? 'Saving…' : 'Save'} onClick={() => save(draft)} tone="primary" disabled={saving || !draft.pattern} />
              <Btn label="Cancel" onClick={() => setDraft(null)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- 2. Captions ----------
function CaptionsPanel({ propertyId, rows, setBanner }: { propertyId: number; rows: CaptionRow[]; setBanner: BannerFn }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Partial<CaptionRow> | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(r: Partial<CaptionRow>) {
    setSaving(true);
    try {
      await postJson('/api/marketing/media/guardrails/captions', {
        id: r.id ?? null,
        property_id: r.property_id ?? propertyId,
        min_words: r.min_words ?? null,
        max_words: r.max_words ?? null,
        banned_phrases: r.banned_phrases ?? [],
        must_include_keywords: r.must_include_keywords ?? [],
        tone: r.tone ?? null,
        active: r.active ?? true,
      });
      setBanner({ tone: 'ok', text: 'Caption rules saved.' });
      setDraft(null);
      router.refresh();
    } catch (e: any) {
      setBanner({ tone: 'err', text: 'Save failed: ' + e.message });
    } finally { setSaving(false); }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: INK_M }}>{rows.length} row{rows.length === 1 ? '' : 's'}</span>
        <Btn label="+ Add caption rule" tone="primary" onClick={() => setDraft({ min_words: 8, max_words: 40, banned_phrases: [], must_include_keywords: [], active: true })} />
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={th}>Words</th><th style={th}>Banned phrases</th><th style={th}>Required keywords</th><th style={th}>Tone</th><th style={th}>Active</th><th style={th}></th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td style={td}>{r.min_words ?? '—'}–{r.max_words ?? '—'}</td>
              <td style={{ ...td, color: INK_M }}>{(r.banned_phrases ?? []).join(', ') || '—'}</td>
              <td style={{ ...td, color: INK_M }}>{(r.must_include_keywords ?? []).join(', ') || '—'}</td>
              <td style={td}>{r.tone ?? <span style={{ color: INK_M }}>—</span>}</td>
              <td style={td}>{r.active ? 'yes' : 'no'}</td>
              <td style={td}><Btn label="edit" onClick={() => setDraft(r)} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      {draft && (
        <div style={{ marginTop: 14, padding: 12, background: '#FAF7EE', border: '1px solid ' + HAIR, borderRadius: 4, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <label style={{ fontSize: 11, color: INK_M, flex: 1 }}>Min words
              <input type="number" value={draft.min_words ?? ''} onChange={e => setDraft({ ...draft, min_words: e.target.value === '' ? null : Number(e.target.value) })} style={{ ...input, width: '100%' }} />
            </label>
            <label style={{ fontSize: 11, color: INK_M, flex: 1 }}>Max words
              <input type="number" value={draft.max_words ?? ''} onChange={e => setDraft({ ...draft, max_words: e.target.value === '' ? null : Number(e.target.value) })} style={{ ...input, width: '100%' }} />
            </label>
          </div>
          <label style={{ fontSize: 11, color: INK_M }}>Banned phrases
            <ChipInput value={draft.banned_phrases ?? []} onChange={v => setDraft({ ...draft, banned_phrases: v })} placeholder="e.g. nestled" />
          </label>
          <label style={{ fontSize: 11, color: INK_M }}>Must-include keywords
            <ChipInput value={draft.must_include_keywords ?? []} onChange={v => setDraft({ ...draft, must_include_keywords: v })} placeholder="e.g. Mekong" />
          </label>
          <label style={{ fontSize: 11, color: INK_M }}>Tone
            <textarea value={draft.tone ?? ''} onChange={e => setDraft({ ...draft, tone: e.target.value })} placeholder="sensory, sober, first-person" style={{ ...input, width: '100%', minHeight: 60 }} />
          </label>
          <label style={{ fontSize: 12, color: INK, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={draft.active ?? true} onChange={e => setDraft({ ...draft, active: e.target.checked })} /> Active
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn label={saving ? 'Saving…' : 'Save'} onClick={() => save(draft)} tone="primary" disabled={saving} />
            <Btn label="Cancel" onClick={() => setDraft(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- 3. Alt text ----------
function AltTextPanel({ propertyId, rows, setBanner }: { propertyId: number; rows: AltTextRow[]; setBanner: BannerFn }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Partial<AltTextRow> | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(r: Partial<AltTextRow>) {
    setSaving(true);
    try {
      await postJson('/api/marketing/media/guardrails/alt-text', {
        id: r.id ?? null,
        property_id: r.property_id ?? propertyId,
        min_chars: r.min_chars ?? 60,
        max_chars: r.max_chars ?? 125,
        must_be_descriptive: r.must_be_descriptive ?? true,
        must_include_subject: r.must_include_subject ?? true,
        banned_words: r.banned_words ?? [],
        active: r.active ?? true,
      });
      setBanner({ tone: 'ok', text: 'Alt-text rules saved.' });
      setDraft(null);
      router.refresh();
    } catch (e: any) {
      setBanner({ tone: 'err', text: 'Save failed: ' + e.message });
    } finally { setSaving(false); }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: INK_M }}>{rows.length} row{rows.length === 1 ? '' : 's'}</span>
        <Btn label="+ Add alt-text rule" tone="primary" onClick={() => setDraft({ min_chars: 60, max_chars: 125, must_be_descriptive: true, must_include_subject: true, banned_words: [], active: true })} />
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={th}>Chars</th><th style={th}>Descriptive?</th><th style={th}>Include subject?</th><th style={th}>Banned words</th><th style={th}>Active</th><th style={th}></th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td style={td}>{r.min_chars}–{r.max_chars}</td>
              <td style={td}>{r.must_be_descriptive ? 'yes' : 'no'}</td>
              <td style={td}>{r.must_include_subject ? 'yes' : 'no'}</td>
              <td style={{ ...td, color: INK_M }}>{(r.banned_words ?? []).join(', ') || '—'}</td>
              <td style={td}>{r.active ? 'yes' : 'no'}</td>
              <td style={td}><Btn label="edit" onClick={() => setDraft(r)} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      {draft && (
        <div style={{ marginTop: 14, padding: 12, background: '#FAF7EE', border: '1px solid ' + HAIR, borderRadius: 4, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <label style={{ fontSize: 11, color: INK_M, flex: 1 }}>Min chars
              <input type="number" value={draft.min_chars ?? 60} onChange={e => setDraft({ ...draft, min_chars: Number(e.target.value) })} style={{ ...input, width: '100%' }} />
            </label>
            <label style={{ fontSize: 11, color: INK_M, flex: 1 }}>Max chars
              <input type="number" value={draft.max_chars ?? 125} onChange={e => setDraft({ ...draft, max_chars: Number(e.target.value) })} style={{ ...input, width: '100%' }} />
            </label>
          </div>
          <label style={{ fontSize: 12, color: INK, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={draft.must_be_descriptive ?? true} onChange={e => setDraft({ ...draft, must_be_descriptive: e.target.checked })} /> Must be descriptive (QA blocks "photo of hotel")
          </label>
          <label style={{ fontSize: 12, color: INK, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={draft.must_include_subject ?? true} onChange={e => setDraft({ ...draft, must_include_subject: e.target.checked })} /> Must include subject
          </label>
          <label style={{ fontSize: 11, color: INK_M }}>Banned words
            <ChipInput value={draft.banned_words ?? []} onChange={v => setDraft({ ...draft, banned_words: v })} placeholder="e.g. photo" />
          </label>
          <label style={{ fontSize: 12, color: INK, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={draft.active ?? true} onChange={e => setDraft({ ...draft, active: e.target.checked })} /> Active
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn label={saving ? 'Saving…' : 'Save'} onClick={() => save(draft)} tone="primary" disabled={saving} />
            <Btn label="Cancel" onClick={() => setDraft(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- 4. Tier thresholds (matrix) ----------
function TierPanel({ rows, setBanner }: { rows: TierThresholdRow[]; setBanner: BannerFn }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, TierThresholdRow>>(() => Object.fromEntries(rows.map(r => [r.tier, { ...r }])));
  const [saving, setSaving] = useState<string | null>(null);

  async function saveOne(tier: string) {
    const r = drafts[tier];
    if (!r) return;
    setSaving(tier);
    try {
      await postJson('/api/marketing/media/guardrails/tier-thresholds', { ...r, tier });
      setBanner({ tone: 'ok', text: 'Tier ' + tier + ' saved.' });
      router.refresh();
    } catch (e: any) {
      setBanner({ tone: 'err', text: 'Save failed: ' + e.message });
    } finally { setSaving(null); }
  }

  function num(v: number | null | undefined): string { return v == null ? '' : String(v); }
  function upd(tier: string, patch: Partial<TierThresholdRow>) {
    setDrafts(d => ({ ...d, [tier]: { ...(d[tier] ?? rows.find(r => r.tier === tier)!), ...patch } }));
  }

  return (
    <div>
      <div style={{ fontSize: 11, color: INK_M, marginBottom: 8 }}>One row per usage_tier. Rule enforced only when active is true.</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Tier</th><th style={th}>Min quality</th><th style={th}>Min tech</th>
              <th style={th}>Min aesthetic</th><th style={th}>Min marketing</th>
              <th style={th}>Model release</th><th style={th}>Active</th><th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const d = drafts[r.tier] ?? r;
              return (
                <tr key={r.tier}>
                  <td style={{ ...td, fontFamily: 'ui-monospace, SFMono-Regular, monospace', color: INK_M }}>{r.tier}</td>
                  <td style={td}><input type="number" value={num(d.min_quality_index)} onChange={e => upd(r.tier, { min_quality_index: e.target.value === '' ? null : Number(e.target.value) })} style={{ ...input, width: 70 }} /></td>
                  <td style={td}><input type="number" value={num(d.min_technical)}     onChange={e => upd(r.tier, { min_technical:     e.target.value === '' ? null : Number(e.target.value) })} style={{ ...input, width: 70 }} /></td>
                  <td style={td}><input type="number" value={num(d.min_aesthetic)}     onChange={e => upd(r.tier, { min_aesthetic:     e.target.value === '' ? null : Number(e.target.value) })} style={{ ...input, width: 70 }} /></td>
                  <td style={td}><input type="number" value={num(d.min_marketing)}     onChange={e => upd(r.tier, { min_marketing:     e.target.value === '' ? null : Number(e.target.value) })} style={{ ...input, width: 70 }} /></td>
                  <td style={td}><input type="checkbox" checked={d.requires_model_release} onChange={e => upd(r.tier, { requires_model_release: e.target.checked })} /></td>
                  <td style={td}><input type="checkbox" checked={d.active}                onChange={e => upd(r.tier, { active: e.target.checked })} /></td>
                  <td style={td}><Btn label={saving === r.tier ? 'Saving…' : 'Save'} tone="primary" onClick={() => saveOne(r.tier)} disabled={saving === r.tier} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- 5. Aspect ratios (matrix) ----------
function AspectPanel({ rows, setBanner }: { rows: AspectRatioRow[]; setBanner: BannerFn }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, AspectRatioRow>>(() => Object.fromEntries(rows.map(r => [r.channel, { ...r }])));
  const [addOpen, setAddOpen] = useState(false);
  const [newRow, setNewRow] = useState<Partial<AspectRatioRow>>({ channel: '', ratio: '', active: true });
  const [saving, setSaving] = useState<string | null>(null);

  function num(v: number | null | undefined): string { return v == null ? '' : String(v); }
  function upd(channel: string, patch: Partial<AspectRatioRow>) {
    setDrafts(d => ({ ...d, [channel]: { ...(d[channel] ?? rows.find(r => r.channel === channel)!), ...patch } }));
  }

  async function saveOne(channel: string, row: Partial<AspectRatioRow>) {
    setSaving(channel);
    try {
      await postJson('/api/marketing/media/guardrails/aspect-ratios', { ...row, channel });
      setBanner({ tone: 'ok', text: 'Channel ' + channel + ' saved.' });
      setAddOpen(false);
      setNewRow({ channel: '', ratio: '', active: true });
      router.refresh();
    } catch (e: any) {
      setBanner({ tone: 'err', text: 'Save failed: ' + e.message });
    } finally { setSaving(null); }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: INK_M }}>{rows.length} channels</span>
        <Btn label="+ Add channel" tone="primary" onClick={() => setAddOpen(true)} />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr><th style={th}>Channel</th><th style={th}>Ratio</th><th style={th}>Min W (px)</th><th style={th}>Min H (px)</th><th style={th}>Notes</th><th style={th}>Active</th><th style={th}></th></tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const d = drafts[r.channel] ?? r;
              return (
                <tr key={r.channel}>
                  <td style={{ ...td, fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>{r.channel}</td>
                  <td style={td}><input value={d.ratio ?? ''}         onChange={e => upd(r.channel, { ratio: e.target.value })} style={{ ...input, width: 60 }} /></td>
                  <td style={td}><input type="number" value={num(d.min_width_px)}  onChange={e => upd(r.channel, { min_width_px:  e.target.value === '' ? null : Number(e.target.value) })} style={{ ...input, width: 90 }} /></td>
                  <td style={td}><input type="number" value={num(d.min_height_px)} onChange={e => upd(r.channel, { min_height_px: e.target.value === '' ? null : Number(e.target.value) })} style={{ ...input, width: 90 }} /></td>
                  <td style={td}><input value={d.notes ?? ''} onChange={e => upd(r.channel, { notes: e.target.value })} style={{ ...input, width: '100%' }} /></td>
                  <td style={td}><input type="checkbox" checked={d.active} onChange={e => upd(r.channel, { active: e.target.checked })} /></td>
                  <td style={td}><Btn label={saving === r.channel ? 'Saving…' : 'Save'} tone="primary" onClick={() => saveOne(r.channel, d)} disabled={saving === r.channel} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {addOpen && (
        <div style={{ marginTop: 14, padding: 12, background: '#FAF7EE', border: '1px solid ' + HAIR, borderRadius: 4, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <label style={{ fontSize: 11, color: INK_M, flex: 1 }}>Channel key
              <input value={newRow.channel ?? ''} onChange={e => setNewRow({ ...newRow, channel: e.target.value })} placeholder="e.g. yt_shorts" style={{ ...input, width: '100%' }} />
            </label>
            <label style={{ fontSize: 11, color: INK_M, flex: 1 }}>Ratio
              <input value={newRow.ratio ?? ''} onChange={e => setNewRow({ ...newRow, ratio: e.target.value })} placeholder="9:16" style={{ ...input, width: '100%' }} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <label style={{ fontSize: 11, color: INK_M, flex: 1 }}>Min width
              <input type="number" value={num(newRow.min_width_px)} onChange={e => setNewRow({ ...newRow, min_width_px: e.target.value === '' ? null : Number(e.target.value) })} style={{ ...input, width: '100%' }} />
            </label>
            <label style={{ fontSize: 11, color: INK_M, flex: 1 }}>Min height
              <input type="number" value={num(newRow.min_height_px)} onChange={e => setNewRow({ ...newRow, min_height_px: e.target.value === '' ? null : Number(e.target.value) })} style={{ ...input, width: '100%' }} />
            </label>
          </div>
          <label style={{ fontSize: 11, color: INK_M }}>Notes
            <input value={newRow.notes ?? ''} onChange={e => setNewRow({ ...newRow, notes: e.target.value })} style={{ ...input, width: '100%' }} />
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn label="Save channel" tone="primary" onClick={() => saveOne(newRow.channel ?? '', newRow)} disabled={!newRow.channel || !newRow.ratio} />
            <Btn label="Cancel" onClick={() => setAddOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- 6. Text policy (singleton) ----------
function TextPolicyPanel({ row, setBanner }: { row: TextPolicyRow | null; setBanner: BannerFn }) {
  const router = useRouter();
  const initial: TextPolicyRow = row ?? { id: 1, allow_on_social: true, allow_on_hero: false, allow_on_ota: false, max_text_area_pct: 10, blocklist_words: [], active: true };
  const [draft, setDraft] = useState<TextPolicyRow>(initial);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await postJson('/api/marketing/media/guardrails/text-policy', draft);
      setBanner({ tone: 'ok', text: 'Text policy saved.' });
      router.refresh();
    } catch (e: any) {
      setBanner({ tone: 'err', text: 'Save failed: ' + e.message });
    } finally { setSaving(false); }
  }

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 640 }}>
      <div style={{ fontSize: 11, color: INK_M }}>Governs whether images with detected text can go to each channel + how much frame area text may cover.</div>
      <label style={{ fontSize: 12, color: INK, display: 'flex', gap: 6, alignItems: 'center' }}>
        <input type="checkbox" checked={draft.allow_on_social} onChange={e => setDraft({ ...draft, allow_on_social: e.target.checked })} /> Allow on social
      </label>
      <label style={{ fontSize: 12, color: INK, display: 'flex', gap: 6, alignItems: 'center' }}>
        <input type="checkbox" checked={draft.allow_on_hero} onChange={e => setDraft({ ...draft, allow_on_hero: e.target.checked })} /> Allow on hero
      </label>
      <label style={{ fontSize: 12, color: INK, display: 'flex', gap: 6, alignItems: 'center' }}>
        <input type="checkbox" checked={draft.allow_on_ota} onChange={e => setDraft({ ...draft, allow_on_ota: e.target.checked })} /> Allow on OTA
      </label>
      <label style={{ fontSize: 11, color: INK_M }}>Max text area (% of frame)
        <input type="number" value={draft.max_text_area_pct} onChange={e => setDraft({ ...draft, max_text_area_pct: Number(e.target.value) })} style={{ ...input, width: 100, display: 'block', marginTop: 4 }} />
      </label>
      <label style={{ fontSize: 11, color: INK_M }}>Blocklist words (detected text containing any of these is auto-blocked)
        <ChipInput value={draft.blocklist_words ?? []} onChange={v => setDraft({ ...draft, blocklist_words: v })} placeholder="e.g. sale" />
      </label>
      <label style={{ fontSize: 12, color: INK, display: 'flex', gap: 6, alignItems: 'center' }}>
        <input type="checkbox" checked={draft.active} onChange={e => setDraft({ ...draft, active: e.target.checked })} /> Active
      </label>
      <div><Btn label={saving ? 'Saving…' : 'Save policy'} tone="primary" onClick={save} disabled={saving} /></div>
    </div>
  );
}

// ---------- 7. Brand palette ----------
function PalettePanel({ propertyId, rows, setBanner }: { propertyId: number; rows: BrandPaletteRow[]; setBanner: BannerFn }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, BrandPaletteRow>>(() => Object.fromEntries(rows.map(r => [r.id, { ...r }])));
  const [addOpen, setAddOpen] = useState(false);
  const [newRow, setNewRow] = useState<Partial<BrandPaletteRow>>({ color_name: '', hex: '#000000', role: 'primary', active: true });
  const [saving, setSaving] = useState<string | null>(null);

  function upd(id: string, patch: Partial<BrandPaletteRow>) {
    setDrafts(d => ({ ...d, [id]: { ...(d[id] ?? rows.find(r => r.id === id)!), ...patch } }));
  }

  async function saveOne(row: Partial<BrandPaletteRow>) {
    setSaving(row.id ?? 'new');
    try {
      await postJson('/api/marketing/media/guardrails/brand-palette', { ...row, property_id: row.property_id ?? propertyId });
      setBanner({ tone: 'ok', text: 'Swatch saved.' });
      setAddOpen(false);
      setNewRow({ color_name: '', hex: '#000000', role: 'primary', active: true });
      router.refresh();
    } catch (e: any) {
      setBanner({ tone: 'err', text: 'Save failed: ' + e.message });
    } finally { setSaving(null); }
  }

  async function removeOne(id: string) {
    if (!confirm('Delete this swatch?')) return;
    setSaving(id);
    try {
      await postJson('/api/marketing/media/guardrails/brand-palette', { id }, 'DELETE');
      setBanner({ tone: 'ok', text: 'Swatch removed.' });
      router.refresh();
    } catch (e: any) {
      setBanner({ tone: 'err', text: 'Delete failed: ' + e.message });
    } finally { setSaving(null); }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: INK_M }}>{rows.length} swatch{rows.length === 1 ? '' : 'es'}</span>
        <Btn label="+ Add colour" tone="primary" onClick={() => setAddOpen(true)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
        {rows.map(r => {
          const d = drafts[r.id] ?? r;
          return (
            <div key={r.id} style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4, padding: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <input type="color" value={d.hex} onChange={e => upd(r.id, { hex: e.target.value })} style={{ width: 36, height: 36, border: '1px solid ' + HAIR, borderRadius: 3, background: 'none' }} />
                <input value={d.color_name} onChange={e => upd(r.id, { color_name: e.target.value })} placeholder="name" style={{ ...input, flex: 1 }} />
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                <select value={d.role} onChange={e => upd(r.id, { role: e.target.value })} style={{ ...input, flex: 1 }}>
                  <option value="primary">primary</option>
                  <option value="accent">accent</option>
                  <option value="neutral">neutral</option>
                  <option value="warning">warning</option>
                </select>
                <label style={{ fontSize: 11, color: INK_M, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="checkbox" checked={d.active} onChange={e => upd(r.id, { active: e.target.checked })} /> active
                </label>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Btn label={saving === r.id ? 'Saving…' : 'Save'} tone="primary" onClick={() => saveOne(d)} disabled={saving === r.id} />
                <Btn label="Delete" tone="danger" onClick={() => removeOne(r.id)} disabled={saving === r.id} />
              </div>
            </div>
          );
        })}
      </div>

      {addOpen && (
        <div style={{ marginTop: 14, padding: 12, background: '#FAF7EE', border: '1px solid ' + HAIR, borderRadius: 4, display: 'grid', gap: 10, maxWidth: 400 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="color" value={newRow.hex ?? '#000000'} onChange={e => setNewRow({ ...newRow, hex: e.target.value })} style={{ width: 44, height: 44, border: '1px solid ' + HAIR, borderRadius: 3, background: 'none' }} />
            <input value={newRow.color_name ?? ''} onChange={e => setNewRow({ ...newRow, color_name: e.target.value })} placeholder="name (e.g. Forest)" style={{ ...input, flex: 1 }} />
          </div>
          <select value={newRow.role ?? 'primary'} onChange={e => setNewRow({ ...newRow, role: e.target.value })} style={{ ...input }}>
            <option value="primary">primary</option>
            <option value="accent">accent</option>
            <option value="neutral">neutral</option>
            <option value="warning">warning</option>
          </select>
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn label="Save" tone="primary" onClick={() => saveOne(newRow)} disabled={!newRow.color_name || !newRow.hex} />
            <Btn label="Cancel" onClick={() => setAddOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
