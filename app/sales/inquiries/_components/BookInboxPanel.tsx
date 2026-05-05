// app/sales/inquiries/_components/BookInboxPanel.tsx
// Inbox stream container for the Inquiries page — scoped to the
// `book@thenamkhan.com` mailbox. Server component. Pulls from
// `sales.email_messages` via `listEmailThreads`.
//
// Honest stance: book@ is NOT directly OAuth-connected today (only pb@
// is in sales.gmail_connections). Every row in here was harvested from
// pb@'s mailbox where book@ appears in TO/CC. The header makes that
// clear and links to /admin/gmail-connect to authorise book@ properly.

import Link from 'next/link';
import { listEmailThreads, type ThreadSummary } from '@/lib/sales';
import { fmtIsoDate, EMPTY } from '@/lib/format';

const MAILBOX = 'book@thenamkhan.com';
const PROPERTY_ID = 260955;

function relativeTime(iso: string): string {
  const d = new Date(iso).getTime();
  const now = Date.now();
  const min = Math.round((now - d) / 60000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return fmtIsoDate(iso);
}

function senderLabel(name: string | null, email: string | null): string {
  if (name && name.trim().length > 0) return name;
  if (email) return email;
  return 'Unknown';
}

interface Props {
  dir?: 'all' | 'in' | 'out';
  limit?: number;
}

export default async function BookInboxPanel({ dir = 'all', limit = 10 }: Props) {
  const filter: { intendedMailbox: string; direction?: 'inbound' | 'outbound' } = {
    intendedMailbox: MAILBOX,
  };
  if (dir === 'in') filter.direction = 'inbound';
  if (dir === 'out') filter.direction = 'outbound';

  const threads: ThreadSummary[] = await listEmailThreads(PROPERTY_ID, limit, filter);

  // Mini-stats: split inbound/outbound counts in the result set, pull last received + last sent
  const inb = threads.filter((t) => t.last_direction === 'inbound');
  const outb = threads.filter((t) => t.last_direction === 'outbound');
  const lastIn = inb[0]?.last_received_at ?? null;
  const lastOut = outb[0]?.last_received_at ?? null;
  const newest = threads[0]?.last_received_at ?? null;

  const chip = (label: string, target: 'all' | 'in' | 'out') => {
    const active = dir === target;
    const href = target === 'all' ? '/sales/inquiries#book' : `/sales/inquiries?bookDir=${target}#book`;
    return (
      <Link
        key={target}
        href={href}
        scroll={false}
        style={{
          padding: '4px 10px',
          borderRadius: 5,
          fontFamily: 'var(--mono)',
          fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-loose)',
          textTransform: 'uppercase',
          textDecoration: 'none',
          color: active ? 'var(--paper-warm)' : 'var(--ink)',
          background: active ? 'var(--moss)' : 'var(--paper)',
          border: `1px solid ${active ? 'var(--moss)' : 'var(--paper-deep)'}`,
        }}
      >
        {label}
      </Link>
    );
  };

  const stat: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  };
  const statLabel: React.CSSProperties = {
    fontFamily: 'var(--mono)',
    fontSize: 'var(--t-xs)',
    letterSpacing: 'var(--ls-extra)',
    textTransform: 'uppercase',
    color: 'var(--brass)',
  };
  const statValue: React.CSSProperties = {
    fontFamily: 'var(--serif)',
    fontStyle: 'italic',
    fontSize: 'var(--t-2xl)',
    fontWeight: 500,
    color: 'var(--ink)',
    lineHeight: 1.1,
  };
  const statSub: React.CSSProperties = {
    fontSize: 'var(--t-xs)',
    color: 'var(--ink-mute)',
  };

  return (
    <article
      id="book"
      className="panel"
      style={{
        marginTop: 14,
        padding: 14,
        background: 'var(--paper-warm)',
        border: '1px solid var(--paper-deep)',
        borderRadius: 8,
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
          borderBottom: '1px solid var(--line-soft)',
          paddingBottom: 10,
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 'var(--t-xs)',
              letterSpacing: 'var(--ls-extra)',
              textTransform: 'uppercase',
              color: 'var(--brass)',
            }}
          >
            Inbox · {MAILBOX}
          </span>
          <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>
            Last {threads.length} thread{threads.length === 1 ? '' : 's'} touching this mailbox · most recent {newest ? relativeTime(newest) : EMPTY}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {chip('All', 'all')}
          {chip('↘ In', 'in')}
          {chip('↗ Out', 'out')}
          <Link
            href={`/inbox?box=${encodeURIComponent(MAILBOX)}`}
            style={{
              marginLeft: 8,
              padding: '4px 10px',
              borderRadius: 5,
              fontFamily: 'var(--mono)',
              fontSize: 'var(--t-xs)',
              letterSpacing: 'var(--ls-loose)',
              textTransform: 'uppercase',
              textDecoration: 'none',
              color: 'var(--brass)',
              border: '1px solid var(--brass-soft)',
            }}
          >
            Open full inbox →
          </Link>
        </div>
      </div>

      {/* Mini KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div style={stat}>
          <span style={statLabel}>Threads · view</span>
          <span style={statValue}>{threads.length}</span>
          <span style={statSub}>{dir === 'all' ? 'all directions' : dir === 'in' ? 'inbound only' : 'outbound only'}</span>
        </div>
        <div style={stat}>
          <span style={statLabel}>↘ Received</span>
          <span style={{ ...statValue, color: 'var(--moss-glow)' }}>{inb.length}</span>
          <span style={statSub}>{lastIn ? `last ${relativeTime(lastIn)}` : EMPTY}</span>
        </div>
        <div style={stat}>
          <span style={statLabel}>↗ Sent</span>
          <span style={{ ...statValue, color: 'var(--brass)' }}>{outb.length}</span>
          <span style={statSub}>{lastOut ? `last ${relativeTime(lastOut)}` : EMPTY}</span>
        </div>
        <div style={stat}>
          <span style={statLabel}>Source</span>
          <span style={{ ...statValue, fontSize: 'var(--t-md)', fontStyle: 'normal', fontFamily: 'var(--mono)' }}>
            via pb@
          </span>
          <span style={statSub}>
            <Link href="/admin/gmail-connect" style={{ color: 'var(--brass)' }}>
              Connect book@ directly →
            </Link>
          </span>
        </div>
      </div>

      {/* Thread list */}
      {threads.length === 0 ? (
        <div style={{ padding: 18, color: 'var(--ink-mute)', fontSize: 'var(--t-sm)' }}>
          No messages on book@thenamkhan.com under this filter. The poller may be stalled — check{' '}
          <Link href="/admin/gmail-connect" style={{ color: 'var(--brass)' }}>
            /admin/gmail-connect
          </Link>
          .
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {threads.map((t) => {
            const inbound = t.last_direction === 'inbound';
            return (
              <li
                key={t.thread_id}
                style={{ borderTop: '1px solid var(--line-soft)' }}
              >
                <Link
                  href={`/inbox?box=${encodeURIComponent(MAILBOX)}&thread=${encodeURIComponent(t.thread_id)}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '24px 1.4fr 2.5fr auto',
                    alignItems: 'baseline',
                    gap: 12,
                    padding: '8px 4px',
                    textDecoration: 'none',
                    color: 'var(--ink)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 'var(--t-base)',
                      color: inbound ? 'var(--moss-glow)' : 'var(--brass)',
                      fontWeight: 700,
                    }}
                    title={inbound ? 'inbound' : 'outbound'}
                  >
                    {inbound ? '↘' : '↗'}
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--t-sm)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      fontWeight: t.inquiry_status === 'new' ? 700 : 500,
                    }}
                  >
                    {senderLabel(t.last_from_name, t.last_from_email)}
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--t-sm)',
                      color: 'var(--ink-soft)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {t.last_subject ?? '(no subject)'}
                    {t.msg_count > 1 && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontFamily: 'var(--mono)',
                          fontSize: 'var(--t-xs)',
                          color: 'var(--ink-mute)',
                        }}
                      >
                        · {t.msg_count} msgs
                      </span>
                    )}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 'var(--t-xs)',
                      color: 'var(--ink-mute)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {relativeTime(t.last_received_at)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
