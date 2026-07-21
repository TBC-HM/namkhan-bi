'use client';
// app/guest/newsletters/templates/_components/TemplatesClient.tsx
// PBS 2026-07-21 · Manage Templates — table + edit drawer + duplicate + delete.
// Design: paper white #FFFFFF · hairline #E6DFCC · ink #1B1B1B · forest #084838.

import { useCallback, useMemo, useState, useTransition } from 'react';

const WHITE   = '#FFFFFF';
const HAIR    = '#E6DFCC';
const INK     = '#1B1B1B';
const INK_S   = '#5A5A5A';
const BRAND   = '#084838';
const RED     = '#B03826';
const WARM    = '#F5F0E1';

export interface TemplateRow {
  template_key: string;
  property_id: number;
  label: string | null;
  description: string | null;
  subject: string | null;
  category: string | null;
  hero_image_url: string | null;
  body_md: string | null;
  hero_asset_id: string | null;
  template_scope: 'newsletter' | 'sequence' | 'both';
  thumbnail_asset_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MediaRow {
  asset_id: string;
  original_filename: string | null;
  public_url: string | null;
  quality_index: number | null;
  primary_tier: string | null;
  category: string | null;
}

interface Props {
  propertyId: number;
  initialTemplates: TemplateRow[];
  initialMedia: MediaRow[];
}

type ScopeFilter = 'all' | 'newsletter' | 'sequence' | 'both';

export default function TemplatesClient({ propertyId, initialTemplates, initialMedia }: Props) {
  const [rows, setRows]       = useState<TemplateRow[]>(initialTemplates);
  const [scope, setScope]     = useState<ScopeFilter>('all');
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [msg, setMsg]         = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (scope === 'all') return rows;
    return rows.filter(r => r.template_scope === scope);
  }, [rows, scope]);

  const refresh = useCallback(async () => {
    const r = await fetch('/api/marketing/newsletter-templates/list', { cache: 'no-store' });
    const j = await r.json();
    if (j?.ok && Array.isArray(j.rows)) setRows(j.rows);
  }, []);

  const onDelete = useCallback((r: TemplateRow) => {
    if (!confirm(`Delete template "${r.label ?? r.template_key}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await fetch('/api/marketing/newsletter-templates/delete', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ template_key: r.template_key, property_id: r.property_id }),
      });
      const j = await res.json();
      if (j?.ok) { setMsg({ ok: true, text: `Deleted ${r.template_key}` }); await refresh(); }
      else setMsg({ ok: false, text: j?.error ?? 'delete_failed' });
    });
  }, [refresh]);

  const onDuplicate = useCallback((r: TemplateRow) => {
    const suffix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    setEditing({
      ...r,
      template_key: `${r.template_key}_copy_${suffix}`,
      label: `${r.label ?? r.template_key} (copy)`,
      created_at: '', updated_at: '',
    });
    setCreatingNew(true);
  }, []);

  const onNew = useCallback(() => {
    setEditing({
      template_key: '',
      property_id: propertyId,
      label: '',
      description: '',
      subject: '',
      category: 'newsletter',
      hero_image_url: null,
      body_md: '',
      hero_asset_id: null,
      template_scope: 'newsletter',
      thumbnail_asset_id: null,
      is_active: true,
      created_at: '',
      updated_at: '',
    });
    setCreatingNew(true);
  }, [propertyId]);

  return (
    <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>Templates</div>
          <div style={{ fontSize: 11, color: INK_S }}>
            {rows.length} total · used by newsletter Composer + sequence steps
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 11, color: INK_S }}>
            Scope&nbsp;
            <select value={scope} onChange={(e) => setScope(e.target.value as ScopeFilter)} style={selectStyle}>
              <option value="all">All</option>
              <option value="newsletter">Newsletter only</option>
              <option value="sequence">Sequence only</option>
              <option value="both">Both</option>
            </select>
          </label>
          <button onClick={onNew} style={primaryBtn}>+ New template</button>
        </div>
      </div>

      {msg && (
        <div style={{
          padding: 8, marginBottom: 12, borderRadius: 3, fontSize: 12,
          background: msg.ok ? '#EEF7F0' : '#FBEDE7',
          color: msg.ok ? BRAND : RED,
          border: `1px solid ${msg.ok ? BRAND : RED}`,
        }}>{msg.text}</div>
      )}

      <div style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#FAFAF7', borderBottom: `1px solid ${HAIR}` }}>
              <th style={th}>Template key</th>
              <th style={th}>Label</th>
              <th style={th}>Category</th>
              <th style={th}>Scope</th>
              <th style={th}>Hero</th>
              <th style={th}>Updated</th>
              <th style={{ ...th, textAlign: 'right', width: 260 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: INK_S }}>No templates match this filter.</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.template_key} style={{ borderBottom: `1px solid ${HAIR}` }}>
                <td style={{ ...td, fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 11 }}>{r.template_key}</td>
                <td style={{ ...td, fontWeight: 600 }}>{r.label ?? '—'}</td>
                <td style={td}>{r.category ?? '—'}</td>
                <td style={td}>
                  <span style={scopeBadge(r.template_scope)}>{r.template_scope}</span>
                </td>
                <td style={td}>
                  {r.hero_image_url ? (
                    <img src={r.hero_image_url} alt="" style={{ width: 40, height: 30, objectFit: 'cover', borderRadius: 2, border: `1px solid ${HAIR}` }} />
                  ) : <span style={{ color: INK_S }}>—</span>}
                </td>
                <td style={{ ...td, color: INK_S, fontSize: 11 }}>{r.updated_at ? new Date(r.updated_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short' }) : '—'}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <button onClick={() => { setEditing(r); setCreatingNew(false); }} style={actionBtn}>Edit</button>
                  <button onClick={() => onDuplicate(r)} style={actionBtn}>Duplicate</button>
                  <button onClick={() => onDelete(r)} style={{ ...actionBtn, color: RED, borderColor: RED }} disabled={busy}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditDrawer
          row={editing}
          isNew={creatingNew}
          media={initialMedia}
          onClose={() => { setEditing(null); setCreatingNew(false); }}
          onSaved={async () => { setEditing(null); setCreatingNew(false); await refresh(); }}
          onMsg={setMsg}
        />
      )}
    </div>
  );
}

function EditDrawer({
  row, isNew, media, onClose, onSaved, onMsg,
}: {
  row: TemplateRow;
  isNew: boolean;
  media: MediaRow[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onMsg: (m: { ok: boolean; text: string }) => void;
}) {
  const [templateKey, setTemplateKey] = useState(row.template_key);
  const [label, setLabel]             = useState(row.label ?? '');
  const [description, setDescription] = useState(row.description ?? '');
  const [subject, setSubject]         = useState(row.subject ?? '');
  const [bodyMd, setBodyMd]           = useState(row.body_md ?? '');
  const [scope, setScope]             = useState<'newsletter' | 'sequence' | 'both'>(row.template_scope);
  const [category, setCategory]       = useState(row.category ?? 'newsletter');
  const [heroAssetId, setHeroAssetId] = useState<string | null>(row.hero_asset_id);
  const [saving, setSaving]           = useState(false);
  const [showPicker, setShowPicker]   = useState(false);
  const [pickerFilter, setPickerFilter] = useState('');
  const [qualityMin, setQualityMin]   = useState<number>(0);

  const filteredMedia = useMemo(() => {
    const q = pickerFilter.trim().toLowerCase();
    return media.filter((m) => {
      if (qualityMin > 0 && (m.quality_index ?? 0) < qualityMin) return false;
      if (q && !(m.original_filename ?? '').toLowerCase().includes(q)) return false;
      return true;
    }).slice(0, 300);
  }, [media, pickerFilter, qualityMin]);

  const heroPreviewUrl = useMemo(() => {
    if (heroAssetId) {
      const m = media.find((mm) => mm.asset_id === heroAssetId);
      if (m?.public_url) return m.public_url;
    }
    return row.hero_image_url ?? null;
  }, [heroAssetId, media, row.hero_image_url]);

  const onSave = useCallback(async () => {
    if (!templateKey.trim()) { onMsg({ ok: false, text: 'template_key is required' }); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/marketing/newsletter-templates/save', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          template_key: templateKey.trim(),
          property_id: row.property_id,
          label, description, subject, body_md: bodyMd,
          category, template_scope: scope,
          hero_asset_id: heroAssetId,
          is_active: true,
        }),
      });
      const j = await res.json();
      if (j?.ok) { onMsg({ ok: true, text: isNew ? 'Template created' : 'Template saved' }); await onSaved(); }
      else onMsg({ ok: false, text: j?.error ?? 'save_failed' });
    } finally { setSaving(false); }
  }, [templateKey, label, description, subject, bodyMd, scope, category, heroAssetId, row.property_id, isNew, onMsg, onSaved]);

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={drawerStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>
            {isNew ? 'New template' : `Edit · ${row.template_key}`}
          </div>
          <button onClick={onClose} style={closeBtn}>×</button>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <Field label="Template key (unique · lowercase · underscores)">
            <input value={templateKey} onChange={(e) => setTemplateKey(e.target.value)} style={{ ...inputStyle, fontFamily: 'ui-monospace, SFMono-Regular, monospace' }} disabled={!isNew} placeholder="welcome_pre_arrival" />
          </Field>
          <Field label="Label (display name)">
            <input value={label} onChange={(e) => setLabel(e.target.value)} style={inputStyle} placeholder="Welcome & pre-arrival" />
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={inputStyle} />
          </Field>
          <Field label="Subject line">
            <input value={subject} onChange={(e) => setSubject(e.target.value)} style={inputStyle} placeholder="Your Namkhan stay is coming up, {{first_name}}" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Scope">
              <select value={scope} onChange={(e) => setScope(e.target.value as any)} style={selectStyle}>
                <option value="newsletter">Newsletter</option>
                <option value="sequence">Sequence</option>
                <option value="both">Both</option>
              </select>
            </Field>
            <Field label="Category">
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={selectStyle}>
                <option value="newsletter">newsletter</option>
                <option value="marketing">marketing</option>
                <option value="editorial">editorial</option>
                <option value="transactional">transactional</option>
              </select>
            </Field>
          </div>
          <Field label="Hero image (from media library)">
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 140, height: 88, background: WARM, border: `1px solid ${HAIR}`, borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                {heroPreviewUrl ? (
                  <img src={heroPreviewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ padding: 8, fontSize: 11, color: INK_S, textAlign: 'center' }}>No hero</div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button type="button" onClick={() => setShowPicker(true)} style={secondaryBtn}>Pick from library</button>
                {heroAssetId && <button type="button" onClick={() => setHeroAssetId(null)} style={{ ...secondaryBtn, color: RED, borderColor: RED }}>Clear</button>}
              </div>
            </div>
          </Field>
          <Field label="Body (markdown)">
            <textarea value={bodyMd} onChange={(e) => setBodyMd(e.target.value)} rows={10} style={{ ...inputStyle, fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 12 }} />
          </Field>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={secondaryBtn}>Cancel</button>
          <button onClick={onSave} disabled={saving} style={primaryBtn}>{saving ? 'Saving…' : 'Save template'}</button>
        </div>

        {showPicker && (
          <div style={{ ...backdropStyle, zIndex: 200 }} onClick={() => setShowPicker(false)}>
            <div style={{ ...drawerStyle, width: '92%', maxWidth: 900 }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Pick a hero from the media library</div>
                <button onClick={() => setShowPicker(false)} style={closeBtn}>×</button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                <input placeholder="Filter filename…" value={pickerFilter} onChange={(e) => setPickerFilter(e.target.value)} style={{ ...inputStyle, maxWidth: 240 }} />
                <label style={{ fontSize: 11, color: INK_S }}>
                  Min quality&nbsp;
                  <select value={qualityMin} onChange={(e) => setQualityMin(Number(e.target.value))} style={selectStyle}>
                    <option value={0}>Any</option>
                    <option value={60}>≥ 60</option>
                    <option value={75}>≥ 75</option>
                    <option value={85}>≥ 85</option>
                  </select>
                </label>
                <div style={{ fontSize: 11, color: INK_S }}>{filteredMedia.length} shown</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, maxHeight: 520, overflow: 'auto' }}>
                {filteredMedia.map((m) => (
                  <button key={m.asset_id}
                    onClick={() => { setHeroAssetId(m.asset_id); setShowPicker(false); }}
                    style={{
                      padding: 0, border: heroAssetId === m.asset_id ? `2px solid ${BRAND}` : `1px solid ${HAIR}`,
                      background: WHITE, cursor: 'pointer', borderRadius: 3, overflow: 'hidden',
                    }}
                    title={m.original_filename ?? ''}>
                    <img src={m.public_url ?? ''} alt="" style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
                    <div style={{ padding: 4, fontSize: 10, color: INK_S, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.quality_index ?? '—'} · {m.category ?? '—'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: INK_S, fontWeight: 500 }}>{label}</span>
      {children}
    </label>
  );
}

// ---------- styles ----------
const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 600, color: INK_S, textTransform: 'uppercase', letterSpacing: 0.4 };
const td: React.CSSProperties = { padding: '8px 10px', verticalAlign: 'middle', color: INK };
const inputStyle: React.CSSProperties = { width: '100%', padding: '6px 8px', border: `1px solid ${HAIR}`, borderRadius: 3, background: WHITE, color: INK, fontSize: 12, boxSizing: 'border-box', fontFamily: 'inherit' };
const selectStyle: React.CSSProperties = { padding: '4px 6px', border: `1px solid ${HAIR}`, borderRadius: 3, background: WHITE, color: INK, fontSize: 11 };
const primaryBtn: React.CSSProperties = { padding: '6px 12px', background: BRAND, color: WHITE, border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 12, fontWeight: 600 };
const secondaryBtn: React.CSSProperties = { padding: '6px 10px', background: WHITE, color: INK, border: `1px solid ${HAIR}`, borderRadius: 3, cursor: 'pointer', fontSize: 11 };
const actionBtn: React.CSSProperties = { padding: '4px 8px', background: WHITE, color: INK, border: `1px solid ${HAIR}`, borderRadius: 3, cursor: 'pointer', fontSize: 11, marginLeft: 4 };
const closeBtn: React.CSSProperties = { background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: INK_S, padding: 0, width: 24, height: 24, lineHeight: '20px' };
const backdropStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', paddingTop: 40, paddingBottom: 40 };
const drawerStyle: React.CSSProperties = { background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: 20, width: '92%', maxWidth: 720, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' };

function scopeBadge(scope: 'newsletter' | 'sequence' | 'both'): React.CSSProperties {
  const map: Record<string, { bg: string; fg: string }> = {
    newsletter: { bg: '#EEF7F0', fg: BRAND },
    sequence:   { bg: '#FFF5E5', fg: '#8B5A00' },
    both:       { bg: WARM,       fg: INK },
  };
  const c = map[scope];
  return { display: 'inline-block', padding: '2px 8px', borderRadius: 10, background: c.bg, color: c.fg, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 };
}
