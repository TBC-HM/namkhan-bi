// app/marketing/media/_client/SettingsTab.tsx
// PBS 2026-07-12 — Settings: 4 sub-tab strip (Guardrails / Channels / Reality / Prompt Categories).
// Guardrails + Channels writes go through public.fn_media_rule_upsert / fn_media_rule_delete / fn_media_channel_spec_upsert (SECURITY DEFINER).
// 2026-07-11 pm: added Prompt Categories sub-tab (media.ai_prompt_categories).
'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';

// --- types -----------------------------------------------------------
interface Rule {
  rule_id: number;
  rule_code: string;
  rule_name: string;
  rule_scope: string;
  effect: string;
  priority: number;
  message: string | null;
  remediation?: string | null;
  match_tier?: string[] | null;
  match_channel?: string[] | null;
  active?: boolean;
}
interface ChannelSpec {
  channel: string;
  display_name: string;
  image_min_width: number | null;
  image_min_height: number | null;
  image_aspect_ratio: string | null;
  image_max_size_mb: number | null;
  video_aspect_ratio: string | null;
  video_min_duration_sec: number | null;
  video_max_duration_sec: number | null;
  video_max_size_mb: number | null;
  notes: string | null;
}
interface Reality {
  property_id: number;
  location: string | null;
  region: string | null;
  architecture: string[] | null;
  materials: string[] | null;
  palette: string[] | null;
  landscape: string[] | null;
  forbidden: string[] | null;
  season_calendar: any;
}
export interface PromptCategory {
  key: string;
  display_name: string;
  property_id: number | null;
  base_prompt: string;
  default_target_tier: string;
  example_hint: string | null;
  active: boolean;
  sort_order: number;
}
interface Props {
  propertyId: number;
  channelSpecs: ChannelSpec[];
  rulesActive: Rule[];
  reality: Reality | null;
  categories: PromptCategory[];
}

// --- tokens ----------------------------------------------------------
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#1F3A2E';
const RED    = '#B03826';
const WHITE  = '#FFFFFF';

const SCOPES  = ['tier','license','channel','people','consent','duration','aspect_ratio','tag'];
const EFFECTS = ['allow','deny','require_approval','warn'];
const TIERS   = ['tier_website_hero','tier_ota_profile','tier_social_pool','tier_internal','tier_logos','tier_archive'];
const AI_TIERS = ['tier_social_pool','tier_internal'];

type TabKey = 'rules' | 'channels' | 'reality' | 'categories';

function csvIn(v: string[] | null | undefined): string { return (v ?? []).join(', '); }
function csvOut(s: string): string[] { return s.split(',').map(x => x.trim()).filter(Boolean); }

// --- root ------------------------------------------------------------
export default function SettingsTab({ propertyId, channelSpecs, rulesActive, reality, categories }: Props) {
  const [tab, setTab] = useState<TabKey>('rules');
  const [banner, setBanner] = useState<{ tone: 'ok'|'err'; text: string } | null>(null);

  const bannerBg = banner?.tone === 'ok' ? '#EAF3EA' : '#FBE9E7';
  const bannerFg = banner?.tone === 'ok' ? FOREST : RED;

  const tabs: Array<{ key: TabKey; label: string; count: number }> = [
    { key: 'rules',      label: 'Guardrails',        count: rulesActive.length },
    { key: 'channels',   label: 'Output channels',   count: channelSpecs.length },
    { key: 'reality',    label: 'Reality profile',   count: reality ? 1 : 0 },
    { key: 'categories', label: 'Prompt categories', count: (categories ?? []).length },
  ];

  return (
    <div>
      {banner && (
        <div style={{ padding:'10px 14px', background:bannerBg, color:bannerFg, border:'1px solid '+HAIR, borderRadius:4, marginBottom:12, fontSize:12 }}>
          {banner.text}
          <button onClick={() => setBanner(null)} style={{ marginLeft:8, background:'none', border:'none', cursor:'pointer', color:INK_M }}>x</button>
        </div>
      )}

      {/* Inner tab strip */}
      <div style={{ display:'flex', gap:4, borderBottom:'1px solid '+HAIR, marginBottom:16 }}>
        {tabs.map(t => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding:'8px 14px', fontSize:11, letterSpacing:'0.05em', textTransform:'uppercase',
                border:'none', background:'transparent',
                color: active ? FOREST : INK_M,
                borderBottom: active ? '2px solid '+FOREST : '2px solid transparent',
                fontWeight: active ? 700 : 500, cursor:'pointer', marginBottom:-1,
              }}
            >
              {t.label} <span style={{ opacity:0.6 }}>· {t.count}</span>
            </button>
          );
        })}
      </div>

      {tab === 'rules'      && <GuardrailsPanel        rows={rulesActive} setBanner={setBanner} />}
      {tab === 'channels'   && <ChannelsPanel          rows={channelSpecs} setBanner={setBanner} />}
      {tab === 'reality'    && <RealityPanel           propertyId={propertyId} reality={reality} setBanner={setBanner} />}
      {tab === 'categories' && <PromptCategoriesPanel  propertyId={propertyId} rows={categories ?? []} setBanner={setBanner} />}
    </div>
  );
}

// --- Guardrails panel -----------------------------------------------
type BannerFn = React.Dispatch<React.SetStateAction<{ tone: 'ok'|'err'; text: string } | null>>;

function GuardrailsPanel({ rows, setBanner }: { rows: Rule[]; setBanner: BannerFn }) {
  const router = useRouter();
  const [editing, setEditing] = useState<null | Partial<Rule> & { _mode: 'add' | 'edit' }>(null);
  const [saving, setSaving] = useState(false);

  function openAdd() {
    setEditing({ _mode:'add', rule_code:'', rule_name:'', rule_scope:'tier', effect:'warn', match_tier:[], match_channel:[], message:'', remediation:'', priority:100, active:true });
  }
  function openEdit(r: Rule) {
    setEditing({ _mode:'edit', ...r });
  }
  async function save() {
    if (!editing) return;
    setBanner(null);
    if (!editing.rule_code || !editing.rule_name || !editing.message) {
      setBanner({ tone:'err', text:'rule_code, rule_name and message are required.' }); return;
    }
    setSaving(true);
    try {
      const payload: any = { ...editing };
      delete payload._mode;
      const res = await fetch('/api/marketing/media/rule-upsert', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) { setBanner({ tone:'err', text:`Save failed: ${j.error ?? res.statusText}` }); return; }
      setBanner({ tone:'ok', text:`Rule saved (id ${j.rule_id}).` });
      setEditing(null);
      router.refresh();
    } catch (e:any) {
      setBanner({ tone:'err', text:`Save failed: ${e.message}` });
    } finally { setSaving(false); }
  }
  async function del(rule_id: number, rule_code: string) {
    if (!confirm(`Delete rule "${rule_code}"? This cannot be undone.`)) return;
    setBanner(null);
    try {
      const res = await fetch('/api/marketing/media/rule-delete', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ rule_id }),
      });
      const j = await res.json();
      if (!res.ok) { setBanner({ tone:'err', text:`Delete failed: ${j.error ?? res.statusText}` }); return; }
      setBanner({ tone:'ok', text:`Rule ${rule_code} deleted.` });
      router.refresh();
    } catch (e:any) {
      setBanner({ tone:'err', text:`Delete failed: ${e.message}` });
    }
  }

  const btn = (label: string, onClick: () => void, tone: 'primary'|'danger'|'ghost' = 'ghost') => (
    <button
      onClick={onClick}
      style={{
        padding:'4px 10px', fontSize:11, borderRadius:3, cursor:'pointer',
        border: '1px solid ' + (tone==='primary'?FOREST:tone==='danger'?RED:HAIR),
        background: tone==='primary'?FOREST:tone==='danger'?WHITE:WHITE,
        color:      tone==='primary'?WHITE:tone==='danger'?RED:INK,
      }}
    >{label}</button>
  );

  return (
    <div style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:6, padding:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <span style={{ fontSize:11, color:INK_M }}>{rows.length} active rules · source: public.v_media_rules_active · writes: media.media_usage_rules</span>
        {btn('+ Add rule', openAdd, 'primary')}
      </div>

      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', fontSize:11, borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ textAlign:'left', color:INK_M }}>
              <th style={th}>Code</th>
              <th style={th}>Name</th>
              <th style={th}>Scope</th>
              <th style={th}>Effect</th>
              <th style={th}>Tier(s)</th>
              <th style={th}>Channel(s)</th>
              <th style={th}>Prio</th>
              <th style={th}>Message</th>
              <th style={{ ...th, width:110 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.rule_id}>
                <td style={{ ...td, fontFamily:'ui-monospace, SFMono-Regular, monospace' }}>{r.rule_code}</td>
                <td style={td}>{r.rule_name}</td>
                <td style={td}>{r.rule_scope}</td>
                <td style={{ ...td, color: r.effect === 'deny' ? RED : r.effect === 'require_approval' ? '#8A6A00' : INK }}>{r.effect}</td>
                <td style={{ ...td, color:INK_M }}>{(r.match_tier ?? []).join(', ') || '—'}</td>
                <td style={{ ...td, color:INK_M }}>{(r.match_channel ?? []).join(', ') || '—'}</td>
                <td style={td}>{r.priority}</td>
                <td style={{ ...td, color:INK_M, maxWidth:260, overflow:'hidden', textOverflow:'ellipsis' }}>{r.message ?? ''}</td>
                <td style={{ ...td, whiteSpace:'nowrap', display:'flex', gap:4 }}>
                  {btn('Edit', () => openEdit(r), 'ghost')}
                  {btn('Delete', () => del(r.rule_id, r.rule_code), 'danger')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div style={{ marginTop:16, padding:14, border:'1px solid '+HAIR, borderRadius:6, background:'#FAF6EC' }}>
          <div style={{ fontSize:12, fontWeight:700, color:INK, marginBottom:10 }}>
            {editing._mode === 'add' ? 'Add rule' : `Edit rule ${editing.rule_code}`}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <Field label="rule_code">
              <input value={editing.rule_code ?? ''} onChange={e => setEditing({ ...editing, rule_code: e.target.value })} style={inp} />
            </Field>
            <Field label="rule_name">
              <input value={editing.rule_name ?? ''} onChange={e => setEditing({ ...editing, rule_name: e.target.value })} style={inp} />
            </Field>
            <Field label="rule_scope">
              <select value={editing.rule_scope ?? 'tier'} onChange={e => setEditing({ ...editing, rule_scope: e.target.value })} style={inp}>
                {SCOPES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="effect">
              <select value={editing.effect ?? 'warn'} onChange={e => setEditing({ ...editing, effect: e.target.value })} style={inp}>
                {EFFECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="match_tier (multi-select)">
              <select
                multiple size={4}
                value={editing.match_tier ?? []}
                onChange={e => setEditing({ ...editing, match_tier: Array.from(e.target.selectedOptions).map(o => o.value) })}
                style={{ ...inp, height:88 }}
              >
                {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="match_channel (comma-separated)">
              <input
                value={csvIn(editing.match_channel)}
                onChange={e => setEditing({ ...editing, match_channel: csvOut(e.target.value) })}
                placeholder="instagram_feed, tiktok"
                style={inp}
              />
            </Field>
            <Field label="priority (0–999)">
              <input type="number" value={editing.priority ?? 100} onChange={e => setEditing({ ...editing, priority: Number(e.target.value) })} style={inp} />
            </Field>
            <Field label="active">
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:INK }}>
                <input type="checkbox" checked={editing.active ?? true} onChange={e => setEditing({ ...editing, active: e.target.checked })} />
                {editing.active ? 'active' : 'inactive'}
              </label>
            </Field>
            <div style={{ gridColumn:'1 / -1' }}>
              <Field label="message">
                <textarea value={editing.message ?? ''} onChange={e => setEditing({ ...editing, message: e.target.value })} rows={2} style={{ ...inp, resize:'vertical' }} />
              </Field>
            </div>
            <div style={{ gridColumn:'1 / -1' }}>
              <Field label="remediation (optional)">
                <textarea value={editing.remediation ?? ''} onChange={e => setEditing({ ...editing, remediation: e.target.value })} rows={2} style={{ ...inp, resize:'vertical' }} />
              </Field>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:12 }}>
            <button
              onClick={save}
              disabled={saving}
              style={{ padding:'8px 16px', fontSize:12, fontWeight:600, background:FOREST, color:WHITE, border:'none', borderRadius:4, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}
            >{saving ? 'Saving...' : (editing._mode === 'add' ? 'Create rule' : 'Save changes')}</button>
            <button
              onClick={() => setEditing(null)}
              style={{ padding:'8px 16px', fontSize:12, background:WHITE, color:INK, border:'1px solid '+HAIR, borderRadius:4, cursor:'pointer' }}
            >Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Channels panel --------------------------------------------------
function ChannelsPanel({ rows, setBanner }: { rows: ChannelSpec[]; setBanner: BannerFn }) {
  const router = useRouter();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<ChannelSpec>>({});
  const [saving, setSaving] = useState(false);

  function openEdit(r: ChannelSpec) {
    setEditingKey(r.channel);
    setDraft({ ...r });
  }
  async function save() {
    if (!editingKey) return;
    setBanner(null);
    setSaving(true);
    try {
      const res = await fetch('/api/marketing/media/channel-upsert', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          channel: editingKey,
          image_min_width: draft.image_min_width ?? null,
          image_min_height: draft.image_min_height ?? null,
          image_aspect_ratio: draft.image_aspect_ratio ?? null,
          image_max_size_mb: draft.image_max_size_mb ?? null,
          video_min_duration_sec: draft.video_min_duration_sec ?? null,
          video_max_duration_sec: draft.video_max_duration_sec ?? null,
          video_aspect_ratio: draft.video_aspect_ratio ?? null,
          video_max_size_mb: draft.video_max_size_mb ?? null,
          notes: draft.notes ?? '',
        }),
      });
      const j = await res.json();
      if (!res.ok) { setBanner({ tone:'err', text:`Save failed: ${j.error ?? res.statusText}` }); return; }
      setBanner({ tone:'ok', text:`Channel ${editingKey} saved.` });
      setEditingKey(null);
      router.refresh();
    } catch (e:any) {
      setBanner({ tone:'err', text:`Save failed: ${e.message}` });
    } finally { setSaving(false); }
  }

  return (
    <div style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:6, padding:16 }}>
      <div style={{ marginBottom:10, fontSize:11, color:INK_M }}>
        {rows.length} channels · source: public.v_media_channel_specs · writes: media.media_channel_specs (editable fields only)
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', fontSize:11, borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ textAlign:'left', color:INK_M }}>
              <th style={th}>Channel</th>
              <th style={th}>Label</th>
              <th style={th}>Img aspect</th>
              <th style={th}>Img min WxH</th>
              <th style={th}>Img max MB</th>
              <th style={th}>Video aspect</th>
              <th style={th}>Dur sec (min-max)</th>
              <th style={{ ...th, width:70 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const isEdit = editingKey === r.channel;
              return (
                <Fragment key={r.channel}>
                  <tr>
                    <td style={{ ...td, fontFamily:'ui-monospace, SFMono-Regular, monospace' }}>{r.channel}</td>
                    <td style={td}>{r.display_name}</td>
                    <td style={td}>{r.image_aspect_ratio ?? '—'}</td>
                    <td style={td}>{(r.image_min_width ?? '—') + ' x ' + (r.image_min_height ?? '—')}</td>
                    <td style={td}>{r.image_max_size_mb ?? '—'}</td>
                    <td style={td}>{r.video_aspect_ratio ?? '—'}</td>
                    <td style={td}>{(r.video_min_duration_sec ?? '—') + '–' + (r.video_max_duration_sec ?? '—')}</td>
                    <td style={td}>
                      <button
                        onClick={() => (isEdit ? setEditingKey(null) : openEdit(r))}
                        style={{ padding:'4px 10px', fontSize:11, background:WHITE, color:INK, border:'1px solid '+HAIR, borderRadius:3, cursor:'pointer' }}
                      >{isEdit ? 'Close' : 'Edit'}</button>
                    </td>
                  </tr>
                  {isEdit && (
                    <tr>
                      <td colSpan={8} style={{ padding:14, background:'#FAF6EC', borderTop:'1px solid '+HAIR }}>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10 }}>
                          <Field label="image_min_width">
                            <input type="number" value={draft.image_min_width ?? ''} onChange={e => setDraft({ ...draft, image_min_width: e.target.value === '' ? null : Number(e.target.value) })} style={inp} />
                          </Field>
                          <Field label="image_min_height">
                            <input type="number" value={draft.image_min_height ?? ''} onChange={e => setDraft({ ...draft, image_min_height: e.target.value === '' ? null : Number(e.target.value) })} style={inp} />
                          </Field>
                          <Field label="image_aspect_ratio">
                            <input value={draft.image_aspect_ratio ?? ''} onChange={e => setDraft({ ...draft, image_aspect_ratio: e.target.value })} placeholder="e.g. 1:1" style={inp} />
                          </Field>
                          <Field label="image_max_size_mb">
                            <input type="number" step="0.1" value={draft.image_max_size_mb ?? ''} onChange={e => setDraft({ ...draft, image_max_size_mb: e.target.value === '' ? null : Number(e.target.value) })} style={inp} />
                          </Field>
                          <Field label="video_min_duration_sec">
                            <input type="number" step="0.1" value={draft.video_min_duration_sec ?? ''} onChange={e => setDraft({ ...draft, video_min_duration_sec: e.target.value === '' ? null : Number(e.target.value) })} style={inp} />
                          </Field>
                          <Field label="video_max_duration_sec">
                            <input type="number" step="0.1" value={draft.video_max_duration_sec ?? ''} onChange={e => setDraft({ ...draft, video_max_duration_sec: e.target.value === '' ? null : Number(e.target.value) })} style={inp} />
                          </Field>
                          <Field label="video_aspect_ratio">
                            <input value={draft.video_aspect_ratio ?? ''} onChange={e => setDraft({ ...draft, video_aspect_ratio: e.target.value })} placeholder="e.g. 9:16" style={inp} />
                          </Field>
                          <Field label="video_max_size_mb">
                            <input type="number" step="0.1" value={draft.video_max_size_mb ?? ''} onChange={e => setDraft({ ...draft, video_max_size_mb: e.target.value === '' ? null : Number(e.target.value) })} style={inp} />
                          </Field>
                          <div style={{ gridColumn:'1 / -1' }}>
                            <Field label="notes">
                              <textarea value={draft.notes ?? ''} onChange={e => setDraft({ ...draft, notes: e.target.value })} rows={2} style={{ ...inp, resize:'vertical' }} />
                            </Field>
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:8, marginTop:12 }}>
                          <button
                            onClick={save} disabled={saving}
                            style={{ padding:'8px 16px', fontSize:12, fontWeight:600, background:FOREST, color:WHITE, border:'none', borderRadius:4, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}
                          >{saving ? 'Saving...' : 'Save channel'}</button>
                          <button
                            onClick={() => setEditingKey(null)}
                            style={{ padding:'8px 16px', fontSize:12, background:WHITE, color:INK, border:'1px solid '+HAIR, borderRadius:4, cursor:'pointer' }}
                          >Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Reality panel ---------------------------------------------------
function RealityPanel({ propertyId, reality, setBanner }: { propertyId: number; reality: Reality | null; setBanner: BannerFn }) {
  const [loc, setLoc] = useState(reality?.location ?? '');
  const [region, setRegion] = useState(reality?.region ?? '');
  const [arch, setArch] = useState(csvIn(reality?.architecture));
  const [mats, setMats] = useState(csvIn(reality?.materials));
  const [palette, setPalette] = useState(csvIn(reality?.palette));
  const [land, setLand] = useState(csvIn(reality?.landscape));
  const [forbidden, setForbidden] = useState(csvIn(reality?.forbidden));
  const [season, setSeason] = useState(JSON.stringify(reality?.season_calendar ?? {}, null, 2));
  const [saving, setSaving] = useState(false);

  async function saveReality() {
    setBanner(null);
    let seasonParsed: any;
    try { seasonParsed = JSON.parse(season || '{}'); }
    catch { setBanner({ tone:'err', text:'season_calendar is not valid JSON.' }); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/marketing/media/reality-upsert', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          location: loc || null, region: region || null,
          architecture: csvOut(arch), materials: csvOut(mats),
          palette: csvOut(palette), landscape: csvOut(land),
          forbidden: csvOut(forbidden), season_calendar: seasonParsed,
        }),
      });
      const j = await res.json();
      if (!res.ok) { setBanner({ tone:'err', text:`Failed: ${j.error ?? res.statusText}` }); return; }
      setBanner({ tone:'ok', text:'Reality profile saved.' });
    } catch (e:any) { setBanner({ tone:'err', text:`Failed: ${e.message}` }); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:6, padding:16 }}>
      <div style={{ marginBottom:10, fontSize:11, color:INK_M }}>
        Property {propertyId} · source: public.v_reality_profile · writes: media.reality_profile
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <Field label="Location"><input value={loc}    onChange={e => setLoc(e.target.value)}    style={inp} /></Field>
        <Field label="Region">  <input value={region} onChange={e => setRegion(e.target.value)} style={inp} /></Field>
        <Field label="Architecture (comma-separated)"><textarea value={arch}      onChange={e => setArch(e.target.value)}      rows={2} style={{ ...inp, resize:'vertical' }} /></Field>
        <Field label="Materials">                     <textarea value={mats}      onChange={e => setMats(e.target.value)}      rows={2} style={{ ...inp, resize:'vertical' }} /></Field>
        <Field label="Palette">                       <textarea value={palette}   onChange={e => setPalette(e.target.value)}   rows={2} style={{ ...inp, resize:'vertical' }} /></Field>
        <Field label="Landscape">                     <textarea value={land}      onChange={e => setLand(e.target.value)}      rows={2} style={{ ...inp, resize:'vertical' }} /></Field>
        <div style={{ gridColumn:'1 / -1' }}>
          <Field label="Forbidden (never generate these)">
            <textarea value={forbidden} onChange={e => setForbidden(e.target.value)} rows={2} style={{ ...inp, resize:'vertical' }} />
          </Field>
        </div>
        <div style={{ gridColumn:'1 / -1' }}>
          <Field label="Season calendar (JSON)">
            <textarea value={season} onChange={e => setSeason(e.target.value)} rows={4} spellCheck={false} style={{ ...inp, fontFamily:'ui-monospace, SFMono-Regular, monospace', resize:'vertical' }} />
          </Field>
        </div>
        <div style={{ gridColumn:'1 / -1' }}>
          <button
            onClick={saveReality} disabled={saving}
            style={{ padding:'8px 16px', fontSize:12, fontWeight:600, background:FOREST, color:WHITE, border:'none', borderRadius:4, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}
          >{saving ? 'Saving...' : 'Save reality profile'}</button>
        </div>
      </div>
    </div>
  );
}

// --- Prompt Categories panel (NEW) -----------------------------------
function PromptCategoriesPanel({ propertyId, rows, setBanner }: { propertyId: number; rows: PromptCategory[]; setBanner: BannerFn }) {
  const router = useRouter();
  const [editing, setEditing] = useState<null | (Partial<PromptCategory> & { _mode: 'add' | 'edit' })>(null);
  const [saving, setSaving] = useState(false);

  function openAdd() {
    setEditing({
      _mode:'add',
      key:'', display_name:'', base_prompt:'',
      default_target_tier:'tier_social_pool',
      example_hint:'', active:true, sort_order:100,
      property_id: propertyId,
    });
  }
  function openEdit(r: PromptCategory) {
    setEditing({ _mode:'edit', ...r });
  }
  async function save() {
    if (!editing) return;
    setBanner(null);
    if (!editing.key || !editing.display_name || !editing.base_prompt) {
      setBanner({ tone:'err', text:'key, display_name and base_prompt are required.' }); return;
    }
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(String(editing.key))) {
      setBanner({ tone:'err', text:'key must be lowercase snake_case (e.g. in_room_wide).' }); return;
    }
    setSaving(true);
    try {
      const payload: any = { ...editing };
      delete payload._mode;
      const res = await fetch('/api/marketing/media/prompt-category-upsert', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) { setBanner({ tone:'err', text:`Save failed: ${j.error ?? res.statusText}` }); return; }
      setBanner({ tone:'ok', text:`Category "${j.key}" saved.` });
      setEditing(null);
      router.refresh();
    } catch (e:any) {
      setBanner({ tone:'err', text:`Save failed: ${e.message}` });
    } finally { setSaving(false); }
  }
  async function del(key: string) {
    if (!confirm(`Delete category "${key}"? This cannot be undone.`)) return;
    setBanner(null);
    try {
      const res = await fetch('/api/marketing/media/prompt-category-delete', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ key }),
      });
      const j = await res.json();
      if (!res.ok) { setBanner({ tone:'err', text:`Delete failed: ${j.error ?? res.statusText}` }); return; }
      setBanner({ tone:'ok', text:`Category "${key}" deleted.` });
      router.refresh();
    } catch (e:any) {
      setBanner({ tone:'err', text:`Delete failed: ${e.message}` });
    }
  }

  const btn = (label: string, onClick: () => void, tone: 'primary'|'danger'|'ghost' = 'ghost') => (
    <button
      onClick={onClick}
      style={{
        padding:'4px 10px', fontSize:11, borderRadius:3, cursor:'pointer',
        border: '1px solid ' + (tone==='primary'?FOREST:tone==='danger'?RED:HAIR),
        background: tone==='primary'?FOREST:tone==='danger'?WHITE:WHITE,
        color:      tone==='primary'?WHITE:tone==='danger'?RED:INK,
      }}
    >{label}</button>
  );

  const sorted = [...rows].sort((a, b) => (a.sort_order ?? 100) - (b.sort_order ?? 100) || a.key.localeCompare(b.key));

  return (
    <div style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:6, padding:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <span style={{ fontSize:11, color:INK_M }}>
          {rows.length} categories · source: public.v_ai_prompt_categories · writes: media.ai_prompt_categories
        </span>
        {btn('+ Add category', openAdd, 'primary')}
      </div>

      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', fontSize:11, borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ textAlign:'left', color:INK_M }}>
              <th style={th}>Sort</th>
              <th style={th}>Key</th>
              <th style={th}>Display name</th>
              <th style={th}>Scope</th>
              <th style={th}>Target tier</th>
              <th style={th}>Active</th>
              <th style={{ ...th, width:110 }}></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => (
              <tr key={r.key}>
                <td style={td}>{r.sort_order}</td>
                <td style={{ ...td, fontFamily:'ui-monospace, SFMono-Regular, monospace' }}>{r.key}</td>
                <td style={td}>{r.display_name}</td>
                <td style={{ ...td, color:INK_M }}>{r.property_id === null ? 'global' : `property ${r.property_id}`}</td>
                <td style={{ ...td, color:INK_M }}>{r.default_target_tier}</td>
                <td style={{ ...td, color: r.active ? FOREST : RED }}>{r.active ? 'yes' : 'no'}</td>
                <td style={{ ...td, whiteSpace:'nowrap', display:'flex', gap:4 }}>
                  {btn('Edit', () => openEdit(r), 'ghost')}
                  {btn('Delete', () => del(r.key), 'danger')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div style={{ marginTop:16, padding:14, border:'1px solid '+HAIR, borderRadius:6, background:'#FAF6EC' }}>
          <div style={{ fontSize:12, fontWeight:700, color:INK, marginBottom:10 }}>
            {editing._mode === 'add' ? 'Add category' : `Edit category ${editing.key}`}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <Field label="key (lowercase snake_case, immutable after create)">
              <input
                value={editing.key ?? ''}
                onChange={e => setEditing({ ...editing, key: e.target.value })}
                disabled={editing._mode === 'edit'}
                style={inp}
              />
            </Field>
            <Field label="display_name">
              <input value={editing.display_name ?? ''} onChange={e => setEditing({ ...editing, display_name: e.target.value })} style={inp} />
            </Field>
            <Field label="default_target_tier">
              <select value={editing.default_target_tier ?? 'tier_social_pool'} onChange={e => setEditing({ ...editing, default_target_tier: e.target.value })} style={inp}>
                {AI_TIERS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="scope">
              <select
                value={editing.property_id == null ? 'global' : 'property'}
                onChange={e => setEditing({ ...editing, property_id: e.target.value === 'global' ? null : propertyId })}
                style={inp}
              >
                <option value="global">global (all properties)</option>
                <option value="property">property {propertyId} only</option>
              </select>
            </Field>
            <Field label="sort_order">
              <input type="number" value={editing.sort_order ?? 100} onChange={e => setEditing({ ...editing, sort_order: Number(e.target.value) })} style={inp} />
            </Field>
            <Field label="active">
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:INK }}>
                <input type="checkbox" checked={editing.active ?? true} onChange={e => setEditing({ ...editing, active: e.target.checked })} />
                {editing.active ? 'active' : 'inactive'}
              </label>
            </Field>
            <div style={{ gridColumn:'1 / -1' }}>
              <Field label="example_hint (shown as prompt placeholder)">
                <input value={editing.example_hint ?? ''} onChange={e => setEditing({ ...editing, example_hint: e.target.value })} style={inp} />
              </Field>
            </div>
            <div style={{ gridColumn:'1 / -1' }}>
              <Field label="base_prompt (auto-prepended to every user prompt in this category)">
                <textarea
                  value={editing.base_prompt ?? ''}
                  onChange={e => setEditing({ ...editing, base_prompt: e.target.value })}
                  rows={6}
                  style={{ ...inp, resize:'vertical', fontFamily:'ui-monospace, SFMono-Regular, monospace', fontSize:11 }}
                />
              </Field>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:12 }}>
            <button
              onClick={save} disabled={saving}
              style={{ padding:'8px 16px', fontSize:12, fontWeight:600, background:FOREST, color:WHITE, border:'none', borderRadius:4, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}
            >{saving ? 'Saving...' : (editing._mode === 'add' ? 'Create category' : 'Save changes')}</button>
            <button
              onClick={() => setEditing(null)}
              style={{ padding:'8px 16px', fontSize:12, background:WHITE, color:INK, border:'1px solid '+HAIR, borderRadius:4, cursor:'pointer' }}
            >Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- helpers ---------------------------------------------------------
const th: React.CSSProperties = { padding:'6px 8px', borderBottom:'1px solid '+HAIR, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', fontSize:10 };
const td: React.CSSProperties = { padding:'6px 8px', borderBottom:'1px solid '+HAIR, verticalAlign:'top' };
const inp: React.CSSProperties = { width:'100%', padding:'6px 10px', fontSize:12, border:'1px solid '+HAIR, borderRadius:4, background:WHITE, color:INK };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:10, color:INK_M, marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</label>
      {children}
    </div>
  );
}
