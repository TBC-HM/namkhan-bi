'use client';

// app/holding/it2/system/live/LiveBuildersView.tsx
// ADR-209 builder heartbeat UI. One box per heartbeat row — live rounds get
// a pulsing green dot and sort to the top; finished/reclaimed rounds fade
// into a "recent" strip below. 10s poll, same pattern as HealthView.tsx.
//
// Tokens reused from the existing cockpit design system (not re-invented).

import { useEffect, useState } from 'react';
import { TOKENS, SERIF, MONO } from '@/app/holding/it/cockpit/_components/tokens';

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

export function LiveBuildersView({
  initial,
  initialError,
}: {
  initial: LiveRow[];
  initialError: string | null;
}) {
  const [rows, setRows] = useState<LiveRow[]>(initial);
  const [error, setError] = useState<string | null>(initialError);
  const [refreshedAt, setRefreshedAt] = useState<number>(Date.now());
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        setPending(true);
        const res = await fetch('/api/system/live-builders', { cache: 'no-store' });
        if (!res.ok) return;
        const j = (await res.json()) as { rows?: LiveRow[]; error?: string };
        if (!cancelled) {
          if (j.rows) setRows(j.rows);
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

  const live = rows.filter((r) => r.alive);
  const recent = rows.filter((r) => !r.alive).slice(0, 12);

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
          {live.length} live now · refreshed {fmtAge(Math.round((Date.now() - refreshedAt) / 1000))} ago
          {pending && <span style={{ marginLeft: 6, color: TOKENS.sand }}>· refreshing…</span>}
        </div>
      </div>

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
          Nothing has a live lease right now. A round only shows here while it&apos;s actively
          beating (ADR-209) — check &quot;Recent&quot; below for what just finished or stalled.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
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

              <div style={{ fontFamily: SERIF, fontSize: 15, color: TOKENS.ink, marginBottom: 2 }}>
                {row.brief_title ?? row.brief_slug}
              </div>
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
              <span style={{ color: TOKENS.ink }}>{row.brief_title ?? row.brief_slug}</span>
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
