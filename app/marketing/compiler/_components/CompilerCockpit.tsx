// app/marketing/compiler/_components/CompilerCockpit.tsx
//
// Brief autospec-compiler_module-20260725 · A1/A2 (2026-07-30).
// v2 — REAL DATA. The v1 component rendered hardcoded arrays (five fake
// retreats with invented MTD revenue) — owner-facing fake data, deleted here.
// Every row below is sourced from compiler.runs / compiler.variants /
// compiler.deploys / web_analytics.retreats. No revenue column: no real
// bookings-revenue source exists for retreats yet (brief §5.1 — omit, never
// invent). Spots booked/remaining come from web_analytics.retreats (real).
//
// Views via ?view=:
//   ongoing  · runs not yet deployed (default)
//   fixed    · deployed runs joined to their live /r/[slug] retreat
//   lock     · Lock & Distribute wizard (?view=lock&offer=<run_id>) —
//              drives the EXISTING /api/compiler/runs/[id]/deploy route.
//              Social/influencer selections write honest `queued` broadcast
//              entries, never fake `live` (D3).

import type { CSSProperties } from 'react';
import { Container, KpiTile } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import LockWizard, { type WizardRun, type WizardVariant } from './LockWizard';

type View = 'ongoing' | 'fixed' | 'lock';

interface Props {
  view: View;
  selectedOfferId?: string;
}

// ─── Row shapes (all sourced from public bridge views / compiler schema) ──

interface RunRow {
  id: string;
  prompt: string;
  parsed_spec: any;
  status: string;
  property_id: number | null;
  created_at: string;
  updated_at: string | null;
}

interface VariantRow {
  id: string;
  run_id: string;
  label: string;
  room_category: string | null;
  per_pax_usd: number | null;
  total_usd: number | null;
  margin_pct: number | null;
  recommended: boolean | null;
}

interface DeployRow {
  id: string;
  run_id: string;
  variant_id: string | null;
  subdomain: string | null;
  status: string | null;
  deployed_at: string | null;
  created_at: string;
  broadcast_targets: Record<string, string> | null;
}

interface RetreatRow {
  id: string;
  run_id: string | null;
  slug: string;
  name: string;
  tagline: string | null;
  arrival_window_from: string | null;
  arrival_window_to: string | null;
  spots_total: number | null;
  spots_booked: number | null;
  spots_remaining: number | null;
  price_usd_from: number | null;
  status: string | null;
}

type BroadcastState = 'live' | 'queued' | 'off';

const CHANNELS: { key: string; label: string }[] = [
  { key: 'sales',      label: 'Sales · Packages' },
  { key: 'social',     label: 'Social cockpit' },
  { key: 'influencer', label: 'Influencer cockpit' },
  { key: 'web',        label: 'Web · /r/ funnel' },
];

// Legacy deploys (pre broadcast_targets column): the /r/ funnel really is
// live; nothing else was ever wired — render honestly.
function broadcastOf(d: DeployRow | undefined): Record<string, BroadcastState> {
  const raw = d?.broadcast_targets ?? {};
  const norm = (v: unknown, fallback: BroadcastState): BroadcastState =>
    v === 'live' || v === 'queued' || v === 'off' ? v : fallback;
  return {
    web:        norm(raw['web'], d ? 'live' : 'off'),
    sales:      norm(raw['sales'], 'off'),
    social:     norm(raw['social'], 'off'),
    influencer: norm(raw['influencer'], 'off'),
  };
}

async function loadCockpit() {
  const admin = getSupabaseAdmin();
  const [runsQ, variantsQ, deploysQ, retreatsQ] = await Promise.all([
    admin.from('v_compiler_runs')
      .select('id, prompt, parsed_spec, status, property_id, created_at, updated_at')
      .order('created_at', { ascending: false }).limit(50),
    admin.from('v_compiler_variants')
      .select('id, run_id, label, room_category, per_pax_usd, total_usd, margin_pct, recommended'),
    admin.schema('compiler').from('deploys')
      .select('id, run_id, variant_id, subdomain, status, deployed_at, created_at, broadcast_targets')
      .order('created_at', { ascending: false }),
    admin.from('v_retreats')
      .select('id, run_id, slug, name, tagline, arrival_window_from, arrival_window_to, spots_total, spots_booked, spots_remaining, price_usd_from, status'),
  ]);
  return {
    runs: (runsQ.data ?? []) as RunRow[],
    variants: (variantsQ.data ?? []) as VariantRow[],
    deploys: (deploysQ.data ?? []) as DeployRow[],
    retreats: (retreatsQ.data ?? []) as RetreatRow[],
    err: runsQ.error?.message ?? variantsQ.error?.message ?? deploysQ.error?.message ?? retreatsQ.error?.message ?? null,
  };
}

function runName(run: RunRow): string {
  const spec = run.parsed_spec ?? {};
  const theme = String(spec.theme ?? 'retreat').replace(/-/g, ' ');
  const nights = spec.duration_nights ?? '?';
  return `${nights}-night ${theme}`.replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtUsd(n: number | null | undefined): string {
  return n == null ? '—' : `$${Math.round(Number(n)).toLocaleString('en-US')}`;
}

function fmtDate(s: string | null | undefined): string {
  return s ? String(s).slice(0, 10) : '—';
}

// ─── Component (async server component — fetches live rows) ──────────────

export default async function CompilerCockpit({ view, selectedOfferId }: Props) {
  const { runs, variants, deploys, retreats, err } = await loadCockpit();

  const variantsByRun = new Map<string, VariantRow[]>();
  for (const v of variants) {
    const list = variantsByRun.get(v.run_id) ?? [];
    list.push(v);
    variantsByRun.set(v.run_id, list);
  }
  const latestDeployByRun = new Map<string, DeployRow>();
  for (const d of deploys) {
    if (!latestDeployByRun.has(d.run_id)) latestDeployByRun.set(d.run_id, d);
  }
  const retreatByRun = new Map<string, RetreatRow>();
  for (const r of retreats) {
    if (r.run_id && !retreatByRun.has(r.run_id)) retreatByRun.set(r.run_id, r);
  }

  const ongoing = runs.filter((r) => r.status !== 'deployed');
  const fixed = runs.filter((r) => r.status === 'deployed');

  const spotsBooked = retreats.reduce((s, r) => s + (r.spots_booked ?? 0), 0);
  const spotsRemaining = retreats.reduce((s, r) => s + (r.spots_remaining ?? 0), 0);
  const queuedBroadcasts = deploys.reduce((s, d) => {
    const b = d.broadcast_targets ?? {};
    return s + Object.values(b).filter((v) => v === 'queued').length;
  }, 0);

  const selectedRun = selectedOfferId ? runs.find((r) => r.id === selectedOfferId) : undefined;

  return (
    <>
      {/* KPI band — every number from live rows (no invented revenue) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 16 }}>
        <KpiTile label="Ongoing offers" value={ongoing.length} size="sm" footnote="runs not yet deployed" />
        <KpiTile label="Fixed retreats" value={fixed.length} size="sm" footnote="deployed · live funnel" />
        <KpiTile label="Priced variants" value={variants.length} size="sm" footnote="from Cloudbeds rates" />
        <KpiTile label="Spots booked" value={spotsBooked} size="sm" footnote={`${spotsRemaining} remaining`} />
        <KpiTile label="Queued broadcasts" value={queuedBroadcasts} size="sm" footnote="awaiting channel pickup" />
      </div>

      {/* Sub-strip */}
      <div style={S.subStrip}>
        {(['ongoing', 'fixed'] as View[]).map((v) => (
          <a key={v} href={`?view=${v}`}
             style={{ ...S.subStripLink, ...(v === view ? S.subStripLinkActive : {}) }}>
            {v === 'ongoing' ? 'Ongoing offers' : 'Fixed retreats'}
          </a>
        ))}
        {view === 'lock' && (
          <span style={{ ...S.subStripLink, ...S.subStripLinkActive }}>
            Lock &amp; distribute{selectedRun ? ` · ${runName(selectedRun)}` : ''}
          </span>
        )}
      </div>

      {err && (
        <div style={S.errBox}>DB error: {err}</div>
      )}

      {view === 'ongoing' && (
        <OngoingSection runs={ongoing} variantsByRun={variantsByRun} />
      )}
      {view === 'fixed' && (
        <FixedSection runs={fixed} variantsByRun={variantsByRun}
                      latestDeployByRun={latestDeployByRun} retreatByRun={retreatByRun} />
      )}
      {view === 'lock' && (
        <LockSection run={selectedRun} variantsByRun={variantsByRun}
                     latestDeploy={selectedRun ? latestDeployByRun.get(selectedRun.id) : undefined} />
      )}
    </>
  );
}

// ─── ONGOING · real compiler.runs ─────────────────────────────────────────

function OngoingSection({ runs, variantsByRun }: {
  runs: RunRow[];
  variantsByRun: Map<string, VariantRow[]>;
}) {
  return (
    <Container title="Ongoing offers" subtitle={`${runs.length} in build · prompt → pricing → offer doc → lock`}>
      {runs.length === 0 ? (
        <EmptyState title="No offers in build."
                    sub="Type a prompt in the bar below (or click a seed template) to start one." />
      ) : (
        <div style={S.cardGrid}>
          {runs.map((r) => <OngoingCard key={r.id} run={r} variants={variantsByRun.get(r.id) ?? []} />)}
        </div>
      )}
    </Container>
  );
}

function OngoingCard({ run, variants }: { run: RunRow; variants: VariantRow[] }) {
  const spec = run.parsed_spec ?? {};
  const priced = variants.filter((v) => v.per_pax_usd != null);
  const perPaxMin = priced.length ? Math.min(...priced.map((v) => Number(v.per_pax_usd))) : null;
  const perPaxMax = priced.length ? Math.max(...priced.map((v) => Number(v.per_pax_usd))) : null;
  const bestMargin = priced.length ? Math.max(...priced.map((v) => Number(v.margin_pct ?? 0))) : null;
  const canLock = run.status === 'ready' && priced.length > 0;
  const priceBand = perPaxMin == null ? 'TBD'
    : perPaxMin === perPaxMax ? `${fmtUsd(perPaxMin)}/pax`
    : `${fmtUsd(perPaxMin)}–${fmtUsd(perPaxMax)}/pax`;

  return (
    <div style={S.card}>
      <div style={S.cardHead}>
        <div>
          <div style={S.cardType}>{String(spec.theme ?? 'retreat').replace(/-/g, ' ')}</div>
          <div style={S.cardName}>{runName(run)}</div>
        </div>
        <span style={statusPill(run.status)}>{run.status}</span>
      </div>
      <div style={S.cardMeta}>
        {spec.duration_nights ?? '?'} nights · {spec.pax ?? '?'} pax
        {Array.isArray(spec.tier) && spec.tier.length > 0 ? ` · ${spec.tier.join('/')}` : ''}
        {Array.isArray(spec.season) && spec.season.length > 0 ? ` · ${spec.season.join('/')} season` : ''}
        {spec.lunar_required ? ' · full moon' : ''}
      </div>
      <div style={S.cardPrompt}>“{run.prompt}”</div>
      <div style={S.statRow}>
        <Stat label="Variants" value={String(variants.length)} />
        <Stat label="Price band" value={priceBand} />
        <Stat label="Best margin" value={bestMargin != null ? `${Math.round(bestMargin)}%` : '—'} />
        <Stat label="Created" value={fmtDate(run.created_at)} />
      </div>
      <div style={S.actions}>
        <a href={`/marketing/compiler/${run.id}`} style={S.btnSecondary}>Variants</a>
        <a href={`/marketing/compiler/${run.id}/edit`} style={S.btnSecondary}>Edit</a>
        {priced.length > 0 && (
          <a href={`/api/compiler/runs/${run.id}/pdf`} target="_blank" rel="noopener noreferrer" style={S.btnSecondary}>Offer doc</a>
        )}
        <a href={`?view=lock&offer=${run.id}`}
           aria-disabled={!canLock}
           style={canLock ? S.btnPrimary : { ...S.btnSecondary, opacity: 0.45, pointerEvents: 'none' as const }}>
          Lock &amp; distribute
        </a>
      </div>
    </div>
  );
}

// ─── FIXED · deployed runs joined to live web_analytics.retreats ──────────

function FixedSection({ runs, variantsByRun, latestDeployByRun, retreatByRun }: {
  runs: RunRow[];
  variantsByRun: Map<string, VariantRow[]>;
  latestDeployByRun: Map<string, DeployRow>;
  retreatByRun: Map<string, RetreatRow>;
}) {
  return (
    <Container title="Fixed retreats" subtitle={`${runs.length} locked · live funnel + per-channel broadcast log`}>
      {runs.length === 0 ? (
        <EmptyState title="No fixed retreats yet."
                    sub="Lock & distribute an ongoing offer to publish it here." />
      ) : (
        <div style={S.cardGrid}>
          {runs.map((r) => (
            <FixedCard key={r.id} run={r}
                       variants={variantsByRun.get(r.id) ?? []}
                       deploy={latestDeployByRun.get(r.id)}
                       retreat={retreatByRun.get(r.id)} />
          ))}
        </div>
      )}
    </Container>
  );
}

function FixedCard({ run, variants, deploy, retreat }: {
  run: RunRow; variants: VariantRow[]; deploy?: DeployRow; retreat?: RetreatRow;
}) {
  const b = broadcastOf(deploy);
  const locked = variants.find((v) => v.id === deploy?.variant_id) ?? variants.find((v) => v.recommended) ?? variants[0];
  return (
    <div style={S.card}>
      <div style={S.cardHead}>
        <div>
          <div style={S.cardType}>Locked · {fmtDate(deploy?.deployed_at ?? deploy?.created_at)}</div>
          <div style={S.cardName}>{retreat?.name ?? runName(run)}</div>
        </div>
        <span style={statusPill('deployed')}>for sale</span>
      </div>
      <div style={S.cardMeta}>
        {retreat?.tagline ?? '—'}
        {locked?.per_pax_usd != null ? ` · from ${fmtUsd(retreat?.price_usd_from ?? locked.per_pax_usd)}/pax` : ''}
      </div>
      <div style={S.statRow}>
        <Stat label="Spots booked" value={retreat ? `${retreat.spots_booked ?? 0}/${retreat.spots_total ?? 0}` : '—'} />
        <Stat label="Remaining" value={retreat?.spots_remaining != null ? String(retreat.spots_remaining) : '—'} />
        <Stat label="Window" value={retreat ? `${fmtDate(retreat.arrival_window_from)} → ${fmtDate(retreat.arrival_window_to)}` : '—'} />
        <Stat label="Margin" value={locked?.margin_pct != null ? `${Math.round(Number(locked.margin_pct))}%` : '—'} />
      </div>
      <div style={S.broadcastBox}>
        <div style={S.broadcastLabel}>Broadcast log</div>
        <div style={S.broadcastRow}>
          {CHANNELS.map((c) => <BroadcastBadge key={c.key} label={c.label} state={b[c.key] ?? 'off'} />)}
        </div>
      </div>
      <div style={S.actions}>
        {retreat && (
          <a href={`/r/${retreat.slug}`} target="_blank" rel="noopener noreferrer" style={S.btnSecondary}>Funnel page</a>
        )}
        <a href={`/api/compiler/runs/${run.id}/pdf${locked ? `?variant=${locked.id}` : ''}`}
           target="_blank" rel="noopener noreferrer" style={S.btnSecondary}>Offer doc</a>
        <a href={`/marketing/compiler/${run.id}`} style={S.btnSecondary}>Variants</a>
        <a href={`?view=lock&offer=${run.id}`} style={S.btnSecondary}>Re-lock</a>
      </div>
    </div>
  );
}

function BroadcastBadge({ label, state }: { label: string; state: BroadcastState }) {
  const color = state === 'live' ? 'var(--status-green)' :
                state === 'queued' ? 'var(--status-amber)' :
                                     'var(--status-grey)';
  const icon = state === 'live' ? '✓' : state === 'queued' ? '…' : '—';
  return (
    <span style={{
      display: 'inline-flex', gap: 4, alignItems: 'center',
      fontSize: 10, letterSpacing: '0.08em',
      padding: '2px 6px',
      border: `1px solid ${color}`, color, borderRadius: 3,
    }}>
      <span style={{ fontWeight: 700 }}>{icon}</span>{label} · {state}
    </span>
  );
}

// ─── LOCK & DISTRIBUTE · drives the real deploy route ─────────────────────

function LockSection({ run, variantsByRun, latestDeploy }: {
  run?: RunRow;
  variantsByRun: Map<string, VariantRow[]>;
  latestDeploy?: DeployRow;
}) {
  if (!run) {
    return (
      <Container title="Lock & distribute" subtitle="no offer selected">
        <EmptyState title="Select an offer to lock."
                    sub="Go to Ongoing offers and click Lock & distribute on a card." />
      </Container>
    );
  }
  const variants = variantsByRun.get(run.id) ?? [];
  if (variants.length === 0) {
    return (
      <Container title="Lock & distribute" subtitle={runName(run)}>
        <EmptyState title="No priced variants yet."
                    sub="Open the run, set the offer window + room types, and build variants first." />
      </Container>
    );
  }
  const wizardRun: WizardRun = {
    id: run.id,
    name: runName(run),
    prompt: run.prompt,
    status: run.status,
    alreadyDeployed: !!latestDeploy,
    lastSlug: latestDeploy?.subdomain ?? null,
  };
  const wizardVariants: WizardVariant[] = variants.map((v) => ({
    id: v.id,
    label: v.label,
    room_category: v.room_category,
    per_pax_usd: v.per_pax_usd == null ? null : Number(v.per_pax_usd),
    total_usd: v.total_usd == null ? null : Number(v.total_usd),
    margin_pct: v.margin_pct == null ? null : Number(v.margin_pct),
    recommended: !!v.recommended,
  }));
  return <LockWizard run={wizardRun} variants={wizardVariants} />;
}

// ─── Small shared bits ────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={S.statLabel}>{label}</span>
      <span style={S.statValue}>{value}</span>
    </div>
  );
}

function EmptyState({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ padding: '28px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--color-ink-soft)' }}>{sub}</div>
    </div>
  );
}

function statusPill(s: string): CSSProperties {
  const c = s === 'deployed' ? 'var(--status-green)' :
            s === 'ready'    ? 'var(--status-amber)' :
            s === 'halted' || s === 'error' ? 'var(--status-red)' :
                               'var(--status-grey)';
  return {
    fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' as const,
    color: c, border: `1px solid ${c}`, borderRadius: 3, padding: '2px 8px',
    whiteSpace: 'nowrap' as const, alignSelf: 'flex-start',
  };
}

const S: Record<string, CSSProperties> = {
  subStrip: {
    display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap',
  },
  subStripLink: {
    fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase',
    color: 'var(--color-ink-soft)', textDecoration: 'none',
    padding: '6px 12px', border: '1px solid var(--color-hairline)', borderRadius: 4,
    background: 'var(--color-white)',
  },
  subStripLinkActive: {
    color: 'var(--color-white)', background: 'var(--color-brand-green)',
    border: '1px solid var(--color-brand-green)',
  },
  errBox: {
    padding: '8px 12px', marginBottom: 12,
    border: '1px solid var(--status-red)', borderRadius: 4,
    color: 'var(--status-red)', fontSize: 12,
  },
  cardGrid: {
    padding: 4, display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 12,
  },
  card: {
    border: '1px solid var(--color-hairline)', borderRadius: 6,
    padding: 14, background: 'var(--color-white)',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  cardHead: { display: 'flex', justifyContent: 'space-between', gap: 8 },
  cardType: {
    fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
    color: 'var(--color-ink-soft)', marginBottom: 2,
  },
  cardName: { fontSize: 15, fontWeight: 600, color: 'var(--color-ink)' },
  cardMeta: { fontSize: 12, color: 'var(--color-ink-soft)' },
  cardPrompt: {
    fontSize: 11, color: 'var(--color-ink-soft)', fontStyle: 'italic',
    borderLeft: '2px solid var(--color-hairline)', paddingLeft: 8,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  statRow: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 8,
  },
  statLabel: {
    fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
    color: 'var(--color-ink-soft)',
  },
  statValue: {
    fontSize: 12, fontWeight: 600, color: 'var(--color-ink)',
    fontVariantNumeric: 'tabular-nums',
  },
  broadcastBox: {
    border: '1px dashed var(--color-hairline)', borderRadius: 4, padding: 8,
  },
  broadcastLabel: {
    fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
    color: 'var(--color-ink-soft)', marginBottom: 6,
  },
  broadcastRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  actions: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  btnPrimary: {
    fontSize: 12, fontWeight: 600, textDecoration: 'none',
    color: 'var(--color-white)', background: 'var(--color-brand-green)',
    padding: '6px 12px', borderRadius: 4, border: '1px solid var(--color-brand-green)',
  },
  btnSecondary: {
    fontSize: 12, textDecoration: 'none',
    color: 'var(--color-ink)', background: 'var(--color-white)',
    padding: '6px 12px', borderRadius: 4, border: '1px solid var(--color-hairline)',
  },
};
