'use client';
// app/sales/mails/MailToLeadPanel.tsx
// PBS 2026-07-14 (Sales CRM upgrade) — companion strip rendered UNDER
// <UnifiedMailInbox/>. Purpose:
//   - list the same threads the inbox has (props from server), plus a per-row
//     "→ Read & convert" action that opens a modal reader with a big
//     "Convert to Lead" button.
//   - if a lead already exists for this thread_id (server pre-computed
//     linkedLeadByThreadId map), replace the button with "→ Open lead #N".
//
// We DO NOT touch UnifiedMailInbox itself (fragility rule 7 in the CRM brief).
// This panel is purely additive.

import { useMemo, useState } from 'react';

const T = {
  WHITE: '#FFFFFF', HAIR: '#E6DFCC', INK: '#1B1B1B', INK_M: '#5A5A5A',
  FOREST: '#084838', CREAM: '#F5F0E1', RED: '#B03826',
};

export interface MailPanelThread {
  mailbox_id: string;
  mailbox_address: string;
  label: string;
  badge_color: string;
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
  dateMs: number;
  unread: boolean;
}

interface Props {
  threads: MailPanelThread[];
  linkedLeadByThreadId: Record<string, number>;
}

function parseFrom(raw: string): { name: string; email: string } {
  const m = raw.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { name: '', email: raw.trim() };
}

export default function MailToLeadPanel({ threads, linkedLeadByThreadId }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [converting, setConverting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [localLinks, setLocalLinks] = useState<Record<string, number>>(linkedLeadByThreadId);

  const rows = useMemo(() => threads.slice(0, 50), [threads]);
  const active = openIdx != null ? rows[openIdx] : null;
  const activeLeadId = active ? localLinks[active.threadId] : undefined;

  async function convert(t: MailPanelThread) {
    setConverting(true); setErr(null);
    try {
      const parsed = parseFrom(t.from);
      const r = await fetch('/api/sales/leads/convert-from-email', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          from_email: parsed.email,
          from_name: parsed.name,
          subject: t.subject,
          snippet: t.snippet,
          thread_id: t.threadId,
          message_id: t.id,
          mailbox_alias: t.mailbox_address.split('@')[0] || 'sales',
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'convert failed');
      const leadId = Number(j.lead_id);
      setLocalLinks((prev) => ({ ...prev, [t.threadId]: leadId }));
      window.location.href = '/sales/leads?highlight=' + leadId;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setConverting(false);
    }
  }

  if (rows.length === 0) {
    return (
      <div style={{ gridColumn: '1 / -1', padding: 12, background: T.WHITE, border: '1px solid ' + T.HAIR, borderRadius: 4, fontSize: 12, color: T.INK_M, marginTop: 8 }}>
        No threads available to convert to leads yet.
      </div>
    );
  }

  return (
    <div style={{ gridColumn: '1 / -1', marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: T.INK_M }}>
        Convert to Lead — recent threads
      </div>
      <div style={{ background: T.WHITE, border: '1px solid ' + T.HAIR, borderRadius: 4, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, color: T.INK }}>
          <thead>
            <tr style={{ background: T.CREAM }}>
              <th style={th()}>Alias</th>
              <th style={th()}>From</th>
              <th style={th()}>Subject</th>
              <th style={th()}>Received</th>
              <th style={th()}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => {
              const parsed = parseFrom(t.from);
              const linkedId = localLinks[t.threadId];
              return (
                <tr key={t.mailbox_id + ':' + t.id} style={{ background: t.unread ? T.CREAM : T.WHITE }}>
                  <td style={td()}>
                    <span style={{ display: 'inline-block', background: t.badge_color, color: T.WHITE, padding: '2px 6px', borderRadius: 3, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
                      {t.label}
                    </span>
                  </td>
                  <td style={td()}>
                    <div style={{ fontWeight: 600 }}>{parsed.name || parsed.email}</div>
                    {parsed.name && <div style={{ color: T.INK_M, fontSize: 10 }}>{parsed.email}</div>}
                  </td>
                  <td style={td()}>
                    <button type="button" onClick={() => setOpenIdx(i)} style={{
                      background: 'transparent', border: 0, textAlign: 'left', cursor: 'pointer',
                      color: T.INK, padding: 0, fontSize: 12,
                    }}>
                      {t.subject || '(no subject)'}
                    </button>
                    <div style={{ color: T.INK_M, fontSize: 10, marginTop: 2 }}>{t.snippet.slice(0, 90)}</div>
                  </td>
                  <td style={{ ...td(), color: T.INK_M, whiteSpace: 'nowrap' }}>
                    {new Date(t.dateMs).toLocaleString()}
                  </td>
                  <td style={td()}>
                    {linkedId ? (
                      <a href={'/sales/leads?highlight=' + linkedId} style={{ color: T.FOREST, textDecoration: 'none', fontWeight: 600 }}>
                        → Open lead #{linkedId}
                      </a>
                    ) : (
                      <button type="button" onClick={() => setOpenIdx(i)} style={{
                        padding: '4px 10px', fontSize: 11, borderRadius: 3, border: '1px solid ' + T.HAIR,
                        background: T.WHITE, color: T.INK, cursor: 'pointer',
                      }}>Read & convert</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {active && (
        <>
          <div onClick={() => setOpenIdx(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', zIndex: 49, cursor: 'pointer' }} />
          <aside style={{
            position: 'fixed', top: 0, right: 0, width: 640, maxWidth: '96vw', height: '100vh',
            background: T.WHITE, boxShadow: '-12px 0 32px rgba(0,0,0,0.18)',
            borderLeft: '1px solid ' + T.HAIR, zIndex: 50, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              padding: '12px 16px', borderBottom: '1px solid ' + T.HAIR,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              background: T.WHITE, flex: '0 0 auto',
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {active.subject || '(no subject)'}
                </div>
                <div style={{ fontSize: 11, color: T.INK_M }}>
                  {active.from} · {new Date(active.dateMs).toLocaleString()} · via {active.mailbox_address}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {activeLeadId ? (
                  <a href={'/sales/leads?highlight=' + activeLeadId} style={{
                    padding: '6px 12px', fontSize: 12, borderRadius: 4, border: '1px solid ' + T.FOREST,
                    background: T.FOREST, color: T.WHITE, textDecoration: 'none', fontWeight: 600,
                  }}>Open lead #{activeLeadId} →</a>
                ) : (
                  <button type="button" onClick={() => convert(active)} disabled={converting} style={{
                    padding: '6px 12px', fontSize: 12, borderRadius: 4, border: '1px solid ' + T.FOREST,
                    background: T.FOREST, color: T.WHITE, cursor: 'pointer', fontWeight: 600,
                  }}>{converting ? 'Converting…' : 'Convert to Lead →'}</button>
                )}
                <button type="button" onClick={() => setOpenIdx(null)} style={{
                  padding: '6px 10px', fontSize: 12, borderRadius: 4, border: '1px solid ' + T.HAIR,
                  background: T.WHITE, color: T.INK, cursor: 'pointer',
                }}>✕</button>
              </div>
            </div>
            {err && (
              <div style={{ padding: 10, background: '#FBE8E4', color: T.RED, fontSize: 12 }}>{err}</div>
            )}
            <div style={{ padding: 16, overflowY: 'auto', flex: '1 1 auto' }}>
              <div style={{ fontSize: 12, color: T.INK_M, marginBottom: 8 }}>
                Snippet preview (full body opens in the primary Gmail inbox above).
              </div>
              <div style={{ padding: 12, background: T.CREAM, border: '1px solid ' + T.HAIR, borderRadius: 4, fontSize: 13, color: T.INK, whiteSpace: 'pre-wrap' }}>
                {active.snippet || '(no snippet available — open the thread above to see the full body)'}
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

function th(): React.CSSProperties {
  return { padding: '8px 10px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase',
    letterSpacing: 0.5, color: T.INK_M, fontWeight: 600, borderBottom: '1px solid ' + T.HAIR };
}
function td(): React.CSSProperties {
  return { padding: '8px 10px', borderBottom: '1px solid ' + T.HAIR, verticalAlign: 'top' };
}
