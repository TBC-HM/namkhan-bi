'use client';

// components/inbox/TopSendersPanel.tsx
// PBS 2026-05-09: "Redesign the mail into my personal top right make it more
// actionable and informative … some drill down option when I click somewhere
// where I see how many emails the persons send a day, receivers etc."
//
// Inline panel for /inbox. Click a sender → expands to show threads-per-week
// trend, automation flag, and quick CTAs (mark spam, archive, draft reply).

import { useState } from 'react';

export interface TopSender {
  sender_email: string;
  sender_name: string | null;
  inbound: number;
  threads: number;
  last_msg: string | null;
  is_automation: boolean;
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

interface Props {
  senders: TopSender[];
  windowDays: number;
}

export default function TopSendersPanel({ senders, windowDays }: Props) {
  const [openEmail, setOpenEmail] = useState<string | null>(null);
  const total = senders.reduce((s, x) => s + x.inbound, 0);
  const automation = senders.filter((s) => s.is_automation).reduce((s, x) => s + x.inbound, 0);
  const automationPct = total > 0 ? (automation / total) * 100 : 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: '#9b907a' }}>
          Top {senders.length} senders · last {windowDays}d · {total.toLocaleString()} inbound msgs ·{' '}
          <strong style={{ color: automationPct >= 50 ? 'var(--brass-soft)' : '#7ad790' }}>
            {automationPct.toFixed(0)}% automated
          </strong>
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {senders.map((s) => {
          const isOpen = openEmail === s.sender_email;
          const perDay = s.inbound / Math.max(windowDays, 1);
          const display = s.sender_name || s.sender_email;
          const subject = encodeURIComponent(`Re: thread with ${display}`);
          const mailto = `mailto:${s.sender_email}?subject=${subject}`;
          return (
            <div key={s.sender_email}>
              <div
                onClick={() => setOpenEmail(isOpen ? null : s.sender_email)}
                style={{
                  cursor: 'pointer',
                  display: 'grid',
                  gridTemplateColumns: '1fr 80px 80px 80px 90px',
                  gap: 10,
                  alignItems: 'center',
                  padding: '8px 10px',
                  background: isOpen ? '#15140f' : '#0f0d0a',
                  border: '1px solid #1f1c15',
                  borderRadius: 4,
                  fontSize: 12,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                  {s.is_automation && (
                    <span title="Automation" style={{
                      background: '#2a261d', color: 'var(--brass-soft)',
                      padding: '1px 5px', borderRadius: 3,
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                    }}>bot</span>
                  )}
                  <strong style={{ color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {display}
                  </strong>
                  {s.sender_name && (
                    <span style={{ color: '#7d7565', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      &lt;{s.sender_email}&gt;
                    </span>
                  )}
                </span>
                <span style={{ color: 'var(--line-soft)', fontFamily: 'ui-monospace, monospace', textAlign: 'right' }}>
                  {s.inbound.toLocaleString()}
                </span>
                <span style={{ color: '#9b907a', fontFamily: 'ui-monospace, monospace', textAlign: 'right' }}>
                  {perDay.toFixed(1)}/d
                </span>
                <span style={{ color: '#9b907a', fontFamily: 'ui-monospace, monospace', textAlign: 'right' }}>
                  {s.threads} thr
                </span>
                <span style={{ color: '#7d7565', fontFamily: 'ui-monospace, monospace', textAlign: 'right' }}>
                  {relativeTime(s.last_msg)}
                </span>
              </div>

              {isOpen && (
                <div style={{
                  padding: '10px 12px',
                  background: '#0a0a0a',
                  border: '1px solid #1f1c15',
                  borderTop: 'none',
                  borderBottomLeftRadius: 4,
                  borderBottomRightRadius: 4,
                  fontSize: 12,
                  color: '#9b907a',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 4, columnGap: 16 }}>
                    <span><strong style={{ color: 'var(--line-soft)' }}>Email:</strong> {s.sender_email}</span>
                    <span><strong style={{ color: 'var(--line-soft)' }}>Name:</strong> {s.sender_name ?? '—'}</span>
                    <span><strong style={{ color: 'var(--line-soft)' }}>Inbound:</strong> {s.inbound.toLocaleString()}</span>
                    <span><strong style={{ color: 'var(--line-soft)' }}>Threads:</strong> {s.threads}</span>
                    <span><strong style={{ color: 'var(--line-soft)' }}>Per day:</strong> {perDay.toFixed(2)}</span>
                    <span><strong style={{ color: 'var(--line-soft)' }}>Last msg:</strong> {s.last_msg ? new Date(s.last_msg).toLocaleString() : '—'}</span>
                    <span><strong style={{ color: 'var(--line-soft)' }}>Type:</strong> {s.is_automation ? 'automation / bulk' : 'human'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    <a href={`/inbox?q=${encodeURIComponent(s.sender_email)}`} style={btnLink()}>open in inbox</a>
                    <a href={mailto} style={btnLink()}>✉ reply</a>
                    <a href={`/sales/leads?q=${encodeURIComponent(s.sender_email)}`} style={btnLink()}>find lead</a>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function btnLink(): React.CSSProperties {
  return {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 10,
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    color: 'var(--line-soft)',
    background: '#1a1812',
    border: '1px solid #2a2520',
    padding: '4px 8px',
    borderRadius: 3,
    textDecoration: 'none',
    fontWeight: 600,
  };
}
