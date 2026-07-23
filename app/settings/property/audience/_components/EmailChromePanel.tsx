'use client';
// app/settings/property/audience/_components/EmailChromePanel.tsx
// PBS 2026-07-21 · 5th panel in AudienceSettingsClient.
// Edits the header+footer chrome for all outbound emails (newsletters + sequences).
// Persists to marketing.property_email_settings via fn_email_chrome_upsert RPC.

import { useCallback, useMemo, useState, useTransition } from 'react';

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_S  = '#5A5A5A';
const BRAND  = '#084838';
const WARM   = '#F5F0E1';
const RED    = '#B03826';

export interface EmailChromeSettings {
  property_id: number;
  header_logo_asset_id: string | null;
  header_logo_public_url: string | null;
  header_tagline: string | null;
  default_hero_asset_id: string | null;
  default_hero_public_url: string | null;
  footer_address_lines: string[] | null;
  footer_social_links: Array<{ platform: string; url: string }> | null;
  footer_disclaimer_text: string | null;
  footer_unsubscribe_wording: string | null;
}

interface Props {
  propertyId: number;
  initial: EmailChromeSettings | null;
}

const SUPPORTED_PLATFORMS = ['instagram','facebook','youtube','tiktok','linkedin','tripadvisor','x'] as const;

export default function EmailChromePanel({ propertyId, initial }: Props) {
  const [logoAssetId, setLogoAssetId] = useState<string | null>(initial?.header_logo_asset_id ?? null);
  const [logoPreview, setLogoPreview] = useState<string | null>(initial?.header_logo_public_url ?? null);
  const [tagline, setTagline]         = useState(initial?.header_tagline ?? 'LUANG PRABANG · LAOS');
  const [heroAssetId, setHeroAssetId] = useState<string | null>(initial?.default_hero_asset_id ?? null);
  const [heroPreview, setHeroPreview] = useState<string | null>(initial?.default_hero_public_url ?? null);
  const [addressLines, setAddressLines] = useState<string>(
    Array.isArray(initial?.footer_address_lines) ? (initial!.footer_address_lines as string[]).join('\n')
      : 'Ban Xieng Lom\nLuang Prabang, Laos'
  );
  const [socialLinks, setSocialLinks] = useState<Array<{ platform: string; url: string }>>(
    Array.isArray(initial?.footer_social_links) ? (initial!.footer_social_links as any[]) : []
  );
  const [disclaimer, setDisclaimer]   = useState(initial?.footer_disclaimer_text ?? '');
  const [unsubWording, setUnsubWording] = useState(initial?.footer_unsubscribe_wording ?? 'Unsubscribe');
  const [pickerOpen, setPickerOpen]   = useState<null | 'logo' | 'hero'>(null);
  const [busy, startTransition]       = useTransition();
  const [msg, setMsg]                 = useState<{ ok: boolean; text: string } | null>(null);

  const onSave = useCallback(() => {
    startTransition(async () => {
      const addressArr = addressLines.split('\n').map(s => s.trim()).filter(Boolean);
      const social = socialLinks.filter(s => s && s.url && s.platform);
      const hydrated = initial != null;

      // NON-DESTRUCTIVE CONTRACT (2026-07-23 fix · pairs with presence-based
      // fn_email_chrome_upsert): a key ABSENT from the payload is never touched
      // server-side. An empty value is sent as an explicit clear ONLY when this
      // panel was hydrated with a previously-saved value — an unhydrated panel
      // (legacy mount / failed fetch) can never wipe saved chrome again.
      // Root cause of the 2026-07-22 social-links wipe: unhydrated state []
      // was always included and the old RPC COALESCE treated [] as a value.
      const payload: Record<string, unknown> = {};
      if (logoAssetId) payload.header_logo_asset_id = logoAssetId;
      else if (hydrated && initial!.header_logo_asset_id) payload.header_logo_asset_id = null;
      if (tagline.trim()) payload.header_tagline = tagline.trim();
      else if (hydrated && initial!.header_tagline) payload.header_tagline = null;
      if (heroAssetId) payload.default_hero_asset_id = heroAssetId;
      else if (hydrated && initial!.default_hero_asset_id) payload.default_hero_asset_id = null;
      if (addressArr.length > 0) payload.footer_address_lines = addressArr;
      else if (hydrated && (initial!.footer_address_lines?.length ?? 0) > 0) payload.footer_address_lines = [];
      if (social.length > 0) payload.footer_social_links = social;
      else if (hydrated && (initial!.footer_social_links?.length ?? 0) > 0) payload.footer_social_links = [];
      if (disclaimer.trim()) payload.footer_disclaimer_text = disclaimer.trim();
      else if (hydrated && initial!.footer_disclaimer_text) payload.footer_disclaimer_text = null;
      if (unsubWording.trim()) payload.footer_unsubscribe_wording = unsubWording.trim();
      else if (hydrated && initial!.footer_unsubscribe_wording) payload.footer_unsubscribe_wording = null;

      if (Object.keys(payload).length === 0) {
        setMsg({ ok: true, text: 'Nothing to save.' });
        return;
      }

      const res = await fetch('/api/marketing/audience/email-chrome-save', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId, payload }),
      });
      const j = await res.json();
      if (j?.ok) setMsg({ ok: true, text: 'Email chrome saved. Live in the next send.' });
      else setMsg({ ok: false, text: j?.error ?? 'save_failed' });
    });
  }, [propertyId, initial, logoAssetId, tagline, heroAssetId, addressLines, socialLinks, disclaimer, unsubWording]);

  const addSocial = () => setSocialLinks([...socialLinks, { platform: 'instagram', url: '' }]);
  const rmSocial  = (i: number) => setSocialLinks(socialLinks.filter((_, idx) => idx !== i));
  const setSocial = (i: number, patch: Partial<{ platform: string; url: string }>) =>
    setSocialLinks(socialLinks.map((s, idx) => idx === i ? { ...s, ...patch } : s));

  return (
    <section style={panelStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>Email Chrome</div>
          <div style={{ fontSize: 11, color: INK_S }}>
            Header + footer used on every outbound email. Read by <code>lib/emailFrame.ts.renderEmailFrame</code>.
          </div>
        </div>
        <button onClick={onSave} disabled={busy} style={primaryBtn}>{busy ? 'Saving…' : 'Save chrome'}</button>
      </div>

      {msg && (
        <div style={{
          padding: 8, marginBottom: 12, borderRadius: 3, fontSize: 12,
          background: msg.ok ? '#EEF7F0' : '#FBEDE7', color: msg.ok ? BRAND : RED,
          border: `1px solid ${msg.ok ? BRAND : RED}`,
        }}>{msg.text}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Header block */}
        <div style={subPanelStyle}>
          <div style={subHeader}>Header</div>
          <Field label="Logo (from media library)">
            <div style={pickerRow}>
              <div style={{ ...thumbBox, background: WARM }}>
                {logoPreview ? <img src={logoPreview} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <div style={emptyThumb}>No logo</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button onClick={() => setPickerOpen('logo')} style={secondaryBtn}>Pick logo</button>
                {logoAssetId && <button onClick={() => { setLogoAssetId(null); setLogoPreview(null); }} style={{ ...secondaryBtn, color: RED, borderColor: RED }}>Clear</button>}
              </div>
            </div>
          </Field>
          <Field label="Tagline (small caps below logo/wordmark)">
            <input value={tagline} onChange={(e) => setTagline(e.target.value)} style={inputStyle} />
          </Field>
        </div>

        {/* Default hero block */}
        <div style={subPanelStyle}>
          <div style={subHeader}>Default hero image</div>
          <Field label="Fallback hero when a template/campaign has none">
            <div style={pickerRow}>
              <div style={{ ...thumbBox, background: WARM, height: 90 }}>
                {heroPreview ? <img src={heroPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={emptyThumb}>No hero</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button onClick={() => setPickerOpen('hero')} style={secondaryBtn}>Pick hero</button>
                {heroAssetId && <button onClick={() => { setHeroAssetId(null); setHeroPreview(null); }} style={{ ...secondaryBtn, color: RED, borderColor: RED }}>Clear</button>}
              </div>
            </div>
          </Field>
        </div>

        {/* Footer address */}
        <div style={subPanelStyle}>
          <div style={subHeader}>Footer · Address (one line per row)</div>
          <textarea value={addressLines} onChange={(e) => setAddressLines(e.target.value)} rows={4} style={inputStyle} />
        </div>

        {/* Footer social links */}
        <div style={subPanelStyle}>
          <div style={subHeader}>Footer · Social links</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {socialLinks.length === 0 && <div style={{ fontSize: 11, color: INK_S }}>No social links yet.</div>}
            {socialLinks.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <select value={s.platform} onChange={(e) => setSocial(i, { platform: e.target.value })} style={{ ...selectStyle, width: 130 }}>
                  {SUPPORTED_PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <input value={s.url} onChange={(e) => setSocial(i, { url: e.target.value })} placeholder="https://…" style={{ ...inputStyle, flex: 1 }} />
                <button onClick={() => rmSocial(i)} style={{ ...secondaryBtn, color: RED, borderColor: RED }}>×</button>
              </div>
            ))}
            <button onClick={addSocial} style={secondaryBtn}>+ Add social link</button>
          </div>
        </div>

        {/* Footer disclaimer */}
        <div style={{ ...subPanelStyle, gridColumn: '1 / -1' }}>
          <div style={subHeader}>Footer · Disclaimer</div>
          <textarea value={disclaimer} onChange={(e) => setDisclaimer(e.target.value)} rows={2} style={inputStyle} placeholder="Optional legal / brand disclaimer displayed above the unsubscribe link." />
        </div>

        {/* Footer unsubscribe wording */}
        <div style={{ ...subPanelStyle, gridColumn: '1 / -1' }}>
          <div style={subHeader}>Footer · Unsubscribe link text</div>
          <input value={unsubWording} onChange={(e) => setUnsubWording(e.target.value)} style={inputStyle} placeholder="Unsubscribe" />
        </div>
      </div>

      {pickerOpen && (
        <MediaPickerModal
          onClose={() => setPickerOpen(null)}
          onPick={(m) => {
            if (pickerOpen === 'logo') { setLogoAssetId(m.asset_id); setLogoPreview(m.public_url); }
            else { setHeroAssetId(m.asset_id); setHeroPreview(m.public_url); }
            setPickerOpen(null);
          }}
        />
      )}
    </section>
  );
}

// ---------------- Media picker modal (lazy-fetch on open) ----------------
interface MediaAsset { asset_id: string; original_filename: string | null; public_url: string; quality_index: number | null; category: string | null; }

function MediaPickerModal({ onClose, onPick }: { onClose: () => void; onPick: (m: MediaAsset) => void }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows]       = useState<MediaAsset[]>([]);
  const [q, setQ]             = useState('');
  const [qmin, setQmin]       = useState<number>(0);
  const [err, setErr]         = useState<string | null>(null);

  useMemo(() => {
    (async () => {
      try {
        const r = await fetch('/api/marketing/newsletter-templates/list-media', { cache: 'no-store' });
        const j = await r.json();
        if (j?.ok && Array.isArray(j.rows)) setRows(j.rows);
        else setErr(j?.error ?? 'list_media_failed');
      } catch (e: any) { setErr(e?.message ?? 'list_media_failed'); }
      finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(() => {
    const qs = q.trim().toLowerCase();
    return rows.filter(r => {
      if (qmin > 0 && (r.quality_index ?? 0) < qmin) return false;
      if (qs && !(r.original_filename ?? '').toLowerCase().includes(qs)) return false;
      return true;
    }).slice(0, 300);
  }, [rows, q, qmin]);

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={{ ...drawerStyle, maxWidth: 960 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Pick from media library</div>
          <button onClick={onClose} style={closeBtn}>×</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
          <input placeholder="Filter filename…" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...inputStyle, maxWidth: 260 }} />
          <label style={{ fontSize: 11, color: INK_S }}>Min quality
            <select value={qmin} onChange={(e) => setQmin(Number(e.target.value))} style={selectStyle}>
              <option value={0}>Any</option>
              <option value={60}>≥ 60</option>
              <option value={75}>≥ 75</option>
              <option value={85}>≥ 85</option>
            </select>
          </label>
          <div style={{ fontSize: 11, color: INK_S }}>{loading ? 'Loading…' : `${filtered.length} shown`}</div>
        </div>
        {err && <div style={{ padding: 8, background: '#FBEDE7', color: RED, fontSize: 12, marginBottom: 8, borderRadius: 3 }}>{err}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8, maxHeight: 520, overflow: 'auto' }}>
          {filtered.map((m) => (
            <button key={m.asset_id} onClick={() => onPick(m)} style={{
              padding: 0, border: `1px solid ${HAIR}`, background: WHITE,
              cursor: 'pointer', borderRadius: 3, overflow: 'hidden', textAlign: 'left',
            }} title={m.original_filename ?? ''}>
              <img src={m.public_url} alt="" style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
              <div style={{ padding: 4, fontSize: 10, color: INK_S, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.quality_index ?? '—'} · {m.category ?? '—'}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- helpers ----------
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
      <span style={{ fontSize: 11, color: INK_S, fontWeight: 500 }}>{label}</span>
      {children}
    </label>
  );
}

// ---------- styles ----------
const panelStyle: React.CSSProperties = { background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: 16 };
const subPanelStyle: React.CSSProperties = { background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 3, padding: 12 };
const subHeader: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: INK, marginBottom: 8 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '6px 8px', border: `1px solid ${HAIR}`, borderRadius: 3, background: WHITE, color: INK, fontSize: 12, boxSizing: 'border-box', fontFamily: 'inherit' };
const selectStyle: React.CSSProperties = { padding: '4px 6px', border: `1px solid ${HAIR}`, borderRadius: 3, background: WHITE, color: INK, fontSize: 11 };
const primaryBtn: React.CSSProperties = { padding: '6px 12px', background: BRAND, color: WHITE, border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 12, fontWeight: 600 };
const secondaryBtn: React.CSSProperties = { padding: '6px 10px', background: WHITE, color: INK, border: `1px solid ${HAIR}`, borderRadius: 3, cursor: 'pointer', fontSize: 11 };
const closeBtn: React.CSSProperties = { background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: INK_S, padding: 0, width: 24, height: 24, lineHeight: '20px' };
const pickerRow: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'flex-start' };
const thumbBox: React.CSSProperties = { width: 130, height: 60, border: `1px solid ${HAIR}`, borderRadius: 3, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const emptyThumb: React.CSSProperties = { fontSize: 10, color: INK_S, padding: 8, textAlign: 'center' };
const backdropStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', paddingTop: 40, paddingBottom: 40 };
const drawerStyle: React.CSSProperties = { background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: 20, width: '92%', maxWidth: 720, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' };
