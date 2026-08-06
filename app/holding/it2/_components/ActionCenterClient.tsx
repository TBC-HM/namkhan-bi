'use client';

// app/holding/it2/_components/ActionCenterClient.tsx
// action-center-inbox-v1 (2026-08-04) — ONE inbox, live.
// PBS mandate: "i never get the info if i have an answer or acknowledgement
// and have to go through all of them 1 by 1" · answered questions must drop
// the count to 0 immediately.
// - Every inbox row has a CTA (Answer / Confirm); rows with no possible owner
//   action never render (A3).
// - Red "N need YOU" vs amber "N confirmed → in build" split (scope 3).
// - Response strip "since you were here" (scope 4): agent responses + awaits-
//   user notices, dismissable, auto-expire 7 days server-side.
// - Refetches after every owner action, every 60s, and on tab refocus (A1/A4)
//   — counts move without a full reload.

import { useCallback, useEffect, useState } from 'react';
import { TOKENS, MONO } from '@/components/cockpit/tokens';

type InboxRow = {
  kind: 'brief-question' | 'bug-question' | 'finding-red';
  title: string;
  detail: string;
  cta: 'Answer' | 'Confirm';
  href: string;
};
type ResponseRow = {
  kind: 'response' | 'ticket';
  id: number;
  label: string;
  summary: string;
  href: string | null;
  created_at: string;
};
export type ActionCenterPayload = {
  inbox: InboxRow[];
  strip: ResponseRow[];
  redCount: number;
  amberCount: number;
  amberModules: string[];
  needsYou: number;
  fetchedAt: string;
  error?: string;
};

const KIND_TONE: Record<string, { bg: string; fg: string; tag: string }> = {
  'brief-question': { bg: '#FDECE4', fg: '#B04A2F', tag: 'QUESTION' },
  'bug-question':   { bg: '#FDECE4', fg: '#B04A2F', tag: 'BUG' },
  'finding-red':    { bg: '#FFEBEE', fg: '#B71C1C', tag: 'FINDING' },
};

export function ActionCenterClient({ initial }: { initial: ActionCenterPayload }) {
  const [data, setData] = useState<ActionCenterPayload>(initial);
  const [busy, setBusy] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch('/api/it2/action-center', { cache: 'no-store' });
      if (!res.ok) return;
      const j = (await res.json()) as ActionCenterPayload;
      if (j && !j.error) setData(j);
    } catch {
      /* next tick retries */
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(refetch, 60_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') void refetch();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, [refetch]);

  const dismiss = useCallback(async (row: ResponseRow) => {
    setBusy(`${row.kind}-${row.id}`);
    try {
      await fetch('/api/it2/action-center/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: row.kind, id: row.id }),
      });
      await refetch();
    } finally {
      setBusy(null);
    }
  }, [refetch]);

  const { inbox, strip, redCount, amberCount, amberModules } = data;
  // ADR-253 (PBS 2026-08-06 22:15): the 12-hour window on findings (ADR-251) left the
  // older ones with NO path in the UI at all — the owner had to type module URLs by
  // hand. He chose option A: one collapsed container, not a second page.
  const older = (data as any).older ?? [];
  const [showOlder, setShowOlder] = useState(false);

  return (
    <div>
      {/* ---- Zone 1 · ONE INBOX ---- */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8, gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: '#B04A2F', margin: 0 }}>
            ◉ NEEDS YOU ({inbox.length})
          </h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
            {/* Finding-state split — red is YOUR move, amber is the machine's (scope 3) */}
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#FFEBEE', color: '#B71C1C' }}>
              {redCount} need YOU
            </span>
            <span
              title={amberModules.join(', ')}
              style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#FFF4D6', color: '#8A6D00' }}
            >
              {amberCount} confirmed → in build
            </span>
            <a href="/holding/it2/questions" style={{ fontSize: 11, fontWeight: 700, color: TOKENS.forest, textDecoration: 'none' }}>
              Decision Inbox →
            </a>
          </div>
        </div>
        {inbox.length === 0 ? (
          <div style={{ fontSize: 13, color: TOKENS.text2, background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 8, padding: '18px 16px' }}>
            Nothing needs you. All questions answered, all findings confirmed — the machine is running on its own.
          </div>
        ) : inbox.map((it, i) => {
          const tone = KIND_TONE[it.kind] ?? KIND_TONE['brief-question'];
          return (
            <a key={`${it.kind}-${i}`} href={it.href} style={{
              display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none',
              background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 8,
              padding: '10px 14px', marginBottom: 6, color: TOKENS.ink,
            }}>
              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: tone.bg, color: tone.fg, whiteSpace: 'nowrap' }}>
                {tone.tag}
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{it.title}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: TOKENS.text2, marginTop: 1 }}>{it.detail}</span>
              </span>
              {/* The CTA — what clicking DOES (law 737: no dead rows) */}
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 6, whiteSpace: 'nowrap',
                background: it.cta === 'Confirm' ? '#B71C1C' : TOKENS.forest, color: '#FFFFFF',
              }}>
                {it.cta} →
              </span>
            </a>
          );
        })}
      </div>

      {/* ---- Zone 1a · RESEARCH BACKLOG (ADR-253) — older than 12h, collapsed ---- */}
      {older.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <button onClick={() => setShowOlder((s: boolean) => !s)} style={{
            fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: TOKENS.text2,
            background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: 8,
          }}>
            {showOlder ? '▲' : '▼'} RESEARCH BACKLOG ({older.length}) — findings older than 12h
          </button>
          {showOlder && older.map((it: any, i: number) => (
            <a key={`older-${i}`} href={it.href} style={{
              display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none',
              background: TOKENS.bg, border: `1px solid ${TOKENS.border}`, borderRadius: 8,
              padding: '9px 14px', marginBottom: 5, color: TOKENS.text2, opacity: 0.9,
            }}>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600 }}>{it.title}</span>
                <span style={{ display: 'block', fontSize: 11, color: TOKENS.text3, marginTop: 1 }}>{it.detail}</span>
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                whiteSpace: 'nowrap', background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, color: TOKENS.text2 }}>
                Confirm →
              </span>
            </a>
          ))}
        </div>
      )}

      {/* ---- Zone 1b · SINCE YOU WERE HERE (response strip, scope 4) ---- */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: TOKENS.text2, margin: '0 0 8px' }}>
          SINCE YOU WERE HERE ({strip.length})
        </h2>
        {strip.length === 0 ? (
          <div style={{ fontSize: 12, color: TOKENS.text3, background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 8, padding: '12px 16px' }}>
            No agent responses or notices in the last 7 days.
          </div>
        ) : (
          <div style={{ background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 8, overflow: 'hidden' }}>
            {strip.map((r) => (
              <div key={`${r.kind}-${r.id}`} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                borderBottom: `1px solid ${TOKENS.borderSoft}`, fontSize: 12,
              }}>
                <span style={{ fontFamily: MONO, fontSize: 10, color: TOKENS.text3, whiteSpace: 'nowrap' }}>
                  {r.created_at.slice(5, 10)} {r.created_at.slice(11, 16)}
                </span>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, whiteSpace: 'nowrap',
                  background: r.kind === 'ticket' ? '#E3F2FD' : '#E8F5E9',
                  color: r.kind === 'ticket' ? '#1565C0' : '#2E7D32',
                }}>
                  {r.label.toUpperCase()}
                </span>
                {r.href ? (
                  <a href={r.href} style={{ color: TOKENS.ink, textDecoration: 'none', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {r.summary}
                  </a>
                ) : (
                  <span style={{ color: TOKENS.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {r.summary}
                  </span>
                )}
                <button
                  onClick={() => void dismiss(r)}
                  disabled={busy === `${r.kind}-${r.id}`}
                  style={{
                    fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
                    background: 'transparent', border: `1px solid ${TOKENS.border}`, color: TOKENS.text2,
                  }}
                >
                  {busy === `${r.kind}-${r.id}` ? '…' : 'Dismiss'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
