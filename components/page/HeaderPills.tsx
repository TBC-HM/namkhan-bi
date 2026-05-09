'use client';

// components/page/HeaderPills.tsx
// Shared header pills rendered top-right on every <Page>: temperature,
// air/AQI, today's date, user dropdown. Lifted out of DeptEntry so the
// header is consistent across dept-entry pages AND every sub-page (PBS
// 2026-05-09: "the air symbol, temperature, who is logged in is not on
// every page — this header must be consistent throughout").

import { useState } from 'react';

interface HeaderPillsProps {
  /** Optional per-dept KPI tiles shown when the user hovers the date pill. */
  kpiTiles?: Array<{ k: string; v: string; d: string }>;
}

const USER_NAME = 'PBS';

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

  return (
    <>
      {/* TEMP — hover or click opens a 7-day forecast (PBS 2026-05-09 #16). */}
      <div
        style={{ position: 'relative' }}
        onMouseEnter={() => { setTempOpen(true); setAirOpen(false); setUserOpen(false); }}
        onMouseLeave={() => setTempOpen(false)}
      >
        <button
          onClick={() => { setTempOpen(o => !o); setAirOpen(false); setUserOpen(false); }}
          title="Temperature in Luang Prabang · hover for 7-day"
          aria-label="Temperature"
          style={S.chip}
        >
          <span style={{ color: '#c4a06b', fontSize: 12 }}>☀</span>
          <span style={S.chipText}>32°</span>
        </button>
        {tempOpen && (
          <KBPopover onClose={() => setTempOpen(false)}
            eyebrow="Temperature · Luang Prabang"
            title="Next 7 days · °C · rain mm"
            rows={SEVEN_DAY_TEMP}
            footer="preview · Open-Meteo wiring TODO"
          />
        )}
      </div>

      {/* AIR — same hover pattern, 7-day forecast (PBS 2026-05-09 #17). */}
      <div
        style={{ position: 'relative' }}
        onMouseEnter={() => { setAirOpen(true); setTempOpen(false); setUserOpen(false); }}
        onMouseLeave={() => setAirOpen(false)}
      >
        <button
          onClick={() => { setAirOpen(o => !o); setTempOpen(false); setUserOpen(false); }}
          title="Air quality + humidity · hover for 7-day"
          aria-label="Air"
          style={S.chip}
        >
          <span style={{ color: '#c4a06b', fontSize: 12 }}>≈</span>
          <span style={S.chipText}>AQI 42</span>
        </button>
        {airOpen && (
          <KBPopover onClose={() => setAirOpen(false)}
            eyebrow="Air · Luang Prabang"
            title="Next 7 days · AQI · UV · humidity"
            rows={SEVEN_DAY_AIR}
            footer="preview · IQAir wiring TODO"
          />
        )}
      </div>

      {/* DATE (hover → KPI tiles when provided by the dept) */}
      <div
        style={{ position: 'relative' }}
        onMouseEnter={() => setDateHover(true)}
        onMouseLeave={() => setDateHover(false)}
      >
        <span style={S.dateText}>{todayLabel()}</span>
        {dateHover && kpiTiles && kpiTiles.length > 0 && (
          <div style={S.dateGrid}>
            {kpiTiles.map(t => (
              <div key={t.k} style={S.dateCell}>
                <div style={S.dateCellK}>{t.k}</div>
                <div style={S.dateCellV}>{t.v}</div>
                <div style={S.dateCellD}>{t.d}</div>
              </div>
            ))}
            <div style={S.dateFooter}>preview · live wiring TODO</div>
          </div>
        )}
      </div>

      {/* USER */}
      <div style={{ position: 'relative' }}>
        <button onClick={() => setUserOpen(o => !o)} style={S.userBtn}>
          <span style={S.avatar}>{(USER_NAME[0] ?? '?').toUpperCase()}</span>
          {USER_NAME} ▾
        </button>
        {userOpen && (
          <div style={S.userMenu}>
            <a href="/settings/property"        onClick={() => setUserOpen(false)} style={S.link}>Settings</a>
            <a href="/settings/email-categories" onClick={() => setUserOpen(false)} style={S.link}>Email</a>
            <a href="/cockpit/users"             onClick={() => setUserOpen(false)} style={S.link}>Account</a>
            <div style={S.menuDivider}>
              <div style={S.menuSection}>Tools</div>
              <a href="/cockpit"               onClick={() => setUserOpen(false)} style={S.link}>IT cockpit</a>
              <a href="/knowledge"             onClick={() => setUserOpen(false)} style={S.link}>Knowledge</a>
              <a href="/front-office/arrivals" onClick={() => setUserOpen(false)} style={S.link}>Front office</a>
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
  chip: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'transparent', border: '1px solid #2a261d',
    borderRadius: 999, padding: '4px 10px', cursor: 'pointer', color: '#9b907a',
  },
  chipText: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11 },
  dateText: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
    color: '#9b907a', cursor: 'help',
  },
  dateGrid: {
    position: 'absolute', top: 26, right: 0, zIndex: 60,
    background: '#0f0d0a', border: '1px solid #3a3327', borderRadius: 8,
    padding: 12, minWidth: 360, boxShadow: '0 12px 28px rgba(0,0,0,0.6)',
    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8,
  },
  dateCell: { background: '#15110b', border: '1px solid #2a261d', borderRadius: 6, padding: '8px 10px' },
  dateCellK: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 9, letterSpacing: '0.22em', color: '#7d7565', textTransform: 'uppercase' },
  dateCellV: { fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: 22, color: '#d8cca8', marginTop: 2 },
  dateCellD: { fontSize: 10, color: '#9b907a', marginTop: 2 },
  dateFooter: { gridColumn: '1 / -1', fontSize: 10, color: '#5a5448', textAlign: 'right', fontFamily: "'JetBrains Mono', ui-monospace, monospace" },
  userBtn: {
    background: 'transparent', border: '1px solid #2a261d', borderRadius: 6,
    color: '#c4a06b', padding: '5px 12px', cursor: 'pointer',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10,
    letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 500,
    display: 'flex', alignItems: 'center', gap: 6,
  },
  avatar: {
    width: 18, height: 18, borderRadius: '50%', background: '#a8854a',
    color: '#0a0a0a', fontSize: 9, fontWeight: 700,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  userMenu: {
    position: 'absolute', right: 0, top: 36, zIndex: 60,
    background: '#0f0d0a', border: '1px solid #2a261d', borderRadius: 6,
    padding: 6, minWidth: 200, boxShadow: '0 12px 28px rgba(0,0,0,0.6)',
  },
  link: {
    display: 'block', padding: '7px 12px', color: '#d8cca8',
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
    position: 'absolute', top: 32, right: 0, zIndex: 60,
    background: '#0f0d0a', border: '1px solid #3a3327', borderRadius: 10,
    padding: 14, minWidth: 320, boxShadow: '0 12px 28px rgba(0,0,0,0.6)',
  },
  popHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  popEyebrow: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#a8854a' },
  popClose: { background: 'transparent', border: 'none', color: '#7d7565', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 },
  popTitle: { fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: 22, color: '#d8cca8', marginBottom: 12 },
  popGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 },
  popCell: { background: '#15110b', border: '1px solid #2a261d', borderRadius: 6, padding: '8px 10px' },
  popCellK: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 9, letterSpacing: '0.18em', color: '#7d7565', textTransform: 'uppercase' },
  popCellV: { fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: 18, color: '#d8cca8', marginTop: 2 },
  popCellD: { fontSize: 10, color: '#9b907a', marginTop: 2 },
  popFooter: {
    marginTop: 10, paddingTop: 8, borderTop: '1px solid #1f1c15',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 9, letterSpacing: '0.16em', color: '#5a5448', textAlign: 'right',
  },
};
