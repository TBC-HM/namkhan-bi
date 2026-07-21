'use client';
// app/guest/newsletters/_components/SlotPreviewDrawer.tsx
// PBS 2026-07-22 · Right-side drawer preview for a broadcast campaign OR director slot.
//
// Data model: `PreviewTarget` covers both. When a director slot has a linked_campaign_id,
// we defer to the campaign edit URL for "Edit"; otherwise Edit maps to the slot's page.
//
// Buttons: ✨ Refine · Edit · Schedule · Duplicate · Skip · Delete
//   * Refine → POST /api/marketing/email/refine-block (kind='newsletter_campaign' or a
//     future director-refine variant). For slot without linked campaign we call the
//     existing director/refine-slot route.
//   * Edit → tenant link to /guest/newsletters/[campaign_id]
//   * Schedule → open ScheduleDrawer route (linked_campaign only)
//   * Duplicate → POST fn_campaign_duplicate (best-effort; falls back to a stub message)
//   * Skip/Delete on slots only.

import { useEffect, useMemo, useState, useTransition } from 'react';
import type { CSSProperties } from 'react';
import { renderEmailFrame, markdownToInlineHtml } from '@/lib/emailFrame';

export interface PreviewTarget {
  kind: 'broadcast' | 'director';
  id: string;                    // campaign_id (uuid) OR slot_id (bigint as string)
  title: string;
  subject?: string;
  body_md?: string;
  hero_asset_id?: string;
  goal_tag?: string;
  audience_type?: string;
  status?: string;
  day_iso?: string;
}

interface Props {
  target: PreviewTarget;
  onClose: () => void;
}

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_M = '#5A5A5A';
const GREEN = '#1F3A2E';
const RED   = '#B03826';

type EstimateJson = { total: number; excluded?: { in_sequence: number; cool_off: number; dormant: number } };

export default function SlotPreviewDrawer({ target, onClose }: Props) {
  const [subject, setSubject] = useState<string>(target.subject ?? '');
  const [bodyMd,  setBodyMd]  = useState<string>(target.body_md ?? '');
  const [heroUrl, setHeroUrl] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<EstimateJson | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [refineText, setRefineText] = useState('');
  const [busy, startT] = useTransition();

  // Fetch full detail (subject/body/hero) if not passed inline. Also fetch recipient estimate.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Estimate
        const kindForEst = target.kind === 'broadcast' ? 'broadcast' : (target.status && ['scheduled','sent'].includes(target.status) && target.kind === 'director' ? 'broadcast' : 'director');
        const idForEst   = kindForEst === 'broadcast' && target.kind === 'director' ? '' : target.id;
        if (idForEst) {
          const est = await fetch('/api/marketing/newsletter/estimate-recipients', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ kind: kindForEst, id: idForEst }),
          }).then(r => r.json()).catch(() => null);
          if (!cancelled && est && !est.error) setEstimate(est as EstimateJson);
        }

        // Hero URL if hero_asset_id
        if (target.hero_asset_id) {
          const r = await fetch(`/api/media/asset-url?asset_id=${target.hero_asset_id}`).then(r => r.json()).catch(() => null);
          if (!cancelled && r?.public_url) setHeroUrl(r.public_url);
        }

        // If broadcast and body wasn't inlined, fetch it from /api/marketing/newsletter/campaign-detail
        if (target.kind === 'broadcast' && !target.body_md) {
          const r = await fetch(`/api/marketing/newsletter/campaign-detail?id=${target.id}`).then(r => r.json()).catch(() => null);
          if (!cancelled && r?.ok && r?.data) {
            setSubject(r.data.subject ?? '');
            setBodyMd(r.data.body_md ?? '');
          }
        }
      } catch {
        // best-effort — never block the drawer
      }
    })();
    return () => { cancelled = true; };
  }, [target]);

  const previewHtml = useMemo(() => {
    return renderEmailFrame({
      heroImageUrl: heroUrl,
      heroAlt: subject || target.title,
      bodyHtml: markdownToInlineHtml(bodyMd || '_(no body yet)_'),
      propertyName: 'THE NAMKHAN',
      propertyEmail: 'info@thenamkhan.com',
      propertyWebsite: 'thenamkhan.com',
      unsubscribeUrl: '#unsubscribe',
    });
  }, [heroUrl, subject, bodyMd, target.title]);

  async function refine() {
    if (!refineText.trim()) { setMsg('Enter a refine instruction first.'); return; }
    startT(async () => {
      try {
        if (target.kind === 'broadcast') {
          const res = await fetch('/api/marketing/email/refine-block', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ kind: 'newsletter_campaign', id: target.id, instruction: refineText.trim() }),
          });
          const j = await res.json();
          if (!res.ok || !j?.ok) { setMsg(`Refine failed: ${j?.error ?? res.status}`); return; }
          const p = j.proposal ?? {};
          if (p.subject) setSubject(p.subject);
          if (p.body_md) setBodyMd(p.body_md);
          setMsg('Refined — click Save in the editor to persist.');
          setRefineText('');
        } else {
          const res = await fetch('/api/marketing/director/refine-slot', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ slot_id: Number(target.id), instruction: refineText.trim() }),
          });
          const j = await res.json();
          if (!res.ok) { setMsg(`Refine failed: ${await (async () => JSON.stringify(j))()}`); return; }
          if (j.subject) setSubject(j.subject);
          if (j.body_md) setBodyMd(j.body_md);
          setMsg('Slot refined.');
          setRefineText('');
        }
      } catch (e) {
        setMsg('Refine error: ' + (e instanceof Error ? e.message : String(e)));
      }
    });
  }

  async function skipSlot() {
    if (target.kind !== 'director') return;
    if (!confirm('Skip this slot? It stays visible but marked "skipped".')) return;
    startT(async () => {
      const res = await fetch('/api/marketing/director/approve-slot', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slot_id: Number(target.id), skip: true }),
      });
      if (!res.ok) { setMsg('Skip failed: ' + res.status); return; }
      setMsg('Slot skipped.');
      setTimeout(() => window.location.reload(), 800);
    });
  }

  const editHref = target.kind === 'broadcast'
    ? `/guest/newsletters/${target.id}`
    : `/guest/newsletters/director`;

  return (
    <div
      role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 500, display: 'flex', justifyContent: 'flex-end' }}
    >
      <aside style={{
        width: 620, maxWidth: '96vw', height: '100vh', background: WHITE, borderLeft: `1px solid ${HAIR}`,
        overflow: 'auto', padding: 20, boxShadow: '-12px 0 32px rgba(0,0,0,0.18)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK_M }}>
              {target.kind === 'broadcast' ? 'Broadcast · Campaign' : 'Director · Slot'}
              {target.day_iso ? ` · ${target.day_iso}` : ''}
              {target.status ? ` · ${target.status}` : ''}
            </div>
            <h4 style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 700, color: INK }}>{target.title}</h4>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 22, color: INK_M, cursor: 'pointer' }}>×</button>
        </div>

        {msg && <div style={{ marginTop: 10, padding: 8, fontSize: 12, background: '#EEF6EE', border: '1px solid #C9E1C9', color: '#1F5C2C', borderRadius: 4 }}>{msg}</div>}

        {/* Hero */}
        {heroUrl ? (
          <div style={{ marginTop: 14 }}>
            <img src={heroUrl} alt={subject || target.title} style={{ width: '100%', maxWidth: '100%', aspectRatio: '16/9', objectFit: 'cover', border: `1px solid ${HAIR}`, borderRadius: 4 }} />
          </div>
        ) : (
          <div style={{ marginTop: 14, padding: 10, background: '#FBE8E4', border: `1px solid ${RED}`, borderRadius: 4, color: RED, fontSize: 12, fontWeight: 700, textAlign: 'center' }}>
            NO HERO — please add
          </div>
        )}

        {/* Subject */}
        <div style={{ marginTop: 14 }}>
          <div style={fieldLabel}>Subject</div>
          <div style={preBox}>{subject || '—'}</div>
        </div>

        {/* Body preview via shared frame */}
        <div style={{ marginTop: 14 }}>
          <div style={fieldLabel}>Body preview</div>
          <div style={{ background: '#FAFAF7', border: `1px solid ${HAIR}`, borderRadius: 4, overflow: 'hidden' }}>
            <iframe title="slot-preview" srcDoc={previewHtml} style={{ width: '100%', height: 420, border: 'none', background: '#F0EBE1', display: 'block' }} />
          </div>
        </div>

        {/* Audience estimate */}
        <div style={{ marginTop: 14 }}>
          <div style={fieldLabel}>Audience</div>
          {estimate ? (
            <div style={{ padding: 10, background: '#F5F0E1', border: `1px solid ${HAIR}`, borderRadius: 4, fontSize: 12, color: INK }}>
              <div><strong>{estimate.total.toLocaleString()}</strong> subscribers will receive this.</div>
              {estimate.excluded && (
                <div style={{ marginTop: 4, fontSize: 11, color: INK_M }}>
                  Excluded: {estimate.excluded.in_sequence} in sequence · {estimate.excluded.cool_off} cool-off · {estimate.excluded.dormant} dormant
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: 10, background: '#FAFAF7', border: `1px solid ${HAIR}`, borderRadius: 4, fontSize: 11, color: INK_M }}>
              Estimating…
            </div>
          )}
        </div>

        {/* Refine */}
        <div style={{ marginTop: 16, borderTop: `1px solid ${HAIR}`, paddingTop: 12 }}>
          <div style={fieldLabel}>✨ Refine with AI</div>
          <textarea
            value={refineText} onChange={(e) => setRefineText(e.target.value)}
            placeholder="e.g. Tighten the opener, add a spa CTA, make more sensory"
            rows={2}
            style={{ width: '100%', border: `1px solid ${HAIR}`, borderRadius: 4, padding: 8, fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }}
          />
        </div>

        {/* Actions */}
        <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={refine} disabled={busy || !refineText.trim()} style={ctaBtn}>
            {busy ? 'Working…' : '✨ Refine'}
          </button>
          <a href={editHref} style={secondaryBtn}>Edit</a>
          {target.kind === 'broadcast' && (
            <a href={`/guest/newsletters/${target.id}`} style={secondaryBtn}>Schedule change</a>
          )}
          {target.kind === 'director' && (
            <button type="button" onClick={skipSlot} disabled={busy} style={dangerLight}>Skip slot</button>
          )}
        </div>
      </aside>
    </div>
  );
}

// ---------- styles ----------
const fieldLabel: CSSProperties = { fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: INK_M, fontWeight: 700, marginBottom: 4 };
const preBox: CSSProperties = { padding: 10, border: `1px solid ${HAIR}`, borderRadius: 4, fontSize: 12, background: '#FAFAF7', color: INK };
const ctaBtn: CSSProperties = { padding: '6px 14px', fontSize: 12, fontWeight: 700, background: GREEN, color: WHITE, border: `1px solid ${GREEN}`, borderRadius: 4, cursor: 'pointer' };
const secondaryBtn: CSSProperties = { padding: '6px 14px', fontSize: 12, fontWeight: 700, background: WHITE, color: GREEN, border: `1px solid ${HAIR}`, borderRadius: 4, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' };
const dangerLight: CSSProperties = { padding: '6px 14px', fontSize: 12, fontWeight: 700, background: WHITE, color: RED, border: `1px solid ${RED}`, borderRadius: 4, cursor: 'pointer' };
