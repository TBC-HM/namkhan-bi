// app/marketing/compiler/_components/LockWizard.tsx
//
// Brief autospec-compiler_module-20260725 · A2 (2026-07-30).
// Lock & Distribute — the v1 wizard was visual-only (buttons did nothing).
// v2 drives the EXISTING /api/compiler/runs/[id]/deploy route:
//   1. Pick the variant to lock (default = recommended).
//   2. Choose channels. Web funnel goes LIVE (real /r/[slug] page).
//      Sales / Social / Influencer write honest `queued` broadcast entries —
//      never fake `live` (D3): those cockpits flip them when they pick it up.
//   3. Confirm → deploy → live funnel link + broadcast log.

'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';

export interface WizardRun {
  id: string;
  name: string;
  prompt: string;
  status: string;
  alreadyDeployed: boolean;
  lastSlug: string | null;
}

export interface WizardVariant {
  id: string;
  label: string;
  room_category: string | null;
  per_pax_usd: number | null;
  total_usd: number | null;
  margin_pct: number | null;
  recommended: boolean;
}

interface DeployResult {
  deployId?: string;
  subdomain?: string;
  publicUrl?: string;
  status?: string;
  broadcasts?: Record<string, string>;
  error?: string;
}

const MARGIN_FLOOR = 35;

function fmtUsd(n: number | null): string {
  return n == null ? '—' : `$${Math.round(n).toLocaleString('en-US')}`;
}

export default function LockWizard({ run, variants }: { run: WizardRun; variants: WizardVariant[] }) {
  const router = useRouter();
  const defaultVariant = variants.find((v) => v.recommended) ?? variants[0];
  const [variantId, setVariantId] = useState<string>(defaultVariant?.id ?? '');
  const [sales, setSales] = useState(true);
  const [social, setSocial] = useState(true);
  const [influencer, setInfluencer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DeployResult | null>(null);

  const selected = variants.find((v) => v.id === variantId) ?? defaultVariant;
  const marginOk = selected?.margin_pct != null && Number(selected.margin_pct) >= MARGIN_FLOOR;

  async function confirm() {
    if (!selected || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/compiler/runs/${run.id}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId: selected.id,
          channels: { sales, social, influencer },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as DeployResult;
      if (!res.ok) {
        setResult({ error: json.error ?? `deploy failed (${res.status})` });
      } else {
        setResult(json);
        router.refresh();
      }
    } catch (e: any) {
      setResult({ error: e?.message ?? String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={S.wrap}>
      <div style={S.col}>
        {/* Step 1 · variant */}
        <div style={S.panel}>
          <div style={S.panelTitle}>Step 1 · Lock a variant</div>
          <div style={S.panelSub}>{run.name} — “{run.prompt}”</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {variants.map((v) => (
              <label key={v.id} style={{ ...S.variantRow, ...(v.id === variantId ? S.variantRowActive : {}) }}>
                <input type="radio" name="variant" checked={v.id === variantId}
                       onChange={() => setVariantId(v.id)} style={{ accentColor: 'var(--color-brand-green)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.variantLabel}>
                    {v.label}{v.room_category ? ` · ${v.room_category}` : ''}
                    {v.recommended && <span style={S.recBadge}>recommended</span>}
                  </div>
                  <div style={S.variantMeta}>
                    {fmtUsd(v.per_pax_usd)}/pax · total {fmtUsd(v.total_usd)} ·
                    margin {v.margin_pct != null ? `${Math.round(Number(v.margin_pct))}%` : '—'}
                  </div>
                </div>
              </label>
            ))}
          </div>
          {selected && (
            <a href={`/api/compiler/runs/${run.id}/pdf?variant=${selected.id}`}
               target="_blank" rel="noopener noreferrer" style={{ ...S.btnSecondary, marginTop: 10, display: 'inline-block' }}>
              Preview offer document
            </a>
          )}
        </div>

        {/* Step 2 · channels */}
        <div style={S.panel}>
          <div style={S.panelTitle}>Step 2 · Where to promote</div>
          <div style={S.panelSub}>Web funnel goes live immediately. Other channels are queued for their cockpits — honest status, no fake “live”.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            <ChannelRow label="Web · public funnel /r/[slug]" desc="Publishes the retreat page — leads + checkout. Always on: deploying IS the funnel." checked disabled />
            <ChannelRow label="Sales · Packages" desc="Queued for the sales catalog — sales cockpit picks it up." checked={sales} onChange={setSales} />
            <ChannelRow label="Social cockpit" desc="Queued for the posting calendar — social cockpit picks it up." checked={social} onChange={setSocial} />
            <ChannelRow label="Influencer cockpit" desc="Queued for ambassador routing — influencer cockpit picks it up." checked={influencer} onChange={setInfluencer} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={confirm} disabled={busy || !selected}
                    style={{ ...S.btnPrimary, opacity: busy || !selected ? 0.6 : 1 }}>
              {busy ? 'Deploying…' : run.alreadyDeployed ? 'Re-lock & broadcast' : 'Confirm & broadcast'}
            </button>
            <a href="?view=ongoing" style={S.btnSecondary}>← Back</a>
            {!marginOk && selected && (
              <span style={S.warn}>Margin below {MARGIN_FLOOR}% floor — review pricing before selling.</span>
            )}
          </div>
        </div>

        {/* Result */}
        {result && (
          <div style={{ ...S.panel, borderColor: result.error ? 'var(--status-red)' : 'var(--status-green)' }}>
            {result.error ? (
              <div style={{ color: 'var(--status-red)', fontSize: 13 }}>Deploy failed: {result.error}</div>
            ) : (
              <>
                <div style={{ ...S.panelTitle, color: 'var(--status-green)' }}>Deployed</div>
                <div style={{ fontSize: 13, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span>Funnel live: <a href={result.publicUrl ?? '#'} target="_blank" rel="noopener noreferrer"
                     style={{ color: 'var(--color-brand-green)', fontWeight: 600 }}>{result.publicUrl}</a></span>
                  {result.broadcasts && (
                    <span style={{ color: 'var(--color-ink-soft)', fontSize: 12 }}>
                      Broadcasts: {Object.entries(result.broadcasts)
                        .filter(([k]) => k !== 'queued_at')
                        .map(([k, v]) => `${k}=${v}`).join(' · ')}
                    </span>
                  )}
                  <a href="?view=fixed" style={{ ...S.btnSecondary, alignSelf: 'flex-start', marginTop: 4 }}>
                    View fixed retreats →
                  </a>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Right rail — what actually happens */}
      <div style={S.col}>
        <div style={S.panel}>
          <div style={S.panelTitle}>On confirm · what actually happens</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            <FlowRow n="1" text="compiler.deploys row created (locked variant recorded)" />
            <FlowRow n="2" text="Retreat published → live funnel at /r/[slug] (lead + checkout)" />
            <FlowRow n="3" text="Selected channels logged as `queued` in the broadcast log" />
            <FlowRow n="4" text="Run status → deployed · appears under Fixed retreats" />
          </div>
        </div>
        <div style={S.panel}>
          <div style={S.panelTitle}>Lock checklist</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            <CheckRow ok={!!selected} text="Variant selected" />
            <CheckRow ok={selected?.per_pax_usd != null} text="Priced from real Cloudbeds rates" />
            <CheckRow ok={marginOk} text={`Margin ≥ ${MARGIN_FLOOR}%`} />
            <CheckRow ok={run.status === 'ready' || run.alreadyDeployed} text="Run status ready" />
          </div>
        </div>
        <div style={S.panel}>
          <div style={S.panelTitle}>Honesty guardrails</div>
          <div style={{ fontSize: 12, color: 'var(--color-ink-soft)', lineHeight: 1.5, marginTop: 8 }}>
            Sales / Social / Influencer show <strong>queued</strong> until those cockpits actually
            pick the retreat up. Custom subdomains are not wired — the funnel lives on this
            domain at /r/[slug].
          </div>
        </div>
      </div>
    </div>
  );
}

function ChannelRow({ label, desc, checked, disabled, onChange }: {
  label: string; desc: string; checked: boolean; disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: disabled ? 'default' : 'pointer' }}>
      <input type="checkbox" checked={checked} disabled={disabled}
             onChange={(e) => onChange?.(e.target.checked)}
             style={{ marginTop: 3, accentColor: 'var(--color-brand-green)' }} />
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' }}>
          {label}{disabled && <span style={{ color: 'var(--color-ink-soft)', fontWeight: 400 }}> · always on</span>}
        </span>
        <span style={{ display: 'block', fontSize: 11, color: 'var(--color-ink-soft)' }}>{desc}</span>
      </span>
    </label>
  );
}

function FlowRow({ n, text }: { n: string; text: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--color-ink)' }}>
      <span style={{
        flex: '0 0 18px', height: 18, borderRadius: '50%',
        border: '1px solid var(--color-hairline)', display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center', fontSize: 10,
        color: 'var(--color-ink-soft)',
      }}>{n}</span>
      <span>{text}</span>
    </div>
  );
}

function CheckRow({ ok, text }: { ok: boolean; text: string }) {
  const c = ok ? 'var(--status-green)' : 'var(--status-red)';
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--color-ink)' }}>
      <span style={{
        width: 14, height: 14, borderRadius: 2, border: `1px solid ${c}`, color: c,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700,
      }}>{ok ? '✓' : '✕'}</span>
      <span>{text}</span>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  wrap: {
    display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
    gap: 14, alignItems: 'start',
  },
  col: { display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 },
  panel: {
    border: '1px solid var(--color-hairline)', borderRadius: 6,
    background: 'var(--color-white)', padding: 14,
  },
  panelTitle: {
    fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
    fontWeight: 600, color: 'var(--color-ink)',
  },
  panelSub: { fontSize: 12, color: 'var(--color-ink-soft)', marginTop: 4 },
  variantRow: {
    display: 'flex', gap: 10, alignItems: 'flex-start', padding: 10,
    border: '1px solid var(--color-hairline)', borderRadius: 4, cursor: 'pointer',
  },
  variantRowActive: {
    border: '1px solid var(--color-brand-green)',
    boxShadow: 'inset 0 0 0 1px var(--color-brand-green)',
  },
  variantLabel: { fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' },
  variantMeta: {
    fontSize: 11, color: 'var(--color-ink-soft)', marginTop: 2,
    fontVariantNumeric: 'tabular-nums',
  },
  recBadge: {
    marginLeft: 8, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'var(--status-green)', border: '1px solid var(--status-green)',
    borderRadius: 3, padding: '1px 5px',
  },
  warn: { fontSize: 11, color: 'var(--status-amber)' },
  btnPrimary: {
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
    color: 'var(--color-white)', background: 'var(--color-brand-green)',
    padding: '8px 16px', borderRadius: 4, border: '1px solid var(--color-brand-green)',
  },
  btnSecondary: {
    fontSize: 12, textDecoration: 'none', cursor: 'pointer',
    color: 'var(--color-ink)', background: 'var(--color-white)',
    padding: '6px 12px', borderRadius: 4, border: '1px solid var(--color-hairline)',
  },
};
