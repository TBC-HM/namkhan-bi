// app/mail/analytics/page.tsx
// Email inbox analytics — per-mailbox throughput, response time, top senders.
//
// PBS 2026-07-15: full analytics view under /mail/*, sibling to the full-screen
// inbox at /mail. Data source is public.v_mail_analytics_daily, a public
// bridge over sales.email_messages (populated by /api/cron/poll-gmail).
//
// Design tokens match the sibling /mail/page.tsx palette (Forest / Cream /
// Hairline). Hardcoded per Namkhan token-ladder rule — var(--paper-warm)
// resolves to invisible dark on this tenant.
//
// Server component: no interactive primitives. All data is fetched + shaped
// server-side and rendered as inline JSX (mirrors the pattern of
// app/revenue/reports/scheduled/[template]/preview/page.tsx).

import { redirect } from 'next/navigation';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FOREST = '#084838';
const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const CREAM  = '#F5F0E1';
const OLIVE  = '#7A7A56';
const RED    = '#B33A3A';

const PROPERTY_ID = 260955; // Namkhan

interface DailyRow {
  day: string;
  property_id: number;
  mailbox: string | null;
  inbound_count: number;
  outbound_count: number;
  unanswered_count: number;
  avg_response_hours: number | null;
  top_sender: string | null;
}

function fmtInt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '0';
  return Math.round(n).toLocaleString('en-US');
}

function fmtHours(h: number | null | undefined): string {
  if (h == null || !Number.isFinite(h)) return '—';
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

function daysBetween(iso: string, ref: Date): number {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.floor((ref.getTime() - t) / 86_400_000);
}

function shortEmail(addr: string | null | undefined): string {
  if (!addr) return '—';
  const s = addr.trim();
  if (s.length <= 34) return s;
  return s.slice(0, 32) + '…';
}

export default async function MailAnalyticsPage() {
  const user = await getCurrentAuthUser();
  if (!user) redirect('/login?next=/mail/analytics');

  const sb = getSupabaseAdmin();

  // -------------------------------------------------------------------
  // 1) Pull last 60 days of the bridge view (property-scoped).
  // -------------------------------------------------------------------
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const { data: dailyRaw, error: dailyErr } = await sb
    .from('v_mail_analytics_daily')
    .select('day,property_id,mailbox,inbound_count,outbound_count,unanswered_count,avg_response_hours,top_sender')
    .eq('property_id', PROPERTY_ID)
    .gte('day', sixtyDaysAgo)
    .order('day', { ascending: true });

  const daily: DailyRow[] = (dailyRaw ?? []) as DailyRow[];

  // -------------------------------------------------------------------
  // 2) Determine freshness anchor. If the poller is stale (last data
  //    is not today), we anchor the KPI stripe on the last-observed day
  //    so PBS doesn't just see zeros. We announce the anchor in the header.
  // -------------------------------------------------------------------
  const lastDayIso = daily.length ? daily[daily.length - 1].day : null;
  const todayIso   = new Date().toISOString().slice(0, 10);
  const isStale    = lastDayIso !== null && lastDayIso < todayIso;
  const anchor     = lastDayIso ?? todayIso;
  const anchorDate = new Date(anchor + 'T00:00:00Z');
  const staleDays  = lastDayIso ? daysBetween(lastDayIso, new Date()) : null;

  // -------------------------------------------------------------------
  // 3) KPI stripe — today (anchor) totals + rolling averages.
  // -------------------------------------------------------------------
  const anchorRows = daily.filter((r) => r.day === anchor);
  const anchorInbound  = anchorRows.reduce((s, r) => s + (r.inbound_count  || 0), 0);
  const anchorOutbound = anchorRows.reduce((s, r) => s + (r.outbound_count || 0), 0);

  // Response time — average of daily averages weighted by responded-thread
  // volume is not possible without response counts, so we surface the mean
  // of daily means over the last 30 days ending at anchor. Honest fallback: '—'.
  const thirtyStart = new Date(anchorDate.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
  const rolling30 = daily.filter((r) => r.day >= thirtyStart && r.day <= anchor);
  const avgHoursList = rolling30
    .map((r) => r.avg_response_hours)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const avg30Hours =
    avgHoursList.length > 0
      ? avgHoursList.reduce((s, v) => s + v, 0) / avgHoursList.length
      : null;

  // -------------------------------------------------------------------
  // 4) Unanswered — we already have per-day unanswered_count in the bridge
  //    view. The message-level detail lives in sales.email_messages which
  //    is not PostgREST-exposed, so we roll up unanswered by mailbox +
  //    window instead of listing individual threads. If PBS wants a
  //    thread-level list later, add a `public.v_mail_unanswered_threads`
  //    bridge view or a SECURITY DEFINER RPC.
  // -------------------------------------------------------------------
  const sevenStart = new Date(anchorDate.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
  const rolling7 = daily.filter((r) => r.day >= sevenStart && r.day <= anchor);
  const anchorUnansweredWindow = rolling7.reduce(
    (s, r) => s + (r.unanswered_count || 0),
    0,
  );

  // Overdue = inbound rows from >=24h ago that are still counted
  // as unanswered on their arrival day. Proxy: unanswered_count on
  // days older than yesterday, within the last 30d.
  const yesterdayIso = new Date(anchorDate.getTime() - 1 * 86_400_000).toISOString().slice(0, 10);
  const overdueCount = rolling30
    .filter((r) => r.day < yesterdayIso)
    .reduce((s, r) => s + (r.unanswered_count || 0), 0);

  // -------------------------------------------------------------------
  // 5) Trend series — last 30 days: {day, inbound, outbound}.
  // -------------------------------------------------------------------
  const trendMap = new Map<string, { inbound: number; outbound: number }>();
  rolling30.forEach((r) => {
    const cur = trendMap.get(r.day) ?? { inbound: 0, outbound: 0 };
    cur.inbound  += r.inbound_count  || 0;
    cur.outbound += r.outbound_count || 0;
    trendMap.set(r.day, cur);
  });
  const trend = Array.from(trendMap.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, v]) => ({ day, ...v }));
  const trendMax = Math.max(1, ...trend.map((r) => Math.max(r.inbound, r.outbound)));

  // -------------------------------------------------------------------
  // 6) Top senders (last 7d) — aggregate top_sender across mailboxes.
  //    The view surfaces the daily #1 per mailbox; we roll them up.
  // -------------------------------------------------------------------
  const senderMap = new Map<string, { count: number; firstDay: string }>();
  rolling7.forEach((r) => {
    if (!r.top_sender) return;
    const cur = senderMap.get(r.top_sender);
    if (cur) {
      cur.count += r.inbound_count || 0;
      if (r.day < cur.firstDay) cur.firstDay = r.day;
    } else {
      senderMap.set(r.top_sender, { count: r.inbound_count || 0, firstDay: r.day });
    }
  });
  const topSenders = Array.from(senderMap.entries())
    .map(([sender, v]) => ({ sender, count: v.count, firstDay: v.firstDay }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // -------------------------------------------------------------------
  // 7) Mailbox mix (rolling 30d).
  // -------------------------------------------------------------------
  const mailboxMap = new Map<string, { inbound: number; outbound: number; unanswered: number }>();
  rolling30.forEach((r) => {
    const key = r.mailbox ?? '(unknown)';
    const cur = mailboxMap.get(key) ?? { inbound: 0, outbound: 0, unanswered: 0 };
    cur.inbound    += r.inbound_count    || 0;
    cur.outbound   += r.outbound_count   || 0;
    cur.unanswered += r.unanswered_count || 0;
    mailboxMap.set(key, cur);
  });
  const mailboxRows = Array.from(mailboxMap.entries())
    .map(([mailbox, v]) => ({ mailbox, ...v }))
    .sort((a, b) => b.inbound + b.outbound - (a.inbound + a.outbound));

  // -------------------------------------------------------------------
  // Layout constants
  // -------------------------------------------------------------------
  const outer: React.CSSProperties = {
    minHeight: '100vh',
    background: WHITE,
    color: INK,
    fontFamily: '"Inter Tight", -apple-system, Helvetica, Arial, sans-serif',
    padding: '20px 24px 48px',
  };
  const shell: React.CSSProperties = {
    maxWidth: 1240,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  };
  const card: React.CSSProperties = {
    background: WHITE,
    border: '1px solid ' + HAIR,
    borderRadius: 8,
    padding: 20,
  };
  const cardTitle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: OLIVE,
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    marginBottom: 14,
  };

  const kpi = (label: string, value: string, sub?: string, tone: 'ink' | 'forest' | 'red' = 'ink') => (
    <div style={{
      flex: '1 1 180px',
      minWidth: 160,
      background: WHITE,
      border: '1px solid ' + HAIR,
      borderRadius: 8,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <div style={{ fontSize: 11, color: OLIVE, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{
        fontSize: 26, fontWeight: 600,
        color: tone === 'forest' ? FOREST : tone === 'red' ? RED : INK,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
      {sub ? (
        <div style={{ fontSize: 11, color: INK_M }}>{sub}</div>
      ) : null}
    </div>
  );

  const anchorLabel = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  }).format(anchorDate);

  return (
    <div style={outer}>
      <div style={shell}>
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 22, fontWeight: 600, color: INK }}>Mail analytics</div>
            <a href="/mail" style={{
              fontSize: 12, color: FOREST, textDecoration: 'none', fontWeight: 500,
              borderBottom: '1px solid ' + FOREST, paddingBottom: 1,
            }}>
              ← Full inbox
            </a>
          </div>
          <div style={{ fontSize: 12, color: INK_M }}>
            Property {PROPERTY_ID} · anchor day {anchorLabel}
            {isStale && staleDays != null ? (
              <span style={{ color: RED, marginLeft: 8, fontWeight: 500 }}>
                · poller last ran {staleDays}d ago
              </span>
            ) : null}
          </div>
          {dailyErr ? (
            <div style={{
              fontSize: 12, color: RED, background: CREAM,
              border: '1px solid ' + HAIR, borderRadius: 4,
              padding: 8, marginTop: 4,
            }}>
              View read error: {dailyErr.message}
            </div>
          ) : null}
        </div>

        {/* KPI stripe */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {kpi(
            (isStale ? 'Last-day inbound' : 'Inbound today'),
            fmtInt(anchorInbound),
            `${fmtInt(rolling7.reduce((s,r)=>s+(r.inbound_count||0),0))} in last 7d`,
          )}
          {kpi(
            (isStale ? 'Last-day outbound' : 'Outbound today'),
            fmtInt(anchorOutbound),
            `${fmtInt(rolling7.reduce((s,r)=>s+(r.outbound_count||0),0))} in last 7d`,
            'forest',
          )}
          {kpi(
            'Unanswered (7d)',
            fmtInt(anchorUnansweredWindow),
            'inbound threads with no reply',
            anchorUnansweredWindow > 20 ? 'red' : 'ink',
          )}
          {kpi(
            'Avg first-response (30d)',
            fmtHours(avg30Hours),
            avg30Hours == null ? 'no tracked replies in window' : 'mean of daily means',
          )}
          {kpi(
            'Overdue (>24h, 30d)',
            fmtInt(overdueCount),
            'unanswered from >1d ago',
            overdueCount > 50 ? 'red' : 'ink',
          )}
        </div>

        {/* Trend chart */}
        <div style={card}>
          <div style={cardTitle}>Inbound vs outbound · last 30 days</div>
          {trend.length === 0 ? (
            <div style={{ fontSize: 13, color: INK_M }}>No mail activity in the last 30 days.</div>
          ) : (
            <div>
              <div style={{
                display: 'flex', alignItems: 'flex-end', gap: 3,
                height: 180, borderBottom: '1px solid ' + HAIR, paddingBottom: 4,
              }}>
                {trend.map((r) => {
                  const inH  = Math.round((r.inbound  / trendMax) * 160);
                  const outH = Math.round((r.outbound / trendMax) * 160);
                  return (
                    <div key={r.day} style={{
                      flex: '1 1 0', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', gap: 2, minWidth: 8,
                    }}
                    title={`${r.day}\ninbound ${r.inbound}\noutbound ${r.outbound}`}>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 160 }}>
                        <div style={{
                          width: 6, height: inH, background: INK,
                          borderTopLeftRadius: 1, borderTopRightRadius: 1,
                        }} />
                        <div style={{
                          width: 6, height: outH, background: FOREST,
                          borderTopLeftRadius: 1, borderTopRightRadius: 1,
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                marginTop: 6, fontSize: 10, color: INK_M,
              }}>
                <span>{trend[0].day}</span>
                <span>{trend[trend.length - 1].day}</span>
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, color: INK_M }}>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: INK, marginRight: 6, borderRadius: 2, verticalAlign: 'middle' }} />inbound</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: FOREST, marginRight: 6, borderRadius: 2, verticalAlign: 'middle' }} />outbound</span>
              </div>
            </div>
          )}
        </div>

        {/* Two-column split */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20 }}>
          {/* Mailbox mix */}
          <div style={card}>
            <div style={cardTitle}>Mailbox mix · last 30 days</div>
            {mailboxRows.length === 0 ? (
              <div style={{ fontSize: 13, color: INK_M }}>No mailbox traffic.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: OLIVE, textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px', fontWeight: 600, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', borderBottom: '1px solid ' + HAIR }}>Mailbox</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', borderBottom: '1px solid ' + HAIR }}>Inbound</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', borderBottom: '1px solid ' + HAIR }}>Outbound</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', borderBottom: '1px solid ' + HAIR }}>Unanswered</th>
                  </tr>
                </thead>
                <tbody>
                  {mailboxRows.map((r) => (
                    <tr key={r.mailbox} style={{ borderBottom: '1px solid ' + HAIR }}>
                      <td style={{ padding: '8px', color: INK }}>{r.mailbox}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtInt(r.inbound)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: FOREST }}>{fmtInt(r.outbound)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: r.unanswered > 20 ? RED : INK }}>{fmtInt(r.unanswered)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Top senders */}
          <div style={card}>
            <div style={cardTitle}>Top senders · last 7 days</div>
            {topSenders.length === 0 ? (
              <div style={{ fontSize: 13, color: INK_M }}>No inbound mail in the last 7 days of tracked data.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: OLIVE, textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px', fontWeight: 600, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', borderBottom: '1px solid ' + HAIR }}>Sender</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', borderBottom: '1px solid ' + HAIR }}>Msgs</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', borderBottom: '1px solid ' + HAIR }}>First seen</th>
                  </tr>
                </thead>
                <tbody>
                  {topSenders.map((s) => (
                    <tr key={s.sender} style={{ borderBottom: '1px solid ' + HAIR }}>
                      <td style={{ padding: '8px', color: INK, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}>{shortEmail(s.sender)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtInt(s.count)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: INK_M, fontSize: 12 }}>{s.firstDay}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Data source footnote */}
        <div style={{
          fontSize: 11, color: INK_M, background: CREAM,
          border: '1px solid ' + HAIR, borderRadius: 4, padding: '10px 12px',
          lineHeight: 1.6,
        }}>
          Source: <code style={{ background: WHITE, padding: '1px 6px', borderRadius: 3, border: '1px solid ' + HAIR }}>public.v_mail_analytics_daily</code>
          {' '}(bridge over <code style={{ background: WHITE, padding: '1px 6px', borderRadius: 3, border: '1px solid ' + HAIR }}>sales.email_messages</code>,
          populated by <code style={{ background: WHITE, padding: '1px 6px', borderRadius: 3, border: '1px solid ' + HAIR }}>/api/cron/poll-gmail</code>).
          Days are Asia/Vientiane calendar days. Avg response time is the mean of daily means of thread first-response;
          many threads have no tracked outbound (replied via Gmail web) so response time is a floor, not a ceiling.
        </div>
      </div>
    </div>
  );
}
