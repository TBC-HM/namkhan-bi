'use client';

// app/revenue/_components/ReportBuilder.tsx
// PBS 2026-07-08 full rewrite: compact single-row primitive.
// Keeps: type chooser · Schedule · Email delivery · Open report.
// Drops: Dimensions chip block (defaults apply via search params anyway).
// Header shows Window=— · Compare=— placeholder so a manager knows the report
// will apply the default window.

import { useMemo, useState, type CSSProperties } from 'react';
import type { ReportTypeDef } from '@/lib/dept-cfg/types';

type Schedule = 'once' | 'daily' | 'weekly' | 'monthly';

const SCHEDULES: Array<{ value: Schedule; label: string }> = [
  { value: 'once',    label: 'Once' },
  { value: 'daily',   label: 'Daily' },
  { value: 'weekly',  label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

interface Props {
  reportTypes: ReportTypeDef[];
  hrefPrefix?: string;
}

// PBS 2026-07-08: expose the 3 scheduled reports (Daily / Weekly / Monthly) as
// first-class options alongside whatever the department config supplies.
const BUILTIN_REPORTS: ReportTypeDef[] = [
  { value: 'scheduled-daily',   label: 'Daily (scheduled)',   hrefBase: '/revenue/reports/scheduled/daily/preview',   dimGroups: [] },
  { value: 'scheduled-weekly',  label: 'Weekly (scheduled)',  hrefBase: '/revenue/reports/scheduled/weekly/preview',  dimGroups: [] },
  { value: 'scheduled-monthly', label: 'Monthly (scheduled)', hrefBase: '/revenue/reports/scheduled/monthly/preview', dimGroups: [] },
] as unknown as ReportTypeDef[];

export default function ReportBuilder({ reportTypes, hrefPrefix = '' }: Props) {
  const allReports = useMemo(() => [...BUILTIN_REPORTS, ...reportTypes], [reportTypes]);
  const [reportType, setReportType] = useState<string>(allReports[0]?.value ?? '');
  const [schedule, setSchedule] = useState<Schedule>('once');
  const [emails, setEmails] = useState<string[]>([]);
  const [emailDraft, setEmailDraft] = useState('');

  const def = useMemo(() => allReports.find((rt) => rt.value === reportType), [reportType, allReports]);

  function addEmail(raw: string) {
    const e = raw.trim().toLowerCase();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return;
    setEmails((arr) => (arr.includes(e) ? arr : [...arr, e]));
    setEmailDraft('');
  }
  function removeEmail(email: string) { setEmails((arr) => arr.filter((x) => x !== email)); }

  function reportHref(): string | null {
    if (!def) return null;
    const qs = new URLSearchParams();
    if (schedule !== 'once')    qs.set('schedule', schedule);
    if (emails.length)          qs.set('email', emails.join(','));
    const baseHref = hrefPrefix
      ? def.hrefBase.replace(/^\/revenue\//, hrefPrefix.replace(/\/$/, '') + '/revenue/')
                    .replace(/^\/h\/\d+\/revenue\//, hrefPrefix.replace(/\/$/, '') + '/revenue/')
      : def.hrefBase;
    const sep = baseHref.includes('?') ? '&' : '?';
    const q   = qs.toString();
    return q ? `${baseHref}${sep}${q}` : baseHref;
  }
  const href = reportHref();

  return (
    <div style={rootStyle}>
      <div style={rowStyle}>
        <label style={labelInlineStyle}>Report</label>
        <select value={reportType} onChange={(e) => setReportType(e.target.value)} style={selectStyle}>
          {allReports.map((rt) => (
            <option key={rt.value} value={rt.value}>{rt.label}</option>
          ))}
        </select>

        <span style={dividerStyle} />

        <label style={labelInlineStyle}>Schedule</label>
        <div style={chipRowStyle}>
          {SCHEDULES.map((s) => (
            <button key={s.value} type="button" onClick={() => setSchedule(s.value)}
                    style={chipStyle(schedule === s.value)}>
              {s.label}
            </button>
          ))}
        </div>

        <span style={dividerStyle} />

        <label style={labelInlineStyle}>Email</label>
        <div style={emailWrapStyle}>
          {emails.map((e) => (
            <span key={e} style={emailChipStyle}>
              {e}<button type="button" onClick={() => removeEmail(e)} style={xBtnStyle} aria-label={`remove ${e}`}>×</button>
            </span>
          ))}
          <input
            type="email" value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addEmail(emailDraft); } }}
            placeholder="name@hotel.com — Enter or , to add"
            style={inputStyle} aria-label="email address"
          />
          <button type="button" onClick={() => addEmail(emailDraft)} disabled={!emailDraft.trim()} style={secondaryBtnStyle}>Add</button>
        </div>

        <span style={dividerStyle} />

        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" style={primaryBtnStyle}>Open report →</a>
        ) : (
          <span style={{ ...primaryBtnStyle, opacity: 0.4, cursor: 'not-allowed' }}>Open report →</span>
        )}
      </div>

      <div style={hintStyle}>
        Window=— · Compare=— · defaults apply from URL
      </div>
    </div>
  );
}

// ─── Styles: compact single-row primitive ─────────────────────────

const rootStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };
const rowStyle: CSSProperties = {
  display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
  padding: '8px 10px', background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 6,
};
const labelInlineStyle: CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: '#5A5A5A',
};
const selectStyle: CSSProperties = {
  padding: '4px 8px', border: '1px solid #E6DFCC', borderRadius: 4,
  fontSize: 12, background: '#FFFFFF', color: '#1B1B1B', fontFamily: 'inherit', minWidth: 140,
};
const chipRowStyle: CSSProperties = { display: 'flex', gap: 4 };
function chipStyle(active: boolean): CSSProperties {
  return {
    padding: '4px 10px', border: `1px solid ${active ? '#084838' : '#E6DFCC'}`,
    background: active ? '#084838' : '#FFFFFF', color: active ? '#FFFFFF' : '#5A5A5A',
    borderRadius: 4, fontSize: 11, fontWeight: active ? 700 : 500, cursor: 'pointer',
    fontFamily: 'inherit',
  };
}
const emailWrapStyle: CSSProperties = { display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' };
const emailChipStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '2px 4px 2px 8px', background: '#FAFAF7', border: '1px solid #E6DFCC',
  borderRadius: 12, fontSize: 11, color: '#1B1B1B',
};
const xBtnStyle: CSSProperties = {
  padding: '0 4px', border: 'none', background: 'transparent',
  color: '#5A5A5A', cursor: 'pointer', fontSize: 14, lineHeight: 1,
};
const inputStyle: CSSProperties = {
  padding: '4px 8px', border: '1px solid #E6DFCC', borderRadius: 4,
  fontSize: 12, background: '#FFFFFF', color: '#1B1B1B', minWidth: 220, fontFamily: 'inherit',
};
const secondaryBtnStyle: CSSProperties = {
  padding: '4px 10px', border: '1px solid #E6DFCC', background: '#FFFFFF', color: '#1B1B1B',
  borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};
const primaryBtnStyle: CSSProperties = {
  padding: '6px 14px', border: '1px solid #084838', background: '#084838', color: '#FFFFFF',
  borderRadius: 4, fontSize: 12, fontWeight: 700, textDecoration: 'none',
  fontFamily: 'inherit', letterSpacing: '0.04em',
};
const dividerStyle: CSSProperties = { width: 1, height: 20, background: '#E6DFCC' };
const hintStyle: CSSProperties = {
  fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: '#5A5A5A', paddingLeft: 10,
};
