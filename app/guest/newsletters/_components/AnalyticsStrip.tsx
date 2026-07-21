'use client';
// app/guest/newsletters/_components/AnalyticsStrip.tsx
// PBS 2026-07-22 · 6-tile analytics strip (Today · L7d · L30d) + last-10 errors with retry.

import { useMemo, useState, useTransition } from 'react';
import type { CSSProperties } from 'react';

export interface AnalyticsRow {
  property_id: number;
  day: string;          // 'YYYY-MM-DD'
  source: string;       // 'broadcast' | 'sequence'
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
  unsubscribed: number;
}

export interface ErrorRow {
  source: string;
  property_id: number;
  parent_id: string;
  parent_name: string | null;
  email: string;
  full_name: string | null;
  send_status: string;
  error_snippet: string | null;
  occurred_at: string | null;
}

interface Props {
  rows: AnalyticsRow[];
  errors: ErrorRow[];
}

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_M = '#5A5A5A';
const GREEN = '#1F3A2E';
const RED   = '#B03826';

function bucketRows(rows: AnalyticsRow[], from: Date, to: Date) {
  const fromISO = from.toISOString().slice(0, 10);
  const toISO   = to.toISOString().slice(0, 10);
  const filtered = rows.filter((r) => r.day >= fromISO && r.day <= toISO);
  const sum = (k: keyof AnalyticsRow) => filtered.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  return {
    sent:         sum('sent'),
    opened:       sum('opened'),
    clicked:      sum('clicked'),
    bounced:      sum('bounced'),
    failed:       sum('failed'),
    unsubscribed: sum('unsubscribed'),
  };
}

function pct(num: number, den: number): string {
  if (!den) return '—';
  return `${((num / den) * 100).toFixed(0)}%`;
}

export default function AnalyticsStrip({ rows, errors }: Props) {
  const cols = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const l7  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6));
    const l30 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29));
    return [
      { label: 'Today',   ...bucketRows(rows, todayStart, todayStart) },
      { label: 'Last 7d', ...bucketRows(rows, l7,  todayStart) },
      { label: 'Last 30d',...bucketRows(rows, l30, todayStart) },
    ];
  }, [rows]);

  const metricRows: Array<{ key: keyof ReturnType<typeof bucketRows>; label: string; asPct?: boolean }> = [
    { key: 'sent',         label: 'Sent' },
    { key: 'opened',       label: 'Opened',     asPct: true },
    { key: 'clicked',      label: 'Clicked',    asPct: true },
    { key: 'bounced',      label: 'Bounced' },
    { key: 'failed',       label: 'Failed' },
    { key: 'unsubscribed', label: 'Unsubscribed' },
  ];

  return (
    <section>
      <div style={sectionHead}>Analytics</div>

      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr 1fr', border: `1px solid ${HAIR}`, borderRadius: 6, background: WHITE, overflow: 'hidden' }}>
        {/* Header row */}
        <div style={{ ...cell, ...cellHead, borderRight: `1px solid ${HAIR}`, background: '#FAFAF7' }} />
        {cols.map((c, i) => (
          <div key={c.label} style={{ ...cell, ...cellHead, background: '#FAFAF7', borderRight: i < 2 ? `1px solid ${HAIR}` : undefined }}>
            {c.label}
          </div>
        ))}

        {/* Metric rows */}
        {metricRows.map((m, rowIdx) => (
          <RowFragment
            key={m.key}
            label={m.label}
            cols={cols}
            metricKey={m.key}
            asPct={m.asPct}
            isLast={rowIdx === metricRows.length - 1}
          />
        ))}
      </div>

      <div style={{ ...sectionHead, marginTop: 18 }}>Recent errors (last 10)</div>
      <RecentErrorsList errors={errors} />
    </section>
  );
}

function RowFragment({ label, cols, metricKey, asPct, isLast }: {
  label: string; cols: Array<{ label: string; sent: number; opened: number; clicked: number; bounced: number; failed: number; unsubscribed: number }>;
  metricKey: keyof ReturnType<typeof bucketRows>; asPct?: boolean; isLast: boolean;
}) {
  return (
    <>
      <div style={{ ...cell, ...cellLabel, borderTop: `1px solid ${HAIR}`, borderRight: `1px solid ${HAIR}`, borderBottom: isLast ? undefined : undefined }}>
        {label}
      </div>
      {cols.map((c, i) => {
        const v = c[metricKey] ?? 0;
        const display = asPct ? `${(v as number).toLocaleString()} · ${pct(v as number, c.sent)}` : (v as number).toLocaleString();
        return (
          <div key={c.label + label} style={{ ...cell, ...cellVal, borderTop: `1px solid ${HAIR}`, borderRight: i < 2 ? `1px solid ${HAIR}` : undefined }}>
            {display}
          </div>
        );
      })}
    </>
  );
}

function RecentErrorsList({ errors }: { errors: ErrorRow[] }) {
  const [busy, startT] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [retriedIds, setRetriedIds] = useState<Set<string>>(new Set());

  async function retry(e: ErrorRow) {
    if (e.source !== 'broadcast') { setMsg('Sequence retries not yet supported.'); return; }
    startT(async () => {
      const res = await fetch('/api/marketing/newsletter/retry-recipient', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ campaign_id: e.parent_id, email: e.email }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j?.ok) {
        setMsg(`Retry queued for ${e.email}`);
        setRetriedIds(prev => new Set(prev).add(e.parent_id + '|' + e.email));
      } else {
        setMsg(`Retry failed: ${j?.error ?? res.status}`);
      }
      setTimeout(() => setMsg(null), 3000);
    });
  }

  if (errors.length === 0) {
    return <div style={emptyState}>No failed or bounced sends. Clean queue.</div>;
  }

  return (
    <div style={{ border: `1px solid ${HAIR}`, borderRadius: 6, background: WHITE, overflow: 'hidden' }}>
      {msg && <div style={{ padding: '6px 10px', fontSize: 11, background: '#EEF6EE', color: '#1F5C2C', borderBottom: `1px solid ${HAIR}` }}>{msg}</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#FAFAF7', borderBottom: `1px solid ${HAIR}` }}>
            <th style={th}>When</th>
            <th style={th}>Source</th>
            <th style={th}>Campaign / Funnel</th>
            <th style={th}>Email</th>
            <th style={th}>Status</th>
            <th style={th}>Error snippet</th>
            <th style={{ ...th, textAlign: 'right', width: 100 }}></th>
          </tr>
        </thead>
        <tbody>
          {errors.map((e, i) => {
            const key = e.parent_id + '|' + e.email + '|' + i;
            const retried = retriedIds.has(e.parent_id + '|' + e.email);
            return (
              <tr key={key} style={{ borderBottom: `1px solid ${HAIR}` }}>
                <td style={tdL}>{e.occurred_at ? new Date(e.occurred_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                <td style={tdL}><span style={sourcePill(e.source)}>{e.source}</span></td>
                <td style={{ ...tdL, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.parent_name ?? ''}>{e.parent_name ?? '—'}</td>
                <td style={{ ...tdL, fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>{e.email}</td>
                <td style={tdL}><span style={{ ...pill, background: '#FBE8E4', color: RED, borderColor: '#E8B7AB' }}>{e.send_status}</span></td>
                <td style={{ ...tdL, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: INK_M, fontSize: 11 }} title={e.error_snippet ?? ''}>{e.error_snippet ?? '—'}</td>
                <td style={{ ...tdR, textAlign: 'right' }}>
                  {e.source === 'broadcast' ? (
                    <button
                      type="button" onClick={() => retry(e)} disabled={busy || retried}
                      style={{ ...retryBtn, opacity: (busy || retried) ? 0.5 : 1 }}
                    >
                      {retried ? 'Queued' : 'Retry'}
                    </button>
                  ) : (
                    <span style={{ fontSize: 10, color: INK_M }}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function sourcePill(source: string): CSSProperties {
  if (source === 'broadcast') return { ...pill, background: '#E4F1E0', color: '#1F5C2C', borderColor: '#A9CFA0' };
  return { ...pill, background: '#E4EAF1', color: '#1F3A5C', borderColor: '#A0B4CF' };
}

// ---------- styles ----------
const cell: CSSProperties = { padding: '10px 12px', fontSize: 12 };
const cellHead: CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M };
const cellLabel: CSSProperties = { fontWeight: 600, color: INK };
const cellVal: CSSProperties = { textAlign: 'right', color: INK, fontVariantNumeric: 'tabular-nums' };

const sectionHead: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M, marginBottom: 8 };
const emptyState: CSSProperties = { padding: '14px 16px', fontSize: 12, color: INK_M, background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6 };

const th: CSSProperties = { padding: '8px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK, textAlign: 'left' };
const tdL: CSSProperties = { padding: '7px 10px', fontSize: 12, color: INK };
const tdR: CSSProperties = { padding: '7px 10px', fontSize: 12 };
const pill: CSSProperties = { padding: '2px 8px', fontSize: 10, fontWeight: 700, borderRadius: 10, border: '1px solid transparent', display: 'inline-block' };
const retryBtn: CSSProperties = { padding: '3px 10px', fontSize: 10, fontWeight: 700, background: WHITE, color: GREEN, border: `1px solid ${HAIR}`, borderRadius: 3, cursor: 'pointer' };
