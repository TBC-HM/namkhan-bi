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

import { useRef, useState } from 'react';

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

export default function HeaderPills({ kpiTiles }: HeaderPillsProps) {
  const [tempOpen, setTempOpen] = useState(false);
  const [airOpen,  setAirOpen]  = useState(false);
  const [dateHover, setDateHover] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [lang, setLang] = useState<'en' | 'th'>('en');

  // One close-timer per pill. mouseEnter on trigger OR popover cancels it.
  const tempTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const airTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
            {/* PBS 2026-05-09 #21: mailbox lives inside the user dropdown,
                styled to the dark standard. */}
            <a href="/inbox"                    onClick={() => setUserOpen(false)} style={S.link}>📬  Inbox</a>
            <a href="/settings/property"        onClick={() => setUserOpen(false)} style={S.link}>Settings (Property)</a>
            <a href="/cockpit/users"             onClick={() => setUserOpen(false)} style={S.link}>Account</a>
            <div style={S.menuDivider}>
              {/* PBS 2026-05-09 #26: settings sub-pages live under cockpit now. */}
              <div style={S.menuSection}>Tools</div>
              <a href="/cockpit"                   onClick={() => setUserOpen(false)} style={S.link}>IT cockpit</a>
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
};
