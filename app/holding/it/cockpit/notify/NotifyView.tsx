'use client';

// app/holding/it/cockpit/notify/NotifyView.tsx
// Live feed with 30s poll. Unseen rows highlighted. Click row to open URL.
// PBS keeps this tab open — must auto-refresh without losing scroll.
//
// Author: IT-team agent · 2026-05-13 · #58.

import { useEffect, useState } from 'react';
import { TOKENS, SERIF, MONO } from '../_components/tokens';
import type { V2Notification } from '../_lib/data-port';

const KIND_ICON: Record<string, string> = {
  pr_opened: '📝',
  pr_merged: '✅',
  deploy_ready: '🚀',
  deploy_failed: '🔥',
  agent_message: '💬',
  agent_complete: '✓',
  agent_error: '⚠',
};

const KIND_COLOR: Record<string, string> = {
  pr_opened: TOKENS.sky,
  pr_merged: TOKENS.moss,
  deploy_ready: TOKENS.moss,
  deploy_failed: TOKENS.oxblood,
  agent_message: TOKENS.sand,
  agent_complete: TOKENS.moss,
  agent_error: TOKENS.terracotta,
};

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function NotifyView({ initial }: { initial: V2Notification[] }) {
  const [rows, setRows] = useState<V2Notification[]>(initial);
  const [refreshedAt, setRefreshedAt] = useState<number>(Date.now());
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        setPending(true);
        const res = await fetch('/api/holding/it/cockpit/notify?limit=80', {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const j = (await res.json()) as { rows?: V2Notification[] };
        if (!cancelled && Array.isArray(j.rows)) {
          setRows(j.rows);
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

  const unseen = rows.filter((r) => !r.seen_at).length;

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
        <h2 style={{ fontFamily: SERIF, fontSize: 22, margin: 0 }}>
          What just shipped
        </h2>
        <div style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3 }}>
          {unseen > 0 ? (
            <span style={{ color: TOKENS.moss }}>{unseen} new</span>
          ) : (
            'all caught up'
          )}
          {' · refreshed '}
          {relTime(new Date(refreshedAt).toISOString())}
          {pending && (
            <span style={{ marginLeft: 6, color: TOKENS.sand }}>· refreshing…</span>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
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
          Nothing shipped yet — agents are working.
        </div>
      ) : (
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
          {rows.map((n) => {
            const isNew = !n.seen_at;
            const icon = KIND_ICON[n.kind] ?? '•';
            const color = KIND_COLOR[n.kind] ?? TOKENS.text2;
            return (
              <li
                key={n.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '36px 1fr 90px',
                  gap: 14,
                  padding: '12px 16px',
                  borderBottom: `1px solid ${TOKENS.borderSoft}`,
                  alignItems: 'center',
                  background: isNew ? 'rgba(122,155,106,0.06)' : 'transparent',
                }}
              >
                <span
                  style={{
                    fontSize: 18,
                    lineHeight: 1,
                    color,
                    textAlign: 'center',
                  }}
                  title={n.kind}
                >
                  {icon}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      color: TOKENS.ink,
                      marginBottom: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {n.url ? (
                      <a
                        href={n.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: TOKENS.ink, textDecoration: 'none' }}
                      >
                        {n.title || '—'}
                      </a>
                    ) : (
                      n.title || '—'
                    )}
                  </div>
                  <div
                    style={{
                      fontFamily: MONO,
                      fontSize: 11,
                      color: TOKENS.text3,
                    }}
                  >
                    {n.ticket_id && (
                      <>
                        <a
                          href={`/holding/it/cockpit/tasks/${n.ticket_id}`}
                          style={{ color: TOKENS.ochre, textDecoration: 'none' }}
                        >
                          #{n.ticket_id}
                        </a>
                        {' · '}
                      </>
                    )}
                    {n.pr_number && (
                      <>
                        <a
                          href={`https://github.com/TBC-HM/namkhan-bi/pull/${n.pr_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: TOKENS.text3 }}
                        >
                          PR #{n.pr_number}
                        </a>
                        {' · '}
                      </>
                    )}
                    {n.branch && (
                      <span style={{ color: TOKENS.text3 }}>{n.branch} · </span>
                    )}
                    <span>{n.kind}</span>
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    color: TOKENS.text3,
                    textAlign: 'right',
                  }}
                >
                  {relTime(n.created_at)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
