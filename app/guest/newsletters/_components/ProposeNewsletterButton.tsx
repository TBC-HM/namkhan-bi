'use client';
// app/guest/newsletters/_components/ProposeNewsletterButton.tsx
// PBS 2026-07-21 pm (Add 2): "✨ Propose Newsletter" — one-shot AI-drafted campaign
// from a seed sentence. Opens a right-hand drawer with three fields (seed +
// target date + audience), calls /api/marketing/newsletter/propose-one to
// get a subject + body_md pair from Claude, then saves as a draft campaign
// via PUT on the same route and redirects the operator to the campaign editor.
//
// Props:
//   propertyId      required · numeric property_id (26xxxx)
//   defaultAudience 'b2c' | 'b2b' | 'all' · initial value for the audience select
//   defaultKind     'broadcast' | 'lifecycle' · sets guest.campaigns.campaign_kind
//                   on save. Broadcasts + lifecycle share the same composer;
//                   only the DB campaign_kind + which tab they list under differ.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CSSProperties } from 'react';

interface Props {
  propertyId: number;
  defaultAudience?: 'b2c' | 'b2b' | 'all';
  defaultKind?: 'broadcast' | 'lifecycle';
}

type Proposal = {
  subject: string;
  body_md: string;
  goal_tag: string | null;
};

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_M = '#5A5A5A';
const GREEN = '#1F3A2E';
const RED   = '#B03826';

function nextMondayFromToday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 5);              // today + 5 days
  const day = d.getUTCDay();                     // 0=Sun ... 1=Mon
  const daysUntilMon = (1 - day + 7) % 7;
  d.setUTCDate(d.getUTCDate() + daysUntilMon);
  return d.toISOString().slice(0, 10);
}

export default function ProposeNewsletterButton({
  propertyId, defaultAudience, defaultKind,
}: Props) {
  const router = useRouter();
  const kind: 'broadcast' | 'lifecycle' = defaultKind === 'lifecycle' ? 'lifecycle' : 'broadcast';
  const [open, setOpen]     = useState(false);
  const [seed, setSeed]     = useState('');
  const [date, setDate]     = useState<string>(nextMondayFromToday());
  const [aud,  setAud]      = useState<'b2c' | 'b2b'>(defaultAudience === 'b2b' ? 'b2b' : 'b2c');
  const [prop, setProp]     = useState<Proposal | null>(null);
  const [instr, setInstr]   = useState('');
  const [msg,  setMsg]      = useState<string | null>(null);
  const [busy, startT]      = useTransition();

  const label = kind === 'lifecycle' ? '✨ Propose Lifecycle Email' : '✨ Propose Newsletter';

  async function propose(mode: 'initial' | 'refine') {
    if (mode === 'initial' && !seed.trim()) { setMsg('Enter a seed first.'); return; }
    if (mode === 'refine' && !instr.trim()) { setMsg('Enter a refine instruction.'); return; }
    startT(async () => {
      const body = {
        property_id: propertyId,
        kind,
        seed_text: seed.trim(),
        target_date: date,
        audience_type: aud,
        instruction: mode === 'refine' ? instr.trim() : undefined,
        prior: mode === 'refine' && prop ? { subject: prop.subject, body_md: prop.body_md } : undefined,
      };
      try {
        const res = await fetch('/api/marketing/newsletter/propose-one', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        const j = await res.json();
        if (!res.ok || !j?.ok) { setMsg(`Propose failed: ${j?.error ?? res.status}`); return; }
        setProp(j.proposal as Proposal);
        setMsg(null);
        if (mode === 'refine') setInstr('');
      } catch (e) {
        setMsg('Propose error: ' + (e instanceof Error ? e.message : String(e)));
      }
    });
  }

  async function saveDraft() {
    if (!prop) return;
    startT(async () => {
      const res = await fetch('/api/marketing/newsletter/propose-one', {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          kind,
          target_date: date,
          audience_type: aud,
          subject: prop.subject,
          body_md: prop.body_md,
          goal_tag: prop.goal_tag,
          name: prop.subject || seed.slice(0, 60),
        }),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) { setMsg(`Save failed: ${j?.error ?? res.status}`); return; }
      setOpen(false);
      router.push(`/guest/newsletters/${j.campaign_id}`);
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={proposeCta}>{label}</button>

      {open && (
        <div role="dialog" aria-modal="true"
             onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
             style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 500, display: 'flex', justifyContent: 'flex-end' }}>
          <aside style={{
            width: 640, maxWidth: '96vw', height: '100vh', background: WHITE, borderLeft: `1px solid ${HAIR}`,
            overflow: 'auto', padding: 20, boxShadow: '-12px 0 32px rgba(0,0,0,0.18)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: INK }}>{label}</h4>
              <button type="button" onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: 22, color: INK_M, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ marginTop: 4, fontSize: 11, color: INK_M }}>
              Draft will be saved as campaign_kind = <strong>{kind}</strong>.
            </div>

            {msg && <div style={{ marginTop: 10, padding: 8, fontSize: 12, background: '#FBE8E4', border: `1px solid ${RED}`, color: RED, borderRadius: 4 }}>{msg}</div>}

            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 160px 120px', gap: 8, alignItems: 'end' }}>
              <label style={fieldWrap}>
                <span style={fieldLabel}>Seed — what&apos;s this email about?</span>
                <input type="text" value={seed} onChange={(e) => setSeed(e.target.value)}
                       placeholder="e.g. green season deal for families" style={inp} />
              </label>
              <label style={fieldWrap}>
                <span style={fieldLabel}>Target date</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inp} />
              </label>
              <label style={fieldWrap}>
                <span style={fieldLabel}>Audience</span>
                <select value={aud} onChange={(e) => setAud(e.target.value === 'b2b' ? 'b2b' : 'b2c')} style={{ ...inp, background: WHITE }}>
                  <option value="b2c">B2C</option>
                  <option value="b2b">B2B</option>
                </select>
              </label>
            </div>

            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => propose('initial')} disabled={busy || !seed.trim()} style={ctaBtn}>
                {busy ? 'Thinking…' : 'Propose'}
              </button>
              <span style={{ fontSize: 10, color: INK_M, alignSelf: 'center' }}>
                Applies property_profile + guardrails. Model: claude-sonnet-4-7.
              </span>
            </div>

            {prop && (
              <>
                <div style={{ marginTop: 18 }}>
                  <div style={fieldLabel}>Subject</div>
                  <div style={preBox}>{prop.subject}</div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div style={fieldLabel}>Body (markdown)</div>
                  <pre style={{ ...preBox, whiteSpace: 'pre-wrap', fontWeight: 400, fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 11, maxHeight: 380, overflow: 'auto' }}>
                    {prop.body_md}
                  </pre>
                </div>

                <div style={{ marginTop: 14, borderTop: `1px solid ${HAIR}`, paddingTop: 12 }}>
                  <div style={fieldLabel}>Refine</div>
                  <textarea rows={2} value={instr} onChange={(e) => setInstr(e.target.value)}
                            placeholder="e.g. shorter opener, punch up the CTA, more emphasis on the river"
                            style={{ width: '100%', border: `1px solid ${HAIR}`, borderRadius: 4, padding: 8, fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => propose('refine')} disabled={busy || !instr.trim()} style={secondaryBtn}>
                      {busy ? 'Refining…' : 'Refine'}
                    </button>
                    <button type="button" onClick={saveDraft} disabled={busy} style={ctaBtn}>
                      Save as draft
                    </button>
                  </div>
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
