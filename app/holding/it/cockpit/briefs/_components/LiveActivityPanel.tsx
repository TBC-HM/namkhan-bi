'use client';
// app/holding/it/cockpit/briefs/_components/LiveActivityPanel.tsx
// Bug #105 — Live activity panel for briefs in research/in_progress/verifying.
// Auto-refreshes every 30s. Stall flag if no update >90min while in_progress.

import React, { useEffect, useState, useCallback } from 'react';
import { TOKENS, MONO } from '../../_components/tokens';

type PushEvent = {
  id: string;
  pushed_at: string;
  file_path: string | null;
  section_header: string | null;
  pushed_by: string | null;
};

type ActivityData = {
  status: string;
  last_updated_by: string | null;
  last_updated_at: string | null;
  events: PushEvent[];
};

function minutesAgo(iso: string | null): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

function fmtMins(mins: number): string {
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
}

export default function LiveActivityPanel({ slug }: { slug: string }) {
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/briefs/${slug}/activity`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // silently ignore — stale data stays visible
    } finally {
      setLoading(false);
      setLastFetch(new Date());
    }
  }, [slug]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div style={{
        padding: '12px 16px',
        background: TOKENS.bg,
        border: `1px solid ${TOKENS.border}`,
        borderRadius: 8,
        marginBottom: 16,
        fontSize: 12,
        color: TOKENS.text2,
        fontFamily: MONO,
      }}>
        Loading live activity…
      </div>
    );
  }

  if (!data) return null;

  const ACTIVE_STATUSES = ['research', 'in_progress', 'verifying'];
  if (!ACTIVE_STATUSES.includes(data.status)) return null;

  const minsStale = minutesAgo(data.last_updated_at);
  const isStalled = data.status === 'in_progress' && minsStale > 90;

  const STAGE_LABEL: Record<string, string> = {
    research:    '§0.R — Research',
    in_progress: '§0.B — Building',
    verifying:   '§0.V — Verifying',
  };

  return (
    <div style={{
      marginBottom: 20,
      border: `1px solid ${isStalled ? 'var(--status-amber)' : TOKENS.border}`,
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        background: isStalled ? 'var(--status-amber-bg, var(--status-amber))' : TOKENS.bgRaised,
        borderBottom: `1px solid ${TOKENS.border}`,
        flexWrap: 'wrap',
      }}>
        {/* Live pulse dot */}
        <span style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: isStalled ? 'var(--status-amber)' : 'var(--status-green)',
          boxShadow: isStalled
            ? '0 0 0 3px var(--status-amber)'
            : '0 0 0 3px var(--status-green)',
          flexShrink: 0,
        }} />

        <span style={{ fontSize: 12, fontWeight: 700, color: TOKENS.ink }}>
          {STAGE_LABEL[data.status] ?? data.status}
        </span>

        {data.last_updated_by && (
          <span style={{ fontSize: 11, color: TOKENS.text2, fontFamily: MONO }}>
            · {data.last_updated_by}
          </span>
        )}

        <span style={{
          fontSize: 11,
          fontFamily: MONO,
          color: isStalled ? TOKENS.ink : TOKENS.text2,
          fontWeight: isStalled ? 700 : 400,
          marginLeft: 'auto',
        }}>
          {isStalled ? '⚠ STALLED · ' : ''}{fmtMins(minsStale)}
        </span>

        <span style={{
          fontSize: 10,
          color: TOKENS.text3,
          fontFamily: MONO,
          whiteSpace: 'nowrap',
        }}>
          auto-refresh 30s · fetched {lastFetch.toLocaleTimeString()}
        </span>
      </div>

      {/* Event feed */}
      <div style={{ padding: '10px 14px', background: TOKENS.bg }}>
        {data.events.length === 0 ? (
          <div style={{ fontSize: 11, color: TOKENS.text3, fontFamily: MONO }}>No push events yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {data.events.map((ev) => (
              <div key={ev.id} style={{
                display: 'flex',
                gap: 10,
                alignItems: 'baseline',
                fontSize: 11,
                fontFamily: MONO,
                color: TOKENS.text2,
              }}>
                <span style={{ whiteSpace: 'nowrap', color: TOKENS.text3, flexShrink: 0 }}>
                  {new Date(ev.pushed_at).toLocaleTimeString()}
                </span>
                {ev.section_header && (
                  <span style={{
                    color: 'var(--status-green)',
                    fontWeight: 600,
                    flexShrink: 0,
                  }}>
                    {ev.section_header}
                  </span>
                )}
                <span style={{ color: TOKENS.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ev.file_path ?? '—'}
                </span>
                {ev.pushed_by && (
                  <span style={{ color: TOKENS.text3, flexShrink: 0 }}>· {ev.pushed_by}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
