'use client';

// components/marketing/AssetDetailDrawer.tsx
// Slides in from the right when an AssetCard fires 'asset:open'.
// Mounted globally via the marketing layout — listens for window 'asset:open' events.
//
// 2026-05-09 (cockpit_bugs id=4): expanded into a full agency-grade media
// drawer. Mirrors the guest profile drawer pattern at
// app/guest/directory/_components/ProfileDrawer.tsx (slide-in, escape to
// close, keyboard a11y). Adds:
//   • Full-size preview (web_2k > thumbnail > raw_path fallback)
//   • Metadata panel: dimensions, file size, photographer, captured_at,
//     license + expiry, property_area, qc_score, raw_path / master_path
//   • Tags + tier pills
//   • Usage history pulled from marketing.media_usage_log + campaign_assets
//   • CTAs: Save to project · Replace · Move to folder · Ask AI · Download
//   • Edit form (PATCH /api/marketing/media/[asset_id]) — caption, alt,
//     tags, license, expiry, property_area, do_not_modify

import { useEffect, useState } from 'react';

interface UsageLogRow {
  log_id: number;
  used_in?: string | null;
  channel?: string | null;
  campaign_name?: string | null;
  external_ref?: string | null;
  placement_url?: string | null;
  used_at?: string | null;
  used_by_agent?: string | null;
  first_used_at?: string | null;
  removed_at?: string | null;
}

interface CampaignAssetRow {
  campaign_id: string;
  slot_order: number;
  caption_per_slot?: string | null;
  alt_text_per_slot?: string | null;
  created_at?: string | null;
}

interface AssetDetail {
  asset_id: string;
  original_filename?: string | null;
  caption?: string | null;
  alt_text?: string | null;
  primary_tier?: string | null;
  secondary_tiers?: string[] | null;
  tags?: string[] | null;
  photographer?: string | null;
  captured_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  license_type?: string | null;
  license_expiry?: string | null;
  width_px?: number | null;
  height_px?: number | null;
  file_size_bytes?: number | null;
  raw_path?: string | null;
  master_path?: string | null;
  property_area?: string | null;
  do_not_modify?: boolean | null;
  has_identifiable_people?: boolean | null;
  qc_score?: number | null;
  qc_flags?: string[] | null;
  ai_confidence?: number | null;
  status?: string | null;
  usage_rights?: string[] | null;
  renders?: Record<string, string> | null;
  usage_log?: UsageLogRow[];
  campaign_assets?: CampaignAssetRow[];
}

const TIER_LABEL: Record<string, string> = {
  tier_ota_profile:  'OTA Profile',
  tier_website_hero: 'Website Hero',
  tier_social_pool:  'Social Pool',
  tier_internal:     'Internal',
  tier_archive:      'Archive / Logo',
};

const TIER_OPTIONS = [
  'tier_ota_profile',
  'tier_website_hero',
  'tier_social_pool',
  'tier_internal',
  'tier_archive',
];

const LICENSE_OPTIONS = [
  'owned',
  'paid_ads',
  'press',
  'limited',
  'expired',
];

function fmtBytes(b?: number | null): string {
  if (!b) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function AssetDetailDrawer() {
  const [open, setOpen] = useState(false);
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [form, setForm] = useState<{
    caption: string;
    alt_text: string;
    tags: string;
    primary_tier: string;
    license_type: string;
    license_expiry: string;
    property_area: string;
    photographer: string;
    do_not_modify: boolean;
  }>({
    caption: '', alt_text: '', tags: '', primary_tier: '',
    license_type: '', license_expiry: '', property_area: '',
    photographer: '', do_not_modify: false,
  });

  function loadFormFromAsset(a: AssetDetail) {
    setForm({
      caption:        a.caption ?? '',
      alt_text:       a.alt_text ?? '',
      tags:           (a.tags ?? []).join(', '),
      primary_tier:   a.primary_tier ?? '',
      license_type:   a.license_type ?? '',
      license_expiry: a.license_expiry ?? '',
      property_area:  a.property_area ?? '',
      photographer:   a.photographer ?? '',
      do_not_modify:  !!a.do_not_modify,
    });
  }

  useEffect(() => {
    async function onOpen(e: Event) {
      const ce = e as CustomEvent<{ asset_id: string; asset?: AssetDetail }>;
      setOpen(true);
      setEditing(false);
      setSaveMsg(null);
      if (ce.detail?.asset) {
        setAsset(ce.detail.asset);
        loadFormFromAsset(ce.detail.asset);
        return;
      }
      // Fetch detail
      setLoading(true);
      try {
        const res = await fetch(`/api/marketing/asset/${encodeURIComponent(ce.detail.asset_id)}`);
        if (res.ok) {
          const data = await res.json();
          setAsset(data);
          loadFormFromAsset(data);
        } else {
          const stub: AssetDetail = { asset_id: ce.detail.asset_id };
          setAsset(stub);
          loadFormFromAsset(stub);
        }
      } catch {
        const stub: AssetDetail = { asset_id: ce.detail.asset_id };
        setAsset(stub);
        loadFormFromAsset(stub);
      } finally {
        setLoading(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('asset:open', onOpen);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('asset:open', onOpen);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  function publicRenderUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    return `${base}/storage/v1/object/public/media-renders/${path}`;
  }

  function rawDownloadUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    // raw bucket is private — use the public render fallback for download UX.
    // master_path lives in a public bucket.
    return `${base}/storage/v1/object/public/media-renders/${path}`;
  }

  async function save() {
    if (!asset) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
      const body = {
        caption:        form.caption || null,
        alt_text:       form.alt_text || null,
        tags,
        primary_tier:   form.primary_tier || null,
        license_type:   form.license_type || null,
        license_expiry: form.license_expiry || null,
        property_area:  form.property_area || null,
        photographer:   form.photographer || null,
        do_not_modify:  form.do_not_modify,
      };
      const res = await fetch(`/api/marketing/media/${encodeURIComponent(asset.asset_id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setSaveMsg(`Save failed: ${j.error ?? res.statusText}`);
      } else {
        setSaveMsg('Saved.');
        // merge updated fields back
        setAsset((prev) => prev ? { ...prev, ...j.asset } : prev);
        setEditing(false);
      }
    } catch (e: any) {
      setSaveMsg(`Save failed: ${e?.message ?? e}`);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const previewUrl = asset && (
    publicRenderUrl(asset.renders?.web_2k) ??
    publicRenderUrl(asset.renders?.thumbnail) ??
    rawDownloadUrl(asset.master_path)
  );
  const downloadUrl = asset && (
    publicRenderUrl(asset.renders?.web_2k) ??
    rawDownloadUrl(asset.master_path) ??
    publicRenderUrl(asset.renders?.thumbnail)
  );

  const aiHref = `/cockpit/chat?dept=marketing&q=${encodeURIComponent(`Describe this asset and suggest tags / similar pieces. asset_id=${asset?.asset_id ?? ''}`)}`;

  return (
    <div
      role="dialog"
      aria-modal
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20,24,22,0.55)',
        zIndex: 9998,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <aside
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(560px, 96vw)',
          height: '100vh',
          background: 'var(--paper-warm, #faf6ec)',
          borderLeft: '1px solid var(--line-soft)',
          overflowY: 'auto',
          fontFamily: 'var(--sans)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--line-soft)', position: 'sticky', top: 0, background: 'var(--paper-warm, #faf6ec)', zIndex: 2 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--ink-mute)' }}>asset detail</span>
          <button onClick={() => setOpen(false)} aria-label="close" style={{ background: 'none', border: 'none', fontSize: 'var(--t-2xl)', color: 'var(--ink-mute)', cursor: 'pointer' }}>×</button>
        </div>

        {loading && <div style={{ padding: 22, fontSize: 'var(--t-base)', color: 'var(--ink-mute)' }}>loading…</div>}

        {!loading && asset && (
          <>
            <div style={{ aspectRatio: '4 / 3', background: '#1a1a1a', position: 'relative' }}>
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt={asset.alt_text ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#888', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>no preview</div>
              )}
              {asset.do_not_modify && (
                <div style={{
                  position: 'absolute', top: 8, left: 8,
                  background: 'var(--st-bad, #b34a3c)', color: 'var(--paper-warm)',
                  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', fontWeight: 700,
                  padding: '3px 8px', textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>do not modify</div>
              )}
            </div>

            {/* Action overlay — agency CTAs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, padding: '10px 14px', borderBottom: '1px solid var(--line-soft)' }}>
              <ActionBtn href={`/marketing/campaigns/new?asset=${encodeURIComponent(asset.asset_id)}`} icon="⊕" label="Save to project" />
              <ActionBtn href="#" disabled title="Replace flow uses /marketing/upload — coming next" icon="↻" label="Replace" />
              <ActionBtn href="#" disabled title="Folders/collections live in marketing.media_collections — wire next" icon="📁" label="Move" />
              <ActionBtn href={aiHref} icon="✦" label="Ask AI" />
            </div>

            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Headline */}
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-xl)', color: 'var(--ink)', lineHeight: 1.3 }}>
                  {asset.caption ?? asset.alt_text ?? '—'}
                </div>
                <button
                  onClick={() => { setEditing((v) => !v); setSaveMsg(null); }}
                  style={{
                    fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: '0.18em', textTransform: 'uppercase',
                    background: editing ? 'var(--paper-deep)' : 'var(--moss)', color: editing ? 'var(--ink)' : 'var(--paper-warm)',
                    border: editing ? '1px solid var(--line)' : '1px solid var(--moss)',
                    padding: '4px 10px', cursor: 'pointer', borderRadius: 4,
                  }}
                >
                  {editing ? 'cancel' : 'edit'}
                </button>
              </div>

              {!editing && (
                <Section label={`tags (${asset.tags?.length ?? 0})`}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(asset.tags ?? []).map(t => (
                      <span key={t} style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', background: 'var(--line-soft, #efeae0)', padding: '2px 6px', color: 'var(--ink)' }}>{t}</span>
                    ))}
                    {(!asset.tags || asset.tags.length === 0) && <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>—</span>}
                  </div>
                </Section>
              )}

              {!editing && (
                <Section label="usage tiers">
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {asset.primary_tier && (
                      <span className="pill" style={{ background: 'var(--moss)', color: 'var(--paper-warm)', padding: '2px 8px', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>
                        primary · {TIER_LABEL[asset.primary_tier] ?? asset.primary_tier}
                      </span>
                    )}
                    {(asset.secondary_tiers ?? []).map(t => (
                      <span key={t} className="pill" style={{ background: 'var(--brass)', color: 'var(--paper-warm)', padding: '2px 8px', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>
                        {TIER_LABEL[t] ?? t}
                      </span>
                    ))}
                    {!asset.primary_tier && (!asset.secondary_tiers || asset.secondary_tiers.length === 0) && (
                      <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>—</span>
                    )}
                  </div>
                </Section>
              )}

              <Section label="metadata">
                <div style={{ fontSize: 'var(--t-base)', color: 'var(--ink-soft)', lineHeight: 1.7 }}>
                  Photographer: <strong>{asset.photographer ?? '—'}</strong><br />
                  Captured: {asset.captured_at ? new Date(asset.captured_at).toISOString().slice(0, 10) : '—'}<br />
                  License: {asset.license_type ?? '—'}{asset.license_expiry ? ` · expires ${asset.license_expiry}` : ''}<br />
                  Resolution: {asset.width_px ?? '?'} × {asset.height_px ?? '?'}<br />
                  File size: {fmtBytes(asset.file_size_bytes)}<br />
                  Property area: {asset.property_area ?? '—'}<br />
                  QC score: {asset.qc_score != null ? Number(asset.qc_score).toFixed(2) : '—'}{asset.ai_confidence != null ? ` · AI ${Number(asset.ai_confidence).toFixed(2)}` : ''}<br />
                  Asset ID: <code style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{asset.asset_id}</code>
                </div>
              </Section>

              {/* Edit form */}
              {editing && (
                <Section label="edit">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Field label="Caption">
                      <input
                        value={form.caption}
                        onChange={(e) => setForm({ ...form, caption: e.target.value })}
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Alt-text">
                      <textarea
                        value={form.alt_text}
                        onChange={(e) => setForm({ ...form, alt_text: e.target.value })}
                        rows={2}
                        style={{ ...inputStyle, resize: 'vertical' }}
                      />
                    </Field>
                    <Field label="Tags (comma-separated)">
                      <input
                        value={form.tags}
                        onChange={(e) => setForm({ ...form, tags: e.target.value })}
                        placeholder="riverbank, sunset, lifestyle"
                        style={inputStyle}
                      />
                    </Field>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <Field label="Primary tier">
                        <select
                          value={form.primary_tier}
                          onChange={(e) => setForm({ ...form, primary_tier: e.target.value })}
                          style={inputStyle}
                        >
                          <option value="">— none —</option>
                          {TIER_OPTIONS.map((t) => (
                            <option key={t} value={t}>{TIER_LABEL[t] ?? t}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="License">
                        <select
                          value={form.license_type}
                          onChange={(e) => setForm({ ...form, license_type: e.target.value })}
                          style={inputStyle}
                        >
                          <option value="">— none —</option>
                          {LICENSE_OPTIONS.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <Field label="License expiry (YYYY-MM-DD)">
                        <input
                          value={form.license_expiry}
                          onChange={(e) => setForm({ ...form, license_expiry: e.target.value })}
                          placeholder="2027-12-31"
                          style={inputStyle}
                        />
                      </Field>
                      <Field label="Property area">
                        <input
                          value={form.property_area}
                          onChange={(e) => setForm({ ...form, property_area: e.target.value })}
                          placeholder="riverside / lobby / pool"
                          style={inputStyle}
                        />
                      </Field>
                    </div>
                    <Field label="Photographer">
                      <input
                        value={form.photographer}
                        onChange={(e) => setForm({ ...form, photographer: e.target.value })}
                        style={inputStyle}
                      />
                    </Field>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>
                      <input
                        type="checkbox"
                        checked={form.do_not_modify}
                        onChange={(e) => setForm({ ...form, do_not_modify: e.target.checked })}
                      />
                      Do not modify (locks the asset against AI/auto-edits)
                    </label>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button
                        onClick={save}
                        disabled={saving}
                        style={{
                          padding: '8px 14px',
                          fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                          letterSpacing: '0.18em', textTransform: 'uppercase',
                          background: 'var(--moss)', color: 'var(--paper-warm)',
                          border: '1px solid var(--moss)', borderRadius: 4,
                          cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1,
                        }}
                      >{saving ? 'saving…' : 'save'}</button>
                      {saveMsg && <span style={{ fontSize: 'var(--t-sm)', color: saveMsg.startsWith('Saved') ? 'var(--moss-glow)' : 'var(--st-bad)' }}>{saveMsg}</span>}
                    </div>
                  </div>
                </Section>
              )}

              {/* Storage paths */}
              <Section label="storage paths">
                <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-soft)', wordBreak: 'break-all', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div><strong>raw_path</strong>: {asset.raw_path ?? '—'}</div>
                  <div><strong>master_path</strong>: {asset.master_path ?? '—'}</div>
                  {downloadUrl && (
                    <a href={downloadUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--moss)', fontWeight: 600, marginTop: 4 }}>
                      download ↗
                    </a>
                  )}
                </div>
              </Section>

              {/* Renders */}
              <Section label={`renders available (${Object.keys(asset.renders ?? {}).length})`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--t-sm)', fontFamily: 'var(--mono)', color: 'var(--ink-soft)' }}>
                  {Object.keys(asset.renders ?? {}).map(k => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>✓ {k}</span>
                      <a href={publicRenderUrl(asset.renders?.[k]) ?? '#'} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--moss)' }}>open ↗</a>
                    </div>
                  ))}
                  {(!asset.renders || Object.keys(asset.renders).length === 0) && <span>—</span>}
                </div>
              </Section>

              {/* Usage history */}
              <Section label={`usage history (${(asset.usage_log?.length ?? 0) + (asset.campaign_assets?.length ?? 0)})`}>
                {((asset.usage_log?.length ?? 0) + (asset.campaign_assets?.length ?? 0)) === 0 && (
                  <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-mute)', fontStyle: 'italic' }}>
                    Never used in a campaign or post. <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>(marketing.media_usage_log + marketing.campaign_assets are empty for this asset.)</span>
                  </div>
                )}
                {(asset.campaign_assets ?? []).slice(0, 8).map((c) => (
                  <div key={c.campaign_id + c.slot_order} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--line-soft)', padding: '4px 0', fontSize: 'var(--t-sm)' }}>
                    <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink-soft)' }}>
                      campaign · slot {c.slot_order}
                    </span>
                    <a href={`/marketing/campaigns/${c.campaign_id}`} style={{ color: 'var(--moss)' }}>open ↗</a>
                  </div>
                ))}
                {(asset.usage_log ?? []).slice(0, 12).map((u) => (
                  <div key={u.log_id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--line-soft)', padding: '4px 0', fontSize: 'var(--t-sm)' }}>
                    <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink-soft)' }}>
                      {u.channel ?? u.used_in ?? '—'} · {u.campaign_name ?? u.external_ref ?? '—'}
                    </span>
                    <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink-mute)', fontSize: 'var(--t-xs)' }}>
                      {u.used_at ? new Date(u.used_at).toISOString().slice(0, 10) : '—'}
                    </span>
                  </div>
                ))}
              </Section>

              {/* Footer CTAs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                <a
                  href={`/marketing/campaigns/new?asset=${encodeURIComponent(asset.asset_id)}`}
                  className="btn"
                  style={{ textAlign: 'center', background: 'var(--moss)', color: 'var(--paper-warm)', borderColor: 'var(--moss)', textDecoration: 'none', padding: '8px 14px' }}
                >
                  use in new campaign →
                </a>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--ink-mute)', marginBottom: 6, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>{label}</span>
      {children}
    </label>
  );
}

function ActionBtn({ href, icon, label, disabled, title }: { href: string; icon: string; label: string; disabled?: boolean; title?: string }) {
  if (disabled) {
    return (
      <span
        title={title}
        aria-disabled
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          padding: '8px 4px',
          fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: '0.12em', textTransform: 'uppercase',
          color: 'var(--ink-faint)', cursor: 'not-allowed',
          background: 'transparent', border: '1px dashed var(--line-soft)', borderRadius: 4,
        }}
      >
        <span style={{ fontSize: 'var(--t-base)' }}>{icon}</span>
        <span>{label}</span>
      </span>
    );
  }
  return (
    <a
      href={href}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        padding: '8px 4px',
        fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: '0.12em', textTransform: 'uppercase',
        color: 'var(--ink)', textDecoration: 'none',
        background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 4,
      }}
    >
      <span style={{ fontSize: 'var(--t-base)' }}>{icon}</span>
      <span>{label}</span>
    </a>
  );
}

const inputStyle: React.CSSProperties = {
  fontFamily: 'var(--sans)',
  fontSize: 'var(--t-sm)',
  color: 'var(--ink)',
  background: 'var(--paper)',
  border: '1px solid var(--line)',
  padding: '6px 8px',
  borderRadius: 3,
  width: '100%',
};
