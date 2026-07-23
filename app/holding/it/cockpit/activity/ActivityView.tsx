'use client';

// app/holding/it/cockpit/activity/ActivityView.tsx
// Renders the unified activity timeline + a 30s poll that refreshes from
// /api/holding/it/cockpit/activity. Filter pills toggle each source on/off.
//
// Author: IT-team agent · 2026-05-13 · #77.

import { useEffect, useMemo, useState } from 'react';
import { TOKENS, SERIF, MONO } from '../_components/tokens';
import type { ActivityEvent } from '../_lib/types';

const SOURCE_META: Record<
  ActivityEvent['source'],
  { label: string; color: string; bg: string }
> = {
  aud_change_log: { label: 'DDL', color: '#c4a06b', bg: 'rgba(196,160,107,0.16)' },
  intake_items: { label: 'Intake', color: '#b85f4e', bg: 'rgba(184,95,78,0.16)' },
  cap_skill_calls: { label: 'Skill', color: '#7a9b6a', bg: 'rgba(122,155,106,0.16)' },
  cockpit_audit_log: { label: 'Audit', color: '#9a8866', bg: 'rgba(154,136,102,0.18)' },
};

function fmtAge(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  const secs = Math.floor((Date.now() - t) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return iso.slice(0, 10);
}

function fmtClock(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return (
    d.getUTCFullYear() +
    '-' +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getUTCDate()).padStart(2, '0') +
    ' ' +
    String(d.getUTCHours()).padStart(2, '0') +
    ':' +
    String(d.getUTCMinutes()).padStart(2, '0') +
    'Z'
  );
}

export function ActivityView({
  initialEvents,
}: {
  initialEvents: ActivityEvent[];
}) {
  const [events, setEvents] = useState<ActivityEvent[]>(initialEvents);
  const [enabled, setEnabled] = useState<Record<ActivityEvent['source'], boolean>>({
    aud_change_log: true,
    intake_items: true,
    cap_skill_calls: true,
    cockpit_audit_log: true,
  });
  const [refreshedAt, setRefreshedAt] = useState<number>(Date.now());
  const [pending, setPending] = useState(false);

  // 30s poll
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        setPending(true);
        const res = await fetch('/api/holding/it/cockpit/activity?limit=200', {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const j = (await res.json()) as { events?: ActivityEvent[] };
        if (!cancelled && Array.isArray(j.events)) {
          setEvents(j.events);
          setRefreshedAt(Date.now());
        }
      } catch {
        // swallow — keep last good state
      } finally {
        if (!cancelled) setPending(false);
      }
    };
    const id = window.setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const filtered = useMemo(
    () => events.filter((e) => enabled[e.source]),
    [events, enabled],
  );

  const counts = useMemo(() => {
    const c: Record<ActivityEvent['source'], number> = {
      aud_change_log: 0,
      intake_items: 0,
      cap_skill_calls: 0,
      cockpit_audit_log: 0,
    };
    for (const e of events) c[e.source] += 1;
    return c;
  }, [events]);

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
        <h2 style={{ fontFamily: SERIF, fontSize: 22, margin: 0 }}>Activity</h2>
        <div style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3 }}>
          {events.length} events · refreshed {fmtAge(new Date(refreshedAt).toISOString())}
          {pending && <span style={{ marginLeft: 6, color: TOKENS.sand }}>· refreshing…</span>}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 18,
          flexWrap: 'wrap',
        }}
      >
        {(Object.keys(SOURCE_META) as Array<ActivityEvent['source']>).map((s) => {
          const m = SOURCE_META[s];
          const on = enabled[s];
          return (
            <button
              key={s}
              onClick={() => setEnabled((prev) => ({ ...prev, [s]: !prev[s] }))}
              style={{
                padding: '5px 12px',
                borderRadius: 2,
                border: `1px solid ${on ? m.color : TOKENS.borderSoft}`,
                background: on ? m.bg : 'transparent',
                color: on ? m.color : TOKENS.text3,
                fontFamily: MONO,
                fontSize: 11,
                letterSpacing: 0.5,
                cursor: 'pointer',
              }}
              type="button"
            >
              {m.label} · {counts[s]}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div
          style={{
            padding: 24,
            border: `1px solid ${TOKENS.border}`,
            background: TOKENS.bgRaised,
            color: TOKENS.text2,
            fontSize: 13,
            borderRadius: 2,
          }}
        >
          No events match the current filters.
        </div>
      )}

      <ol
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          border: `1px solid ${TOKENS.border}`,
          background: TOKENS.bgRaised,
          borderRadius: 2,
        }}
      >
        {filtered.map((e) => {
          const m = SOURCE_META[e.source];
          return (
            <li
              key={`${e.source}:${e.id}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '110px 70px 1fr 110px',
                gap: 14,
                padding: '10px 16px',
                borderBottom: `1px solid ${TOKENS.borderSoft}`,
                alignItems: 'baseline',
              }}
            >
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  color: TOKENS.text3,
                  letterSpacing: 0.3,
                }}
                title={e.at}
              >
                {fmtClock(e.at)}
              </span>
              <span
                style={{
                  padding: '1px 6px',
                  background: m.bg,
                  color: m.color,
                  borderRadius: 2,
                  fontSize: 10,
                  fontFamily: MONO,
                  letterSpacing: 0.5,
                  width: 'fit-content',
                }}
              >
                {m.label}
              </span>
              <div style={{ fontSize: 13, color: TOKENS.ink, lineHeight: 1.45 }}>
                <span style={{ fontFamily: MONO, color: TOKENS.sand }}>
                  {e.actor ?? '—'}
                </span>
                {e.action && (
                  <>
                    <span style={{ color: TOKENS.text3 }}> · </span>
                    <span>{e.action}</span>
                  </>
                )}
                {e.target && (
                  <>
                    <span style={{ color: TOKENS.text3 }}> → </span>
                    {e.link ? (
                      <a
                        href={e.link}
                        style={{ color: TOKENS.ochre, textDecoration: 'none' }}
                      >
                        {e.target}
                      </a>
                    ) : (
                      <span style={{ color: TOKENS.text2 }}>{e.target}</span>
                    )}
                  </>
                )}
                {e.status && (
                  <span
                    style={{
                      marginLeft: 8,
                      padding: '0 6px',
                      background: 'rgba(233,225,206,0.06)',
                      borderRadius: 2,
                      fontFamily: MONO,
                      fontSize: 10,
                      color:
                        e.status === 'ok' || e.status === 'completed'
                          ? TOKENS.moss
                          : e.status === 'fail' || e.status === 'error'
                            ? TOKENS.terracotta
                            : TOKENS.text2,
                    }}
                  >
                    {e.status}
                  </span>
                )}
                {e.detail && (
                  <div style={{ color: TOKENS.text3, fontSize: 11, marginTop: 2 }}>
                    {e.detail}
                  </div>
                )}
              </div>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  color: TOKENS.text3,
                  textAlign: 'right',
                }}
              >
                {fmtAge(e.at)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
