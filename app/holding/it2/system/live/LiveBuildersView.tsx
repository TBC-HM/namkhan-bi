'use client';

// app/holding/it2/system/live/LiveBuildersView.tsx
// ADR-209 builder heartbeat UI. One box per heartbeat row — live rounds get
// a pulsing green dot and sort to the top; finished/reclaimed rounds fade
// into a "recent" strip below. 10s poll, same pattern as HealthView.tsx.
//
// action-center-inbox-v1 §OI#2 + finding #31 (2026-08-04):
// - each live box streams the worker's landed commits from the push ledger
//   (file + message + landed/dispatched/failed state, last 5) — claims backed
//   by shipped evidence in the same box;
// - branch link shown when the worker pushes to a PR branch;
// - SILENT strip: briefs stuck in_progress with no live heartbeat render as
//   red boxes — a session that died without claiming is visible, not nothing;
// - every box links to its brief card;
// - ?brief=<slug> filters the board (the 👁 Watch CTA on module cards lands
//   here, on the builder's pulsing box — not on the brief text).
//
// Tokens reused from the existing cockpit design system (not re-invented).

import { useEffect, useState } from 'react';
import { TOKENS, SERIF, MONO } from '@/components/cockpit/tokens';

export type LiveRow = {
  heartbeat_id: number;
  brief_slug: string;
  worker_id: string;
  started_at: string;
  last_beat_at: string;
  lease_seconds: number;
  status: 'running' | 'done' | 'failed' | 'reclaimed';
  current_step: string | null;
  finished_at: string | null;
  finish_note: string | null;
  alive: boolean;
  age_seconds: number;
  brief_title: string | null;
  brief_status: string | null;
};

export type PushRow = {
  id: number;
  path: string;
  branch: string | null;
  message: string | null;
  ok: boolean | null;
  http: number | null;
  pushed_at: string;
};

export type SilentRow = {
  slug: string;
  title: string | null;
  status: string;
  last_updated_at: string | null;
};

function fmtAge(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  return `${Math.round(sec / 3600)}h`;
}

function statusDot(row: LiveRow): string {
  if (row.alive) return TOKENS.moss; // live — green
  if (row.status === 'reclaimed') return TOKENS.terracotta; // stalled/reclaimed — red-orange
  if (row.status === 'failed') return TOKENS.oxblood;
  return TOKENS.text3; // done — neutral grey
}

function statusLabel(row: LiveRow): string {
  if (row.alive) return 'live';
  return row.status;
}

// Attribute ledger rows to a heartbeat round: commit message containing the
// brief slug wins; otherwise a push inside the round's time window counts.
// (Ledger rows carry no worker_id — slug match is the strong signal; the
// window fallback can mis-attribute during parallel rounds, so slug first.)
function pushesForRow(row: LiveRow, pushes: PushRow[]): PushRow[] {
  const end = row.finished_at ?? new Date().toISOString();
  const out = pushes.filter((p) => {
    const msg = p.message ?? '';
    if (msg.toLowerCase().includes(row.brief_slug.toLowerCase())) return true;
    return p.pushed_at >= row.started_at && p.pushed_at <= end;
  });
  return out.slice(0, 5);
}

function pushState(p: PushRow): { mark: string; color: string; label: string } {
  if (p.http === 200 || p.http === 201) return { mark: '✓', color: TOKENS.moss, label: 'landed' };
  if (p.http == null) return { mark: '…', color: TOKENS.sand, label: 'dispatched' };
  return { mark: '✗', color: TOKENS.oxblood, label: `failed ${p.http}` };
}

function CommitList({ row, pushes }: { row: LiveRow; pushes: PushRow[] }) {
  const mine = pushesForRow(row, pushes);
  if (mine.length === 0) return null;
  const branch = mine.find((p) => p.branch && p.branch !== 'main')?.branch ?? null;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontFamily: MONO, fontSize: 9, color: TOKENS.text3, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 }}>
        Shipped evidence
        {branch && (
          <a
            href={`https://github.com/TBC-HM/namkhan-bi/pulls?q=is%3Apr+head%3A${encodeURIComponent(branch)}`}
            target="_blank"
            rel="noreferrer"
            style={{ marginLeft: 8, color: TOKENS.forest, textDecoration: 'none', textTransform: 'none' }}
          >
            PR: {branch} ↗
          </a>
        )}
      </div>
      {mine.map((p) => {
        const st = pushState(p);
        return (
          <div key={p.id} style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 10.5, fontFamily: MONO, padding: '2px 0' }}>
            <span style={{ color: st.color, fontWeight: 700 }} title={st.label}>{st.mark}</span>
            <span style={{ color: TOKENS.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }} title={p.path}>
              {p.path.split('/').pop()}
            </span>
            <span style={{ color: TOKENS.text3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }} title={p.message ?? ''}>
              {p.message ?? ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function LiveBuildersView({
  initial,
  initialPushes = [],
  initialSilent = [],
  initialError,
  filterBrief = null,
}: {
  initial: LiveRow[];
  // Optional with defaults so the component can land one commit ahead of its
  // page (push-order law 759: every intermediate commit must stay tsc-green).
  initialPushes?: PushRow[];
  initialSilent?: SilentRow[];
  initialError: string | null;
  filterBrief?: string | null;
}) {
  const [rows, setRows] = useState<LiveRow[]>(initial);
  const [pushes, setPushes] = useState<PushRow[]>(initialPushes);
  const [silent, setSilent] = useState<SilentRow[]>(initialSilent);
  const [error, setError] = useState<string | null>(initialError);
  const [refreshedAt, setRefreshedAt] = useState<number>(0);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        setPending(true);
        const res = await fetch('/api/system/live-builders', { cache: 'no-store' });
        if (!res.ok) return;
        const j = (await res.json()) as {
          rows?: LiveRow[];
          pushes?: PushRow[];
          silent?: SilentRow[];
          error?: string;
        };
        if (!cancelled) {
          if (j.rows) setRows(j.rows);
          if (j.pushes) setPushes(j.pushes);
          if (j.silent) setSilent(j.silent);
          setError(j.error ?? null);
          setRefreshedAt(Date.now());
        }
      } catch {
        // swallow — next tick retries
      } finally {
        if (!cancelled) setPending(false);
      }
    };
    const id = window.setInterval(tick, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const visible = filterBrief ? rows.filter((r) => r.brief_slug === filterBrief) : rows;
  const visibleSilent = filterBrief ? silent.filter((s) => s.slug === filterBrief) : silent;
  const live = visible.filter((r) => r.alive);
  const recent = visible.filter((r) => !r.alive).slice(0, 12);

  return (
    <div style={{ color: TOKENS.ink, fontFamily: 'var(--sans)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 18,
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
        <h2 style={{ fontFamily: SERIF, fontSize: 22, margin: 0 }}>Live builders</h2>
        <div style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3 }}>
          {live.length} live now · {refreshedAt > 0 && fmtAge(Math.round((Date.now() - refreshedAt) / 1000))}
          {pending && <span style={{ marginLeft: 6, color: TOKENS.sand }}>· refreshing…</span>}
        </div>
      </div>

      {/* finding #31: Watch lands here filtered — say what's being watched */}
      {filterBrief && (
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
            padding: '8px 12px',
            marginBottom: 14,
            background: `${TOKENS.moss}14`,
            border: `1px solid ${TOKENS.moss}`,
            borderRadius: 2,
            fontSize: 12,
          }}
        >
          <span>
            Watching <strong style={{ fontFamily: MONO }}>{filterBrief}</strong> — live heartbeat + landed commits for this brief only.
          </span>
          <a href={`/holding/it2/modules/briefs/${filterBrief}`} style={{ color: TOKENS.forest, fontWeight: 700, textDecoration: 'none' }}>
            📄 Brief →
          </a>
          <a href="/holding/it2/system/live" style={{ marginLeft: 'auto', color: TOKENS.text2, textDecoration: 'none' }}>
            ✕ whole fleet
          </a>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: 12,
            marginBottom: 16,
            background: `${TOKENS.oxblood}18`,
            border: `1px solid ${TOKENS.oxblood}`,
            borderRadius: 2,
            fontSize: 12,
            color: TOKENS.oxblood,
          }}
        >
          {error}
        </div>
      )}

      {/* Silent deaths — expected builders that never beat (§OI#2 item 3) */}
      {visibleSilent.length > 0 && (
        <>
          <SectionLabel>⚠ Silent — in progress, no live builder</SectionLabel>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 12,
              marginBottom: 24,
            }}
          >
            {visibleSilent.map((s) => (
              <a
                key={s.slug}
                href={`/holding/it2/modules/briefs/${s.slug}`}
                style={{
                  display: 'block',
                  padding: '14px 16px',
                  background: `${TOKENS.oxblood}0D`,
                  border: `1px solid ${TOKENS.oxblood}`,
                  borderRadius: 2,
                  textDecoration: 'none',
                  color: TOKENS.ink,
                }}
              >
                <div style={{ fontFamily: MONO, fontSize: 10, color: TOKENS.oxblood, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>
                  ● no heartbeat
                </div>
                <div style={{ fontFamily: SERIF, fontSize: 15, marginBottom: 2 }}>{s.title ?? s.slug}</div>
                <div style={{ fontSize: 11, color: TOKENS.text2 }}>
                  Brief says <strong>in progress</strong> but no builder is beating — the session likely died without claiming. Open the brief card ↗
                </div>
              </a>
            ))}
          </div>
        </>
      )}

      {/* Live grid — the actual "box per running activity" ask */}
      <SectionLabel>Running now</SectionLabel>
      {live.length === 0 ? (
        <div
          style={{
            padding: 16,
            border: `1px dashed ${TOKENS.border}`,
            borderRadius: 2,
            color: TOKENS.text3,
            fontSize: 12,
            marginBottom: 24,
          }}
        >
          {filterBrief
            ? 'No live builder on this brief right now — check "Recent" below for the last rounds, or the red strip above if it stalled.'
            : 'Nothing has a live lease right now. A round only shows here while it’s actively beating (ADR-209) — check "Recent" below for what just finished or stalled.'}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 12,
            marginBottom: 24,
          }}
        >
          {live.map((row) => (
            <div
              key={row.heartbeat_id}
              style={{
                padding: '14px 16px',
                background: TOKENS.bgRaised,
                border: `1px solid ${TOKENS.border}`,
                borderRadius: 2,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: statusDot(row),
                    boxShadow: `0 0 0 4px ${statusDot(row)}33`,
                    animation: 'builder-pulse 1.6s ease-in-out infinite',
                  }}
                />
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 10,
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                    color: TOKENS.moss,
                  }}
                >
                  {statusLabel(row)}
                </span>
                <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 10, color: TOKENS.text3 }}>
                  {fmtAge(row.age_seconds)} ago
                </span>
              </div>

              <a
                href={`/holding/it2/modules/briefs/${row.brief_slug}`}
                style={{ fontFamily: SERIF, fontSize: 15, color: TOKENS.ink, marginBottom: 2, display: 'block', textDecoration: 'none' }}
              >
                {row.brief_title ?? row.brief_slug} ↗
              </a>
              <div style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text2, marginBottom: 8 }}>
                {row.worker_id}
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: TOKENS.ink,
                  background: TOKENS.bg,
                  border: `1px solid ${TOKENS.borderSoft}`,
                  borderRadius: 2,
                  padding: '6px 8px',
                }}
              >
                {row.current_step ?? '—'}
              </div>

              {/* §OI#2: landed commits under the step — evidence, not claims */}
              <CommitList row={row} pushes={pushes} />
            </div>
          ))}
        </div>
      )}

      {/* Recent — finished/reclaimed, for context on what just happened */}
      <SectionLabel>Recent ({recent.length})</SectionLabel>
      {recent.length === 0 ? (
        <div style={{ padding: 12, color: TOKENS.text3, fontSize: 12 }}>Nothing yet.</div>
      ) : (
        <div
          style={{
            border: `1px solid ${TOKENS.border}`,
            background: TOKENS.bgRaised,
            borderRadius: 2,
          }}
        >
          {recent.map((row) => (
            <div
              key={row.heartbeat_id}
              style={{
                display: 'grid',
                gridTemplateColumns: '70px 1fr 140px 90px',
                gap: 12,
                alignItems: 'center',
                padding: '8px 12px',
                borderBottom: `1px solid ${TOKENS.borderSoft}`,
                fontSize: 12,
              }}
            >
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  color: statusDot(row),
                  textTransform: 'uppercase',
                }}
              >
                {statusLabel(row)}
              </span>
              <a href={`/holding/it2/modules/briefs/${row.brief_slug}`} style={{ color: TOKENS.ink, textDecoration: 'none' }}>
                {row.brief_title ?? row.brief_slug}
              </a>
              <span style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text2 }}>{row.worker_id}</span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: TOKENS.text3, textAlign: 'right' }}>
                {fmtAge(row.age_seconds)} ago
              </span>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes builder-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: MONO,
        fontSize: 10,
        color: TOKENS.text3,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}
