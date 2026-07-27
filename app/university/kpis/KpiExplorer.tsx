'use client';
// app/university/kpis/KpiExplorer.tsx
// TBC University · KPI dictionary explorer. Client-side: search box filters
// across name / meaning / formula; KPIs group into family sections. Each card
// shows name, plain meaning, plain formula, watch-out, the conformance-battery
// dot (green=battery-verified · amber=approved-not-yet-tested · red=MISMATCH ·
// grey=not approved) and an AI DRAFT badge until the definition is approved.
// Owner acts here: Approve (gate) a definition via /api/university/kpi-gate,
// certify golden records via /api/university/golden-certify. 'verified_in_code'
// is set only by a green battery run — never by this UI.

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { INK, INK_SOFT, INK_FAINT, HAIR, GREEN, GOLD, RED, WARM, TIP_BG, TIP_BORDER, WARN_BG, WARN_BORDER } from '../_lib/theme';

export type KpiRow = {
  kpiNumber: number | null;
  label: string; family: string; meaning: string; formula: string;
  watchOut: string; status: string;
  conformance: string;          // green | amber | red | grey
  checksCount: number;
  lastRunAt: string | null;
};

export type GoldenRow = {
  goldenId: number;
  kpiNumber: number;
  propertyId: number;
  windowStart: string;
  windowEnd: string;
  expectedValue: number | null;
  currencyLayer: string;
  sourceNote: string;
  certified: boolean;
  certifiedBy: string | null;
};

const GATED = new Set(['gated', 'approved', 'verified', 'verified_in_code', 'final', 'confirmed']);

const DOT: Record<string, { color: string; label: string }> = {
  green: { color: '#2E7D32', label: 'Battery-verified — the nightly independent recompute matches this definition.' },
  amber: { color: GOLD, label: 'Approved, not yet battery-tested — waiting for the next nightly run.' },
  red:   { color: RED, label: 'MISMATCH — the independent recompute disagrees with the production number. The definition wins; the tile is under repair.' },
  grey:  { color: INK_FAINT, label: 'Not approved yet — the battery only certifies approved definitions.' },
};

function ConformanceDot({ color, checksCount }: { color: string; checksCount: number }) {
  const d = DOT[color] ?? DOT.grey;
  const title = checksCount > 0 ? `${d.label} (${checksCount} independent check${checksCount === 1 ? '' : 's'})` : d.label;
  return (
    <span title={title} aria-label={title} style={{
      display: 'inline-block', width: 9, height: 9, borderRadius: '50%',
      background: d.color, flex: 'none',
    }} />
  );
}

export default function KpiExplorer({ kpis, goldens }: { kpis: KpiRow[]; goldens: GoldenRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function post(url: string, payload: Record<string, unknown>, key: string) {
    setBusy(key); setErr(null);
    try {
      const res = await fetch(url, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || j.ok !== true) throw new Error(j.error || `request failed (${res.status})`);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'request failed');
    } finally {
      setBusy(null);
    }
  }

  const families = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? kpis.filter((k) =>
          [k.label, k.family, k.meaning, k.formula, k.watchOut].join(' ').toLowerCase().includes(needle))
      : kpis;
    const byFamily = new Map<string, KpiRow[]>();
    for (const k of filtered) {
      if (!byFamily.has(k.family)) byFamily.set(k.family, []);
      byFamily.get(k.family)!.push(k);
    }
    for (const list of Array.from(byFamily.values())) list.sort((a, b) => a.label.localeCompare(b.label));
    return Array.from(byFamily.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [kpis, q]);

  const gatedCount = kpis.filter((k) => GATED.has((k.status || '').toLowerCase())).length;
  const uncertified = goldens.filter((g) => !g.certified);
  const certified = goldens.filter((g) => g.certified);

  return (
    <div>
      {/* Conformance legend */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginBottom: 10,
        fontSize: 11.5, color: INK_SOFT,
      }}>
        {(['green', 'amber', 'red', 'grey'] as const).map((c) => (
          <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <ConformanceDot color={c} checksCount={0} />
            {c === 'green' ? 'battery-verified' : c === 'amber' ? 'approved, untested' : c === 'red' ? 'mismatch' : 'not approved'}
          </span>
        ))}
        <span style={{ marginLeft: 'auto' }}>{gatedCount} of {kpis.length} approved</span>
      </div>

      {/* Golden records panel */}
      {goldens.length > 0 && (
        <div style={{ marginBottom: 14, background: '#FFFFFF', border: `1px solid ${HAIR}`, borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_SOFT }}>
            Golden records
          </div>
          <div style={{ marginTop: 4, fontSize: 12.5, lineHeight: 1.55, color: INK_SOFT }}>
            Hand-verified reference values the battery asserts never drift.
            {certified.length > 0 && ` ${certified.length} certified.`}
            {uncertified.length > 0 && ` ${uncertified.length} awaiting certification:`}
          </div>
          {uncertified.map((g) => (
            <div key={g.goldenId} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, fontSize: 12.5, color: INK }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong>KPI {g.kpiNumber}</strong> · {g.windowStart} → {g.windowEnd}
                {g.expectedValue != null && <> · expected <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{g.expectedValue.toLocaleString()}</strong></>}
                {g.currencyLayer && <span style={{ color: INK_FAINT }}> ({g.currencyLayer})</span>}
                {g.sourceNote && <span style={{ color: INK_SOFT }}> — {g.sourceNote}</span>}
              </span>
              <button
                onClick={() => post('/api/university/golden-certify', { golden_id: g.goldenId, certified_by: 'PBS' }, `g${g.goldenId}`)}
                disabled={busy !== null}
                style={{
                  flex: 'none', fontSize: 11.5, fontWeight: 700, padding: '4px 12px', borderRadius: 5,
                  border: `1px solid ${GREEN}`, background: busy === `g${g.goldenId}` ? WARM : '#FFFFFF',
                  color: GREEN, cursor: busy ? 'default' : 'pointer',
                }}>
                {busy === `g${g.goldenId}` ? 'Certifying…' : 'Certify'}
              </button>
            </div>
          ))}
        </div>
      )}

      {err && (
        <div style={{ marginBottom: 10, fontSize: 12.5, color: RED, background: '#FAEDEA', border: `1px solid ${RED}66`, borderRadius: 6, padding: '8px 12px' }}>
          {err}
        </div>
      )}

      <input
        type="search" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder='Search a number — e.g. "RevPAR", "occupancy", "no-show"'
        style={{
          width: '100%', boxSizing: 'border-box', fontSize: 14.5, padding: '11px 14px',
          border: `1px solid ${HAIR}`, borderRadius: 6, fontFamily: 'inherit', color: INK,
          background: '#FFFFFF', outline: 'none',
        }}
      />

      {families.length === 0 && (
        <div style={{ marginTop: 16, fontSize: 13.5, color: INK_SOFT }}>
          Nothing matches &ldquo;{q}&rdquo; — try a shorter word.
        </div>
      )}

      {families.map(([family, list]) => (
        <section key={family} style={{ marginTop: 24 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 12.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK_SOFT }}>
            {family}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
            {list.map((k) => {
              const gated = GATED.has((k.status || '').toLowerCase());
              const busyKey = k.kpiNumber != null ? `k${k.kpiNumber}` : null;
              return (
                <div key={`${family}-${k.label}`} style={{
                  background: '#FFFFFF', border: `1px solid ${HAIR}`, borderRadius: 8, padding: '14px 16px',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ConformanceDot color={k.conformance} checksCount={k.checksCount} />
                    <span style={{ fontSize: 15, fontWeight: 700, color: INK }}>{k.label}</span>
                    {!gated && (
                      <span style={{ marginLeft: 'auto', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em', color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 3, padding: '1px 6px', flex: 'none' }}
                        title="This definition was drafted by AI and has not been signed off yet.">
                        AI DRAFT
                      </span>
                    )}
                    {gated && (k.status || '').toLowerCase() === 'verified_in_code' && (
                      <span style={{ marginLeft: 'auto', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em', color: '#2E7D32', border: '1px solid #2E7D32', borderRadius: 3, padding: '1px 6px', flex: 'none' }}
                        title="An independent nightly recompute of this definition matches the production number.">
                        VERIFIED IN CODE
                      </span>
                    )}
                  </div>
                  {k.meaning && (
                    <div style={{ fontSize: 13.5, lineHeight: 1.6, color: INK }}>{k.meaning}</div>
                  )}
                  {k.formula && (
                    <div style={{ background: TIP_BG, border: `1px solid ${TIP_BORDER}`, borderRadius: 5, padding: '8px 11px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: GREEN, marginBottom: 3 }}>How it&rsquo;s calculated</div>
                      <div style={{ fontSize: 12.5, lineHeight: 1.55, color: INK }}>{k.formula}</div>
                    </div>
                  )}
                  {k.watchOut && (
                    <div style={{ background: WARN_BG, border: `1px solid ${WARN_BORDER}`, borderRadius: 5, padding: '8px 11px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: GOLD, marginBottom: 3 }}>Watch out</div>
                      <div style={{ fontSize: 12.5, lineHeight: 1.55, color: INK }}>{k.watchOut}</div>
                    </div>
                  )}
                  {k.kpiNumber != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                      {!gated ? (
                        <button
                          onClick={() => post('/api/university/kpi-gate', { kpi_number: k.kpiNumber, action: 'gate' }, busyKey!)}
                          disabled={busy !== null}
                          title="Approve this definition. The nightly battery then starts proving the dashboards compute it exactly as written."
                          style={{
                            fontSize: 11.5, fontWeight: 700, padding: '4px 12px', borderRadius: 5,
                            border: `1px solid ${GREEN}`, background: busy === busyKey ? WARM : '#FFFFFF',
                            color: GREEN, cursor: busy ? 'default' : 'pointer',
                          }}>
                          {busy === busyKey ? 'Approving…' : 'Approve'}
                        </button>
                      ) : (
                        <button
                          onClick={() => post('/api/university/kpi-gate', { kpi_number: k.kpiNumber, action: 'ungate' }, busyKey!)}
                          disabled={busy !== null}
                          title="Withdraw approval — the definition returns to AI DRAFT and leaves the battery."
                          style={{
                            fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 5,
                            border: `1px solid ${HAIR}`, background: busy === busyKey ? WARM : '#FFFFFF',
                            color: INK_SOFT, cursor: busy ? 'default' : 'pointer',
                          }}>
                          {busy === busyKey ? 'Withdrawing…' : 'Withdraw approval'}
                        </button>
                      )}
                      <span style={{ marginLeft: 'auto', fontSize: 10.5, color: INK_FAINT, fontVariantNumeric: 'tabular-nums' }}>
                        #{k.kpiNumber}{k.checksCount > 0 ? ` · ${k.checksCount} check${k.checksCount === 1 ? '' : 's'}` : ''}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <div style={{ marginTop: 20, fontSize: 11, color: '#8A8A8A', background: WARM, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '8px 12px' }}>
        Definitions marked AI DRAFT were written by the system and are waiting for sign-off. Approving a
        definition puts it under the nightly conformance battery: an independent recompute from the
        definition text, compared against the production number. If a dashboard does not match its
        definition here, the definition wins — the tile gets repaired, never the definition.
      </div>
    </div>
  );
}
