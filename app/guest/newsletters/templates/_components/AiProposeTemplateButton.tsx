'use client';
// app/guest/newsletters/templates/_components/AiProposeTemplateButton.tsx
// PBS 2026-07-21 pm (Add 3): "✨ AI Propose Template" — one-shot AI-drafted
// template from a seed sentence. Opens a right-hand drawer with three fields
// (about + scope + category), POSTs /api/marketing/newsletter-templates/propose
// to get a template proposal from Claude, then saves it as an inactive draft
// via the same route and redirects the operator to the template edit drawer
// for final polish.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CSSProperties } from 'react';

type Scope = 'newsletter' | 'sequence' | 'both';

interface Props {
  propertyId: number;
}

type Proposal = {
  template_key: string;
  label: string;
  subject: string;
  body_md: string;
  hero_asset_id: string | null;
  category: string;
  description: string;
};

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_M = '#5A5A5A';
const GREEN = '#1F3A2E';
const RED   = '#B03826';

export default function AiProposeTemplateButton({ propertyId }: Props) {
  const router = useRouter();
  const [open, setOpen]     = useState(false);
  const [seed, setSeed]     = useState('');
  const [scope, setScope]   = useState<Scope>('newsletter');
  const [category, setCategory] = useState<string>('');
  const [prop, setProp]     = useState<Proposal | null>(null);
  const [msg,  setMsg]      = useState<string | null>(null);
  const [busy, startT]      = useTransition();

  async function propose() {
    if (!seed.trim()) { setMsg('Enter a short brief first.'); return; }
    setMsg(null);
    startT(async () => {
      try {
        const res = await fetch('/api/marketing/newsletter-templates/propose', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            property_id: propertyId,
            seed_text: seed.trim(),
            scope,
            category: category.trim() || undefined,
          }),
        });
        const j = await res.json();
        if (!res.ok || !j?.ok) { setMsg(`Propose failed: ${j?.error ?? res.status}`); return; }
        setProp(j.proposal as Proposal);
      } catch (e) {
        setMsg('Propose error: ' + (e instanceof Error ? e.message : String(e)));
      }
    });
  }

  async function save() {
    if (!prop) return;
    startT(async () => {
      try {
        const res = await fetch('/api/marketing/newsletter-templates/propose', {
          method: 'PUT', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            property_id: propertyId,
            proposal: prop,
            scope,
          }),
        });
        const j = await res.json();
        if (!res.ok || !j?.ok) { setMsg(`Save failed: ${j?.error ?? res.status}`); return; }
        setOpen(false);
        router.push(`/guest/newsletters/templates/${j.template_key}`);
      } catch (e) {
        setMsg('Save error: ' + (e instanceof Error ? e.message : String(e)));
      }
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={proposeCta}>
        ✨ AI Propose Template
      </button>

      {open && (
        <div role="dialog" aria-modal="true"
             onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
             style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 500, display: 'flex', justifyContent: 'flex-end' }}>
          <aside style={{
            width: 640, maxWidth: '96vw', height: '100vh', background: WHITE, borderLeft: `1px solid ${HAIR}`,
            overflow: 'auto', padding: 20, boxShadow: '-12px 0 32px rgba(0,0,0,0.18)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: INK }}>✨ AI Propose Template</h4>
              <button type="button" onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: 22, color: INK_M, cursor: 'pointer' }}>×</button>
            </div>

            {msg && <div style={{ marginTop: 10, padding: 8, fontSize: 12, background: '#FBE8E4', border: `1px solid ${RED}`, color: RED, borderRadius: 4 }}>{msg}</div>}

            <label style={{ ...fieldWrap, marginTop: 14 }}>
              <span style={fieldLabel}>In a few words, what should this template be about?</span>
              <input type="text" value={seed} onChange={(e) => setSeed(e.target.value)}
                     placeholder="e.g. winback for lapsed guests, birthday message, welcome kit"
                     style={inp} />
            </label>

            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label style={fieldWrap}>
                <span style={fieldLabel}>Scope</span>
                <select value={scope} onChange={(e) => setScope((e.target.value as Scope) || 'newsletter')} style={{ ...inp, background: WHITE }}>
                  <option value="newsletter">Newsletter</option>
                  <option value="sequence">Sequence</option>
                  <option value="both">Both</option>
                </select>
              </label>
              <label style={fieldWrap}>
                <span style={fieldLabel}>Category (optional)</span>
                <input type="text" value={category} onChange={(e) => setCategory(e.target.value)}
                       placeholder={scope} style={inp} />
              </label>
            </div>

            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button type="button" onClick={propose} disabled={busy || !seed.trim()} style={ctaBtn}>
                {busy ? 'Thinking…' : 'Propose'}
              </button>
              <span style={{ fontSize: 10, color: INK_M, alignSelf: 'center' }}>
                Reads property_profile · guardrails · hero library · link catalog.
              </span>
            </div>

            {prop && (
              <>
                <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={fieldLabel}>Template key</div>
                    <div style={preBox}>{prop.template_key}</div>
                  </div>
                  <div>
                    <div style={fieldLabel}>Category</div>
                    <div style={preBox}>{prop.category}</div>
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={fieldLabel}>Label</div>
                  <div style={preBox}>{prop.label}</div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={fieldLabel}>Description</div>
                  <div style={{ ...preBox, fontWeight: 400 }}>{prop.description}</div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={fieldLabel}>Subject</div>
                  <div style={preBox}>{prop.subject}</div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={fieldLabel}>Body (markdown)</div>
                  <pre style={{ ...preBox, whiteSpace: 'pre-wrap', fontWeight: 400, fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 11, maxHeight: 320, overflow: 'auto' }}>
                    {prop.body_md}
                  </pre>
                </div>

                <div style={{ marginTop: 14, borderTop: `1px solid ${HAIR}`, paddingTop: 12, display: 'flex', gap: 8 }}>
                  <button type="button" onClick={save} disabled={busy} style={ctaBtn}>
                    Save + open editor
                  </button>
                  <button type="button" onClick={() => { setProp(null); setMsg(null); }} disabled={busy} style={secondaryBtn}>
                    Discard + start over
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

// styles
const proposeCta: CSSProperties = { padding: '6px 14px', fontSize: 12, fontWeight: 700, background: GREEN, color: WHITE, border: `1px solid ${GREEN}`, borderRadius: 4, cursor: 'pointer' };
const ctaBtn: CSSProperties     = { padding: '6px 14px', fontSize: 12, fontWeight: 700, background: GREEN, color: WHITE, border: `1px solid ${GREEN}`, borderRadius: 4, cursor: 'pointer' };
const secondaryBtn: CSSProperties = { padding: '6px 14px', fontSize: 12, fontWeight: 700, background: WHITE, color: GREEN, border: `1px solid ${HAIR}`, borderRadius: 4, cursor: 'pointer' };
const fieldWrap: CSSProperties  = { display: 'flex', flexDirection: 'column', gap: 4 };
const fieldLabel: CSSProperties = { fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: INK_M, fontWeight: 700, marginBottom: 4 };
const inp: CSSProperties        = { padding: '6px 10px', border: `1px solid ${HAIR}`, borderRadius: 4, fontSize: 12, color: INK, boxSizing: 'border-box', width: '100%' };
const preBox: CSSProperties     = { padding: 10, border: `1px solid ${HAIR}`, borderRadius: 4, fontSize: 12, background: '#FAFAF7', color: INK, fontWeight: 700 };
