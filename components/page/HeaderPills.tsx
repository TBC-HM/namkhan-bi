'use client';

// components/page/HeaderPills.tsx
// Shared header pills rendered top-right on every <Page>: temperature,
// air/AQI, today's date, user dropdown. Lifted out of DeptEntry so the
// header is consistent across dept-entry pages AND every sub-page (PBS
// 2026-05-09: "the air symbol, temperature, who is logged in is not on
// every page — this header must be consistent throughout").
//
// PBS 2026-05-09 (hover-leave bugfix): the popovers used to close the
// instant the cursor left the trigger pill, even before reaching the
// popover content. Fix:
//   (a) wrap trigger + popover in a single relative container with the
//       onMouseLeave handler on the wrapper (NOT the trigger). Popover
//       lives inside the wrapper so the cursor never leaves the wrapper
//       when moving from pill → popover.
//   (b) ~80ms close delay via a setTimeout ref; mouseEnter on either
//       trigger or popover cancels it, covering the small visual gap.
//   (c) popover sits flush under the trigger (top: 100%) and the wrapper
//       carries a bridging paddingBottom so there is no dead-zone gap.

import { useEffect, useRef, useState } from 'react';

interface HeaderPillsProps {
  /** Optional per-dept KPI tiles shown when the user hovers the date pill. */
  kpiTiles?: Array<{ k: string; v: string; d: string }>;
}

const USER_NAME = 'PBS';
// PBS 2026-05-09 (round 2): 80ms was too tight — popovers closed before
// the cursor reached them on diagonal paths from the chip into the wider
// popover content. Bumped to 250ms so any reasonable mouse move lands
// safely; mouseEnter on either trigger or popover cancels the timer.
const HOVER_CLOSE_DELAY_MS = 250;

// 7-day forecast preview (PBS 2026-05-09 #16+#17). Static placeholder until
// Open-Meteo + IQAir hourly wiring lands. KBPopover renders k/v/d cards.
const SEVEN_DAY_TEMP = [
  { k: 'Today · Sat',  v: '32° / 24°', d: 'partly cloudy · 0 mm' },
  { k: 'Sun',          v: '33° / 24°', d: 'thunderstorm PM · 4 mm' },
  { k: 'Mon',          v: '31° / 23°', d: 'rain shower AM · 9 mm' },
  { k: 'Tue',          v: '30° / 23°', d: 'overcast · 2 mm' },
  { k: 'Wed',          v: '32° / 24°', d: 'sun + cloud · 0 mm' },
  { k: 'Thu',          v: '34° / 25°', d: 'hot, dry · 0 mm' },
  { k: 'Fri',          v: '33° / 24°', d: 'partly cloudy · 1 mm' },
];
const SEVEN_DAY_AIR = [
  { k: 'Today · Sat',  v: 'AQI 42',   d: 'PM2.5 11 · UV 8 · 76% RH' },
  { k: 'Sun',          v: 'AQI 38',   d: 'PM2.5 9 · UV 7 · 81% RH'  },
  { k: 'Mon',          v: 'AQI 56',   d: 'PM2.5 16 · UV 6 · 84% RH' },
  { k: 'Tue',          v: 'AQI 49',   d: 'PM2.5 13 · UV 7 · 78% RH' },
  { k: 'Wed',          v: 'AQI 44',   d: 'PM2.5 12 · UV 8 · 73% RH' },
  { k: 'Thu',          v: 'AQI 61',   d: 'PM2.5 18 · UV 9 · 65% RH' },
  { k: 'Fri',          v: 'AQI 50',   d: 'PM2.5 14 · UV 8 · 72% RH' },
];

function todayLabel(): string {
  const d = new Date();
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
}

// PBS 2026-05-09 (repair list #6): control-center inbox pill in the
// header. Replaces the simple "Inbox" link that lived in the user
// dropdown with an actionable badge + hover popover. Same hover-bridge
// pattern as temp/air pills (paddingLeft 280 + 250ms close delay).
interface InboxSummary {
  unread: number;
  unanswered: number;
  spam: number;
  inbound_24h: number;
  outbound_24h: number;
  top_senders_24h: Array<{
    email: string;
    name: string | null;
    inbound_24h: number;
    inbound_7d: number;
    threads_24h: number;
    last_msg: string | null;
    is_automation: boolean;
  }>;
  generated_at: string;
}
const INBOX_EMPTY: InboxSummary = {
  unread: 0, unanswered: 0, spam: 0,
  inbound_24h: 0, outbound_24h: 0, top_senders_24h: [],
  generated_at: '',
};

function formatRel(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1)   return 'just now';
  if (min < 60)  return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24)    return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function HeaderPills({ kpiTiles }: HeaderPillsProps) {
  const [tempOpen, setTempOpen] = useState(false);
  const [airOpen,  setAirOpen]  = useState(false);
  const [dateHover, setDateHover] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [lang, setLang] = useState<'en' | 'th'>('en');
  const [inbox, setInbox] = useState<InboxSummary>(INBOX_EMPTY);

  // One close-timer per pill. mouseEnter on trigger OR popover cancels it.
  const tempTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const airTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dateTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inboxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch inbox summary on mount + every 60s. Cheap (one /api call) and the
  // popover is always fresh whenever the operator hovers.
  useEffect(() => {
    let cancelled = false;
    const fetchSummary = () => {
      fetch('/api/inbox/summary', { cache: 'no-store' })
        .then((r) => r.ok ? r.json() : INBOX_EMPTY)
        .then((d: InboxSummary) => { if (!cancelled) setInbox(d ?? INBOX_EMPTY); })
        .catch(() => { /* keep last value */ });
    };
    fetchSummary();
    const id = setInterval(fetchSummary, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  function clearTimer(ref: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) {
    if (ref.current) { clearTimeout(ref.current); ref.current = null; }
  }
  function scheduleClose(
    ref: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
    setter: (v: boolean) => void,
  ) {
    clearTimer(ref);
    ref.current = setTimeout(() => { setter(false); ref.current = null; }, HOVER_CLOSE_DELAY_MS);
  }

  return (
    <>
      {/* TEMP — wrapper carries onMouseLeave so cursor stays inside it as
          it moves from pill to popover. (PBS 2026-05-09 hover-leave fix). */}
      <div
        style={S.pillWrap}
        onMouseEnter={() => {
          clearTimer(tempTimer);
          setTempOpen(true); setAirOpen(false); setUserOpen(false);
        }}
        onMouseLeave={() => scheduleClose(tempTimer, setTempOpen)}
      >
        <button
          onClick={() => { setTempOpen(o => !o); setAirOpen(false); setUserOpen(false); }}
          title="Temperature in Luang Prabang · hover for 7-day"
          aria-label="Temperature"
          style={S.chip}
        >
          <span style={{ color: '#f4d99a', fontSize: 12 }}>☀</span>
          <span style={S.chipText}>32°</span>
        </button>
        {tempOpen && (
          <div
            style={S.popoverHost}
            onMouseEnter={() => clearTimer(tempTimer)}
            onMouseLeave={() => scheduleClose(tempTimer, setTempOpen)}
          >
            <KBPopover onClose={() => setTempOpen(false)}
              eyebrow="Temperature · Luang Prabang"
              title="Next 7 days · °C · rain mm"
              rows={SEVEN_DAY_TEMP}
              footer="preview · Open-Meteo wiring TODO"
            />
          </div>
        )}
      </div>

      {/* AIR — same hover-wrap pattern. */}
      <div
        style={S.pillWrap}
        onMouseEnter={() => {
          clearTimer(airTimer);
          setAirOpen(true); setTempOpen(false); setUserOpen(false);
        }}
        onMouseLeave={() => scheduleClose(airTimer, setAirOpen)}
      >
        <button
          onClick={() => { setAirOpen(o => !o); setTempOpen(false); setUserOpen(false); }}
          title="Air quality + humidity · hover for 7-day"
          aria-label="Air"
          style={S.chip}
        >
          <span style={{ color: '#f4d99a', fontSize: 12 }}>≈</span>
          <span style={S.chipText}>AQI 42</span>
        </button>
        {airOpen && (
          <div
            style={S.popoverHost}
            onMouseEnter={() => clearTimer(airTimer)}
            onMouseLeave={() => scheduleClose(airTimer, setAirOpen)}
          >
            <KBPopover onClose={() => setAirOpen(false)}
              eyebrow="Air · Luang Prabang"
              title="Next 7 days · AQI · UV · humidity"
              rows={SEVEN_DAY_AIR}
              footer="preview · IQAir wiring TODO"
            />
          </div>
        )}
      </div>

      {/* INBOX — control-center pill (PBS 2026-05-09 repair-list #6).
          Click → /inbox. Hover → popover with unread/unanswered/spam,
          top senders 24h with drill-down counts. */}
      <div
        style={S.pillWrap}
        onMouseEnter={() => {
          clearTimer(inboxTimer);
          setInboxOpen(true); setTempOpen(false); setAirOpen(false); setUserOpen(false);
        }}
        onMouseLeave={() => scheduleClose(inboxTimer, setInboxOpen)}
      >
        <a
          href="/inbox"
          title={`Inbox · ${inbox.unread} unread · ${inbox.unanswered} unanswered`}
          aria-label="Inbox"
          style={S.inboxChip}
        >
          <svg
            width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden
          >
            <path d="M4 6h16v12H4z" />
            <polyline points="4,7 12,13 20,7" />
          </svg>
          <span style={S.chipText}>{inbox.unread}</span>
          {inbox.unread > 0 && <span style={S.inboxBubble}>{inbox.unread > 99 ? '99+' : inbox.unread}</span>}
        </a>
        {inboxOpen && (
          <div
            style={S.popoverHost}
            onMouseEnter={() => clearTimer(inboxTimer)}
            onMouseLeave={() => scheduleClose(inboxTimer, setInboxOpen)}
          >
            <InboxPopover summary={inbox} onClose={() => setInboxOpen(false)} />
          </div>
        )}
      </div>

      {/* DATE — hover → KPI tiles + window/compare quick-jumps. */}
      <div
        style={S.pillWrap}
        onMouseEnter={() => { clearTimer(dateTimer); setDateHover(true); }}
        onMouseLeave={() => scheduleClose(dateTimer, setDateHover)}
      >
        <span style={S.dateText}>{todayLabel()}</span>
        {dateHover && kpiTiles && kpiTiles.length > 0 && (
          <div
            style={S.dateGrid}
            onMouseEnter={() => clearTimer(dateTimer)}
            onMouseLeave={() => scheduleClose(dateTimer, setDateHover)}
          >
            {kpiTiles.map(t => (
              <div key={t.k} style={S.dateCell}>
                <div style={S.dateCellK}>{t.k}</div>
                <div style={S.dateCellV}>{t.v}</div>
                <div style={S.dateCellD}>{t.d}</div>
              </div>
            ))}
            {/* PBS 2026-05-09 #20: window + compare quick-jumps inside the
                date popup so the operator can pivot the dashboard without
                leaving the hover. */}
            <div style={S.dateWindowRow}>
              <span style={S.dateWindowLabel}>window</span>
              <a href="?win=today" style={S.dateWindowLink}>today</a>
              <a href="?win=7d"    style={S.dateWindowLink}>7d</a>
              <a href="?win=30d"   style={S.dateWindowLink}>30d</a>
              <a href="?win=90d"   style={S.dateWindowLink}>90d</a>
              <a href="?win=ytd"   style={S.dateWindowLink}>YTD</a>
            </div>
            <div style={S.dateWindowRow}>
              <span style={S.dateWindowLabel}>compare</span>
              <a href="?cmp=stly"   style={S.dateWindowLink}>STLY</a>
              <a href="?cmp=lw"     style={S.dateWindowLink}>LW</a>
              <a href="?cmp=lm"     style={S.dateWindowLink}>LM</a>
              <a href="?cmp=budget" style={S.dateWindowLink}>BUD</a>
            </div>
          </div>
        )}
      </div>

      {/* USER — click-toggle. No hover handlers, so the hover-leave bug
          never applied here, but we still wrap it in pillWrap so the
          dropdown is positioned via top: 100% (consistent with siblings). */}
      <div style={S.pillWrap}>
        <button onClick={() => setUserOpen(o => !o)} style={S.userBtn}>
          <span style={S.avatar}>{(USER_NAME[0] ?? '?').toUpperCase()}</span>
          {USER_NAME} ▾
        </button>
        {userOpen && (
          <div style={S.userMenu}>
            {/* PBS 2026-05-09 #21 → repair-list #6: inbox left this dropdown
                — now lives as the control-center pill above (hover popover
                with unread/unanswered/spam + top-sender drill-down). */}
            <a href="/settings/property"        onClick={() => setUserOpen(false)} style={S.link}>Settings (Property)</a>
            <a href="/cockpit/users"             onClick={() => setUserOpen(false)} style={S.link}>Account</a>
            <div style={S.menuDivider}>
              {/* PBS 2026-05-09 #26: settings sub-pages live under cockpit now. */}
              <div style={S.menuSection}>Tools</div>
              <a href="/cockpit"                   onClick={() => setUserOpen(false)} style={S.link}>IT cockpit</a>
              <a href="/cockpit-v2"                onClick={() => setUserOpen(false)} style={S.link}>Cockpit v2 <span style={{ fontSize: 9, color: '#a8854a', marginLeft: 6, letterSpacing: '0.14em', textTransform: 'uppercase' }}>preview</span></a>
              <a href="/cockpit/tasks"             onClick={() => setUserOpen(false)} style={S.link}>Tasks</a>
              <a href="/front-office/arrivals"     onClick={() => setUserOpen(false)} style={S.link}>Front office</a>
              <a href="/settings/email-categories" onClick={() => setUserOpen(false)} style={S.link}>Email categories</a>
              <a href="/settings/integrations"     onClick={() => setUserOpen(false)} style={S.link}>Integrations</a>
              <a href="/settings/users"            onClick={() => setUserOpen(false)} style={S.link}>Users &amp; roles</a>
              <a href="/settings/dq"               onClick={() => setUserOpen(false)} style={S.link}>DQ engine</a>
              <a href="/messy-data"                onClick={() => setUserOpen(false)} style={S.link}>Messy data</a>
              <a href="/settings/platform-map"     onClick={() => setUserOpen(false)} style={S.link}>Platform map</a>
            </div>
            <div style={S.langRow}>
              <button onClick={() => setLang('en')} title="English" style={langFlag(lang === 'en')}>🇬🇧</button>
              <button onClick={() => setLang('th')} title="ไทย"     style={langFlag(lang === 'th')}>🇹🇭</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// PBS 2026-05-09 (repair-list #6): control-center inbox popover. Shows
// the operator who replied in time, who is silent, spam volume, and the
// top inbound senders of the last 24h with per-sender drill-down counts
// (sends 7d, distinct threads, last activity).
function InboxPopover({ summary, onClose }: { summary: InboxSummary; onClose: () => void }) {
  const stats: Array<{ k: string; v: string; d: string; tone?: 'good' | 'warn' | 'bad' }> = [
    { k: 'Unread',     v: String(summary.unread),     d: 'inquiries · status=new' },
    { k: 'Unanswered', v: String(summary.unanswered), d: 'no outbound reply',         tone: summary.unanswered > 5 ? 'warn' : undefined },
    { k: 'Spam',       v: String(summary.spam),       d: 'Gmail-filtered',            tone: summary.spam > 0 ? 'bad' : undefined },
    { k: 'In · 24h',   v: String(summary.inbound_24h),  d: `${summary.outbound_24h} replies sent` },
  ];
  const senders = summary.top_senders_24h ?? [];
  return (
    <div style={S.inboxPopover}>
      <div style={S.popHead}>
        <div style={S.popEyebrow}>Inbox · control center</div>
        <button onClick={onClose} aria-label="Close" style={S.popClose}>×</button>
      </div>
      <div style={S.popTitle}>
        Last 24 hours · <em>{summary.inbound_24h} in / {summary.outbound_24h} out</em>
      </div>

      {/* Stats grid (4 KPI cells) */}
      <div style={S.popGrid}>
        {stats.map((s) => (
          <div key={s.k} style={S.popCell}>
            <div style={S.popCellK}>{s.k}</div>
            <div style={{
              ...S.popCellV,
              color: s.tone === 'bad'  ? '#e08484'
                   : s.tone === 'warn' ? '#f4d99a'
                   : '#f0e5cb',
            }}>{s.v}</div>
            <div style={S.popCellD}>{s.d}</div>
          </div>
        ))}
      </div>

      {/* Top senders (last 24h) — drill-down per sender */}
      <div style={S.inboxSendersHead}>Top senders · 24h</div>
      {senders.length === 0 && (
        <div style={S.inboxEmpty}>No inbound traffic in the last 24 hours.</div>
      )}
      {senders.length > 0 && (
        <div style={S.inboxSenderList}>
          {senders.map((s) => (
            <div key={s.email} style={S.inboxSenderRow}>
              <div style={S.inboxSenderHead}>
                <span style={S.inboxSenderName}>
                  {s.name ?? s.email}
                  {s.is_automation && <span style={S.inboxBotTag}>BOT</span>}
                </span>
                <span style={S.inboxSenderCount}>{s.inbound_24h}× · 24h</span>
              </div>
              <div style={S.inboxSenderMeta}>
                {s.email !== s.name && <span>{s.email}</span>}
                <span style={S.inboxSenderDot}>·</span>
                <span>{s.inbound_7d}/wk</span>
                <span style={S.inboxSenderDot}>·</span>
                <span>{s.threads_24h} thread{s.threads_24h === 1 ? '' : 's'}</span>
                <span style={S.inboxSenderDot}>·</span>
                <span>{formatRel(s.last_msg)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer CTA */}
      <div style={S.inboxFooterRow}>
        <a href="/inbox" style={S.inboxFooterLink}>Open inbox →</a>
        <a href="/inbox?box=spam" style={S.inboxFooterMuted}>Spam ({summary.spam})</a>
      </div>
    </div>
  );
}

function KBPopover({ onClose, eyebrow, title, rows, footer }: {
  onClose: () => void; eyebrow: string; title: string;
  rows: Array<{ k: string; v: string; d: string }>; footer?: string;
}) {
  return (
    <div style={S.popover}>
      <div style={S.popHead}>
        <div style={S.popEyebrow}>{eyebrow}</div>
        <button onClick={onClose} aria-label="Close" style={S.popClose}>×</button>
      </div>
      <div style={S.popTitle}>{title}</div>
      <div style={S.popGrid}>
        {rows.map(r => (
          <div key={r.k} style={S.popCell}>
            <div style={S.popCellK}>{r.k}</div>
            <div style={S.popCellV}>{r.v}</div>
            <div style={S.popCellD}>{r.d}</div>
          </div>
        ))}
      </div>
      {footer && <div style={S.popFooter}>{footer}</div>}
    </div>
  );
}

function langFlag(active: boolean): React.CSSProperties {
  return {
    background:   active ? '#1c160d' : 'transparent',
    border:       `1px solid ${active ? '#a8854a' : '#2a261d'}`,
    borderRadius: 4,
    padding:      '3px 8px',
    cursor:       'pointer',
    fontSize:     14,
    lineHeight:   1,
  };
}

const S: Record<string, React.CSSProperties> = {
  // Wrapper bridges trigger ↔ popover. The negative bottom margin keeps
  // the layout footprint identical to the previous build while the 6px
  // paddingBottom acts as a hover-bridge so the cursor never leaves the
  // wrapper while travelling from pill to popover.
  pillWrap: {
    position: 'relative',
    paddingBottom: 6,
    marginBottom: -6,
  },
  chip: {
    // PBS 2026-05-09 #33: brighter temp/air pills.
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'transparent', border: '1px solid #3a3327',
    borderRadius: 999, padding: '4px 10px', cursor: 'pointer', color: '#f0e5cb',
  },
  chipText: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, fontWeight: 600 },
  // popoverHost is a transparent positioner that shares the close-delay
  // handlers. Sits flush under the trigger (top: 100%). PBS 2026-05-09
  // round-2: the chip is ~80px wide but the popover is ~360px and aligned
  // right:0, so a cursor moving down-and-left into the popover crossed a
  // horizontal "no man's land" outside both pillWrap and popoverHost rects.
  // Fix: extend popoverHost leftward via paddingLeft so the rect covers
  // the diagonal travel path. Padding is transparent and pointerEvents:auto
  // so the cursor staying in the padded zone keeps the popover open.
  popoverHost: {
    position: 'absolute',
    top: '100%',
    right: 0,
    paddingTop: 8,
    paddingLeft: 280,   // diagonal hover bridge (chip 80 → popover 360)
    pointerEvents: 'auto',
    zIndex: 60,
  },
  dateText: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
    color: '#f0e5cb', fontWeight: 600, cursor: 'help',
  },
  dateGrid: {
    position: 'absolute', top: '100%', right: 0, zIndex: 60,
    marginTop: 6,
    background: '#0f0d0a', border: '1px solid #3a3327', borderRadius: 8,
    padding: 12, minWidth: 360, boxShadow: '0 12px 28px rgba(0,0,0,0.6)',
    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8,
    pointerEvents: 'auto',
  },
  dateCell: { background: '#15110b', border: '1px solid #2a261d', borderRadius: 6, padding: '8px 10px' },
  dateCellK: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 9, letterSpacing: '0.22em', color: '#7d7565', textTransform: 'uppercase' },
  dateCellV: { fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: 22, color: '#f0e5cb', marginTop: 2 },
  dateCellD: { fontSize: 10, color: '#9b907a', marginTop: 2 },
  dateFooter: { gridColumn: '1 / -1', fontSize: 10, color: '#5a5448', textAlign: 'right', fontFamily: "'JetBrains Mono', ui-monospace, monospace" },
  dateWindowRow: {
    gridColumn: '1 / -1',
    display: 'flex', alignItems: 'center', gap: 6,
    paddingTop: 8, marginTop: 4,
    borderTop: '1px solid #2a261d',
  },
  dateWindowLabel: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 9, letterSpacing: '0.22em', color: '#7d7565', textTransform: 'uppercase',
    minWidth: 56,
  },
  dateWindowLink: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase',
    color: '#a8854a', background: 'transparent',
    border: '1px solid #2a261d', padding: '3px 7px', borderRadius: 4,
    textDecoration: 'none', fontWeight: 700,
  },
  userBtn: {
    // PBS 2026-05-09 #33: brighter user-name pill.
    background: 'transparent', border: '1px solid #3a3327', borderRadius: 6,
    color: '#d9bf8e', padding: '5px 12px', cursor: 'pointer',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10,
    letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700,
    display: 'flex', alignItems: 'center', gap: 6,
  },
  avatar: {
    width: 18, height: 18, borderRadius: '50%', background: '#a8854a',
    color: '#0a0a0a', fontSize: 9, fontWeight: 700,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  userMenu: {
    position: 'absolute', right: 0, top: '100%', zIndex: 60,
    marginTop: 6,
    background: '#0f0d0a', border: '1px solid #2a261d', borderRadius: 6,
    padding: 6, minWidth: 200, boxShadow: '0 12px 28px rgba(0,0,0,0.6)',
    pointerEvents: 'auto',
  },
  link: {
    display: 'block', padding: '7px 12px', color: '#f0e5cb',
    textDecoration: 'none', fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', borderRadius: 4,
  },
  menuDivider: { borderTop: '1px solid #2a261d', margin: '4px 0', paddingTop: 4 },
  menuSection: {
    padding: '4px 12px', fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#5a5448',
  },
  langRow: { borderTop: '1px solid #2a261d', marginTop: 4, paddingTop: 6, display: 'flex', justifyContent: 'center', gap: 10 },
  popover: {
    background: '#0f0d0a', border: '1px solid #3a3327', borderRadius: 10,
    padding: 14, minWidth: 320, boxShadow: '0 12px 28px rgba(0,0,0,0.6)',
  },
  popHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  popEyebrow: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#a8854a' },
  popClose: { background: 'transparent', border: 'none', color: '#7d7565', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 },
  popTitle: { fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: 22, color: '#f0e5cb', marginBottom: 12 },
  popGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 },
  popCell: { background: '#15110b', border: '1px solid #2a261d', borderRadius: 6, padding: '8px 10px' },
  popCellK: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 9, letterSpacing: '0.18em', color: '#7d7565', textTransform: 'uppercase' },
  popCellV: { fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: 18, color: '#f0e5cb', marginTop: 2 },
  popCellD: { fontSize: 10, color: '#9b907a', marginTop: 2 },
  popFooter: {
    marginTop: 10, paddingTop: 8, borderTop: '1px solid #1f1c15',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 9, letterSpacing: '0.16em', color: '#5a5448', textAlign: 'right',
  },

  // ── Inbox control-center pill + popover (PBS 2026-05-09 repair #6) ──
  inboxChip: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'transparent', border: '1px solid #3a3327',
    borderRadius: 999, padding: '4px 10px', cursor: 'pointer', color: '#f0e5cb',
    textDecoration: 'none', position: 'relative',
  },
  inboxBubble: {
    minWidth: 16, height: 16, padding: '0 5px', borderRadius: 8,
    background: '#a8854a', color: '#0a0a0a',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    lineHeight: 1, marginLeft: 2,
  },
  inboxPopover: {
    background: '#0f0d0a', border: '1px solid #3a3327', borderRadius: 10,
    padding: 14, width: 380, boxShadow: '0 12px 28px rgba(0,0,0,0.6)',
  },
  inboxSendersHead: {
    marginTop: 14, marginBottom: 6,
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#a8854a',
  },
  inboxSenderList: {
    display: 'flex', flexDirection: 'column', gap: 6,
    maxHeight: 220, overflowY: 'auto',
  },
  inboxSenderRow: {
    background: '#15110b', border: '1px solid #2a261d', borderRadius: 6,
    padding: '8px 10px',
  },
  inboxSenderHead: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8,
  },
  inboxSenderName: {
    fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic',
    fontSize: 14, color: '#f0e5cb',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
  },
  inboxSenderCount: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 10, fontWeight: 700, color: '#a8854a',
    letterSpacing: '0.06em', whiteSpace: 'nowrap',
  },
  inboxSenderMeta: {
    marginTop: 3,
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4,
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 9, color: '#9b907a', letterSpacing: '0.06em',
  },
  inboxSenderDot: { color: '#5a5448' },
  inboxBotTag: {
    marginLeft: 6, padding: '1px 5px',
    background: '#2a261d', color: '#9b907a',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 8, fontWeight: 700, letterSpacing: '0.12em',
    borderRadius: 3, verticalAlign: 'middle',
  },
  inboxEmpty: {
    padding: '10px 0', color: '#7d7565',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 10, letterSpacing: '0.06em',
  },
  inboxFooterRow: {
    marginTop: 12, paddingTop: 10, borderTop: '1px solid #1f1c15',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  inboxFooterLink: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
    color: '#a8854a', background: 'transparent',
    border: '1px solid #2a261d', padding: '5px 10px', borderRadius: 4,
    textDecoration: 'none', fontWeight: 700,
  },
  inboxFooterMuted: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
    color: '#7d7565', textDecoration: 'none',
  },
};
