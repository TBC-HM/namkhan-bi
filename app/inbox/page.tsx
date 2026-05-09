// /inbox — Gmail-style email inbox. Left: thread list. Right: selected thread.
// Reads sales.email_messages. All messages from all 3 mailboxes flow here.

import Link from 'next/link';
import Page from '@/components/page/Page';
import StatusPill, { type StatusTone } from '@/components/ui/StatusPill';
import { listEmailThreads, getThreadMessages, listInboxTabs, getMailboxStats, getThreadResponseMap, getThreadResponseTime, getInboxVolumeByDay, getResponseTimeHistogram } from '@/lib/sales';
import { VolumeByDayChart, MailboxVolumeChart, ResponseTimeChart } from '@/components/inbox/InboxCharts';
import { fmtIsoDate, EMPTY } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STATUS_TONE: Record<string, StatusTone> = {
  new: 'info', drafted: 'pending', sent: 'info',
  won: 'active', lost: 'expired', archived: 'inactive',
};

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
  if (name && name.length > 0) return name;
  if (email) return email;
  return 'Unknown';
}

function bodyExcerpt(text: string | null, n = 140): string {
  if (!text) return EMPTY;
  return text.replace(/\s+/g, ' ').trim().slice(0, n);
}

function fmtMinutes(min: number | null | undefined): string {
  if (min == null) return '—';
  if (min < 1) return '<1m';
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ${Math.round(min - h * 60)}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h - d * 24}h`;
}

// Filter chip styles
const chipBase: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '5px 10px', borderRadius: 6,
  fontSize: 'var(--t-base)', fontWeight: 500,
  textDecoration: 'none', color: 'var(--ink)',
  border: '1px solid var(--paper-deep)',
  background: 'var(--paper-warm)',
};
const chipActiveStyle: React.CSSProperties = {
  ...chipBase,
  background: 'var(--moss)', color: 'var(--paper-warm)', borderColor: 'var(--moss)',
};
function chipStyle(active: boolean): React.CSSProperties {
  return active ? chipActiveStyle : chipBase;
}
const chipCount: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', opacity: 0.75,
};
const chipUnread: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
  background: 'var(--st-bad)', color: 'var(--paper-warm)',
  padding: '1px 5px', borderRadius: 8, minWidth: 14, textAlign: 'center',
};

export default async function InboxPage({
  searchParams,
}: {
  searchParams: { thread?: string; box?: string; dir?: string };
}) {
  const filter: { intendedMailbox?: string; direction?: 'inbound'|'outbound' } = {};
  if (searchParams.box && searchParams.box !== 'all') filter.intendedMailbox = searchParams.box;
  if (searchParams.dir === 'in') filter.direction = 'inbound';
  if (searchParams.dir === 'out') filter.direction = 'outbound';

  const [threads, tabs, mailboxStats, volumeByDay, respHisto] = await Promise.all([
    listEmailThreads(260955, 200, filter),
    listInboxTabs(260955),
    getMailboxStats(260955),
    getInboxVolumeByDay(260955, 30),
    getResponseTimeHistogram(260955),
  ]);
  const selectedId = searchParams.thread ?? threads[0]?.thread_id ?? null;
  const [messages, threadResponseMap, selectedRespMin] = await Promise.all([
    selectedId ? getThreadMessages(selectedId, 260955) : Promise.resolve([]),
    getThreadResponseMap(threads.map(t => t.thread_id), 260955),
    selectedId ? getThreadResponseTime(selectedId, 260955) : Promise.resolve(null),
  ]);

  // Aggregate KPIs across the (filtered) tab set
  const totalMsgs = mailboxStats.reduce((s, t) => s + t.msgs, 0);
  const totalIn = mailboxStats.reduce((s, t) => s + t.inbound, 0);
  const totalOut = mailboxStats.reduce((s, t) => s + t.outbound, 0);
  const totalSpam = mailboxStats.reduce((s, t) => s + t.spam, 0);
  const totalImportant = mailboxStats.reduce((s, t) => s + t.important, 0);
  const totalStarred = mailboxStats.reduce((s, t) => s + t.starred, 0);
  const totalUnanswered = mailboxStats.reduce((s, t) => s + t.unanswered, 0);
  const responseValues = mailboxStats.map(s => s.median_response_min).filter((v): v is number => typeof v === 'number');
  const overallMedianResp = responseValues.length > 0
    ? responseValues.sort((a,b)=>a-b)[Math.floor(responseValues.length / 2)]
    : null;

  // Mailbox volume chart data — top 8 by msg count, short labels
  const mailboxVolumeData = mailboxStats.slice(0, 8).map(s => ({
    mailbox: s.intended_mailbox.replace('@thenamkhan.com', '@nk').replace('@thedonnaportals.com', '@dp'),
    inbound: s.inbound,
    outbound: s.outbound,
  }));

  const tabsTotal = tabs.reduce((s, t) => s + t.total, 0);
  const tabsUnread = tabs.reduce((s, t) => s + t.unread, 0);

  // Helper for tab links — preserves direction filter
  const tabHref = (box: string) => {
    const p = new URLSearchParams();
    if (box !== 'all') p.set('box', box);
    if (searchParams.dir) p.set('dir', searchParams.dir);
    const qs = p.toString();
    return qs ? `/inbox?${qs}` : '/inbox';
  };
  const dirHref = (dir: string) => {
    const p = new URLSearchParams();
    if (searchParams.box) p.set('box', searchParams.box);
    if (dir !== 'all') p.set('dir', dir);
    const qs = p.toString();
    return qs ? `/inbox?${qs}` : '/inbox';
  };
  const activeBox = searchParams.box ?? 'all';
  const activeDir = searchParams.dir ?? 'all';

  return (
    <Page eyebrow="Operations · Inbox" title={<>Inbox · all <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>mail</em></>}>

      {/* ANALYTICS STRIP */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8,
        marginTop: 14,
      }}>
        {[
          { label: 'TOTAL', value: totalMsgs.toLocaleString(), sub: `${totalIn} in / ${totalOut} out` },
          { label: '↘ RECEIVED', value: totalIn.toLocaleString(), sub: 'all-time inbound', color: 'var(--moss-glow)' },
          { label: '↗ SENT', value: totalOut.toLocaleString(), sub: 'all-time outbound', color: 'var(--brass)' },
          { label: 'IMPORTANT', value: totalImportant.toLocaleString(), sub: 'Gmail flagged', color: 'var(--brass)' },
          { label: 'STARRED', value: totalStarred.toLocaleString(), sub: 'manual flag' },
          { label: 'SPAM', value: totalSpam.toLocaleString(), sub: 'Gmail filtered', color: totalSpam > 0 ? 'var(--st-bad)' : undefined },
          { label: 'MEDIAN REPLY', value: fmtMinutes(overallMedianResp), sub: `${totalUnanswered} unanswered` },
        ].map(k => (
          <div key={k.label} style={{
            padding: '10px 12px',
            background: 'var(--paper-warm)',
            border: '1px solid var(--paper-deep)',
            borderRadius: 6,
          }}>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
              letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
              color: 'var(--brass)', marginBottom: 4,
            }}>
              {k.label}
            </div>
            <div style={{
              fontFamily: 'var(--serif)', fontStyle: 'italic',
              fontSize: 'var(--t-2xl)', fontWeight: 500,
              color: k.color ?? 'var(--ink)', lineHeight: 1.1,
            }}>
              {k.value}
            </div>
            <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', marginTop: 2 }}>
              {k.sub}
            </div>
          </div>
        ))}
      </div>

      {/* MAILBOX TABS — dynamic, one chip per intended_mailbox seen */}
      <div style={{
        display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center',
        marginTop: 14, padding: '10px 12px',
        background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)',
        borderRadius: 8,
      }}>
        <Link href={tabHref('all')} style={chipStyle(activeBox === 'all')}>
          All <span style={chipCount}>{tabsTotal}</span>
        </Link>
        {tabs.map(t => {
          const short = t.intended_mailbox.replace('@thenamkhan.com','@nk').replace('@thedonnaportals.com','@dp');
          return (
            <Link key={t.intended_mailbox} href={tabHref(t.intended_mailbox)} style={chipStyle(activeBox === t.intended_mailbox)}>
              {short} <span style={chipCount}>{t.total}</span>
              {t.unread > 0 && <span style={chipUnread}>{t.unread}</span>}
            </Link>
          );
        })}
        <span style={{ width: 1, height: 18, background: 'var(--paper-deep)', margin: '0 6px' }} />
        <Link href={dirHref('all')} style={chipStyle(activeDir === 'all')}>All</Link>
        <Link href={dirHref('in')}  style={chipStyle(activeDir === 'in')}>↘ Received</Link>
        <Link href={dirHref('out')} style={chipStyle(activeDir === 'out')}>↗ Sent</Link>
      </div>

      {/* CHARTS ROW — 3 panels matching the /revenue/compset pattern */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 14 }}>
        <article className="panel" style={{ padding: 14 }}>
          <div className="panel-head" style={{ marginBottom: 8 }}>
            <span className="panel-head-title">Volume · <em>last 30 days</em></span>
            <span className="panel-head-meta">in / out per day</span>
          </div>
          <VolumeByDayChart data={volumeByDay} />
        </article>
        <article className="panel" style={{ padding: 14 }}>
          <div className="panel-head" style={{ marginBottom: 8 }}>
            <span className="panel-head-title">By <em>mailbox</em></span>
            <span className="panel-head-meta">top 8 · in/out split</span>
          </div>
          <MailboxVolumeChart data={mailboxVolumeData} />
        </article>
        <article className="panel" style={{ padding: 14 }}>
          <div className="panel-head" style={{ marginBottom: 8 }}>
            <span className="panel-head-title">Response <em>time</em></span>
            <span className="panel-head-meta">first reply · all threads</span>
          </div>
          <ResponseTimeChart data={respHisto} />
        </article>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '380px 1fr',
          gap: 14,
          marginTop: 14,
          minHeight: 'calc(100vh - 280px)',
        }}
      >
        {/* LEFT: thread list */}
        <aside
          style={{
            background: 'var(--paper-warm)',
            border: '1px solid var(--paper-deep)',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid var(--paper-deep)',
              fontFamily: 'var(--mono)',
              fontSize: 'var(--t-xs)',
              letterSpacing: 'var(--ls-extra)',
              textTransform: 'uppercase',
              color: 'var(--brass)',
            }}
          >
            Threads · {threads.length}
          </div>

          {threads.length === 0 && (
            <div style={{ padding: 24, color: 'var(--ink-mute)', fontSize: 'var(--t-sm)' }}>
              No emails yet. Make.com Gmail watcher → /api/sales/email-ingest → here.
            </div>
          )}

          <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }}>
            {threads.map((t) => {
              const isActive = t.thread_id === selectedId;
              const sender = senderLabel(t.last_from_name, t.last_from_email);
              return (
                <li key={t.thread_id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                  <Link
                    href={`/inbox?thread=${encodeURIComponent(t.thread_id)}`}
                    style={{
                      display: 'block',
                      padding: '10px 12px',
                      textDecoration: 'none',
                      color: 'var(--ink)',
                      background: isActive ? 'var(--paper-deep)' : 'transparent',
                      borderLeft: isActive ? '3px solid var(--brass)' : '3px solid transparent',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <span style={{
                        fontWeight: t.inquiry_status === 'new' ? 700 : 500,
                        fontSize: 'var(--t-sm)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: 1,
                      }}>
                        {sender}
                      </span>
                      <span style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', fontFamily: 'var(--mono)' }}>
                        {relativeTime(t.last_received_at)}
                      </span>
                    </div>
                    <div style={{
                      fontSize: 'var(--t-sm)',
                      fontWeight: t.inquiry_status === 'new' ? 600 : 400,
                      marginTop: 2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {t.last_subject ?? '(no subject)'}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                      {t.msg_count > 1 && (
                        <span style={{
                          fontFamily: 'var(--mono)',
                          fontSize: 'var(--t-xs)',
                          color: 'var(--ink-mute)',
                          background: 'var(--paper)',
                          padding: '1px 6px',
                          borderRadius: 3,
                        }}>
                          {t.msg_count} msgs
                        </span>
                      )}
                      {(() => {
                        const rm = threadResponseMap.get(t.thread_id);
                        if (rm == null) return null;
                        return (
                          <span style={{
                            fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                            color: 'var(--moss-glow)',
                            background: 'var(--paper)',
                            padding: '1px 6px', borderRadius: 3,
                          }}>
                            ↩ {fmtMinutes(rm)}
                          </span>
                        );
                      })()}
                      {t.triage_kind && (
                        <span style={{
                          fontFamily: 'var(--mono)',
                          fontSize: 'var(--t-xs)',
                          letterSpacing: 'var(--ls-loose)',
                          textTransform: 'uppercase',
                          color: 'var(--brass)',
                        }}>
                          {t.triage_kind}
                        </span>
                      )}
                      {t.inquiry_status && (
                        <StatusPill tone={STATUS_TONE[t.inquiry_status] ?? 'info'}>
                          {t.inquiry_status}
                        </StatusPill>
                      )}
                      <span style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', marginLeft: 'auto' }}>
                        → {t.last_mailbox.replace('@thenamkhan.com', '@nk').replace('@thedonnaportals.com', '@dp')}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* RIGHT: thread messages */}
        <article
          style={{
            background: 'var(--paper-warm)',
            border: '1px solid var(--paper-deep)',
            borderRadius: 8,
            padding: 0,
            overflow: 'hidden',
          }}
        >
          {!selectedId && (
            <div style={{ padding: 40, color: 'var(--ink-mute)', fontSize: 'var(--t-md)' }}>
              Select a thread to view its messages.
            </div>
          )}

          {selectedId && messages.length === 0 && (
            <div style={{ padding: 40, color: 'var(--ink-mute)', fontSize: 'var(--t-md)' }}>
              No messages found for this thread.
            </div>
          )}

          {messages.length > 0 && (
            <>
              <div
                style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--paper-deep)',
                  background: 'var(--paper-warm)',
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                }}
              >
                <h2 style={{
                  margin: 0,
                  fontFamily: 'var(--serif)',
                  fontSize: 'var(--t-xl)',
                  fontWeight: 500,
                }}>
                  {messages[0].subject ?? '(no subject)'}
                </h2>
                <div style={{
                  fontSize: 'var(--t-xs)',
                  color: 'var(--ink-mute)',
                  fontFamily: 'var(--mono)',
                  textTransform: 'uppercase',
                  letterSpacing: 'var(--ls-loose)',
                  marginTop: 4,
                }}>
                  {messages.length} message{messages.length === 1 ? '' : 's'}
                  {selectedRespMin != null && (
                    <> · <span style={{ color: 'var(--moss-glow)' }}>replied in {fmtMinutes(selectedRespMin)}</span></>
                  )}
                  {messages[0].inquiry_id && (
                    <>
                      {' · '}
                      <Link href={`/sales/inquiries/${messages[0].inquiry_id}`} style={{ color: 'var(--brass)' }}>
                        Open as inquiry →
                      </Link>
                    </>
                  )}
                </div>
              </div>

              <div style={{ padding: 18, maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}>
                {messages.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      marginBottom: 14,
                      padding: 14,
                      background: m.direction === 'outbound' ? 'var(--paper)' : 'var(--paper-warm)',
                      border: `1px solid ${m.direction === 'outbound' ? 'var(--brass-soft)' : 'var(--paper-deep)'}`,
                      borderLeft: `3px solid ${m.direction === 'outbound' ? 'var(--brass)' : 'var(--moss-glow)'}`,
                      borderRadius: 6,
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      marginBottom: 8,
                      gap: 12,
                    }}>
                      <div>
                        <span style={{
                          fontFamily: 'var(--mono)',
                          fontSize: 'var(--t-xs)',
                          letterSpacing: 'var(--ls-extra)',
                          textTransform: 'uppercase',
                          color: m.direction === 'outbound' ? 'var(--brass)' : 'var(--moss-glow)',
                          fontWeight: 700,
                        }}>
                          {m.direction === 'outbound' ? '↗ sent' : '↘ received'}
                        </span>
                        <span style={{ marginLeft: 8, fontWeight: 600, fontSize: 'var(--t-sm)' }}>
                          {senderLabel(m.from_name, m.from_email)}
                        </span>
                        {m.from_email && m.from_name && (
                          <span style={{ marginLeft: 6, color: 'var(--ink-mute)', fontSize: 'var(--t-xs)' }}>
                            &lt;{m.from_email}&gt;
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', fontFamily: 'var(--mono)' }}>
                        {new Date(m.received_at).toLocaleString('en-CA', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>

                    {(m.to_emails.length > 0 || m.cc_emails.length > 0) && (
                      <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', marginBottom: 8 }}>
                        {m.to_emails.length > 0 && <>to: {m.to_emails.join(', ')}</>}
                        {m.cc_emails.length > 0 && <> · cc: {m.cc_emails.join(', ')}</>}
                      </div>
                    )}

                    <div style={{
                      fontFamily: 'var(--serif)',
                      fontSize: 'var(--t-md)',
                      lineHeight: 1.6,
                      color: 'var(--ink-soft)',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {bodyExcerpt(m.body_text, 5000)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </article>
      </div>
    </Page>
  );
}
