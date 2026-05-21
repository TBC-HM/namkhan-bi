'use client';

// app/revenue/_components/ReportBuilder.tsx
// Primitives-styled report builder. Ports the legacy DeptEntry modal flow
// (type chooser + dim chips + schedule + email recipients + open report) to
// the new design. Same URL contract as before: opens
// /revenue/reports/render?type=...&<dim>=<value>&... in a new tab.

import { useMemo, useState } from 'react';
import type { ReportTypeDef } from '@/lib/dept-cfg/types';

type Schedule = 'once' | 'daily' | 'weekly' | 'monthly';

const SCHEDULES: Array<{ value: Schedule; label: string }> = [
  { value: 'once', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

interface Props {
  reportTypes: ReportTypeDef[];
  /** Optional override for the open href base (Donna prefix etc.) */
  hrefPrefix?: string;
}

export default function ReportBuilder({ reportTypes, hrefPrefix = '' }: Props) {
  const [reportType, setReportType] = useState<string>('');
  const [dims, setDims] = useState<Record<string, string>>({});
  const [schedule, setSchedule] = useState<Schedule>('once');
  const [emails, setEmails] = useState<string[]>([]);
  const [emailDraft, setEmailDraft] = useState('');

  const def = useMemo(() => reportTypes.find((rt) => rt.value === reportType), [reportType, reportTypes]);

  const allType = reportTypes.find((rt) => rt.value === 'all');
  const stdTypes = reportTypes.filter((rt) => rt.value !== 'all');

  function pickDim(key: string, val: string) {
    setDims((d) => {
      const next = { ...d };
      if (next[key] === val) delete next[key];
      else next[key] = val;
      return next;
    });
  }

  function addEmail(raw: string) {
    const e = raw.trim().toLowerCase();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return;
    setEmails((arr) => (arr.includes(e) ? arr : [...arr, e]));
    setEmailDraft('');
  }

  function reportHref(): string | null {
    if (!def) return null;
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(dims)) if (v) qs.set(k, v);
    if (schedule !== 'once') qs.set('schedule', schedule);
    if (emails.length) qs.set('email', emails.join(','));
    const baseHref = hrefPrefix
      ? def.hrefBase.replace(/^\/revenue\//, hrefPrefix.replace(/\/$/, '') + '/revenue/').replace(/^\/h\/\d+\/revenue\//, hrefPrefix.replace(/\/$/, '') + '/revenue/')
      : def.hrefBase;
    const sep = baseHref.includes('?') ? '&' : '?';
    const query = qs.toString();
    return query ? `${baseHref}${sep}${query}` : baseHref;
  }

  const href = reportHref();
  const dimSummary = def
    ? def.dimGroups.map((g) => `${g.label}=${dims[g.key] ?? '—'}`).join(' · ')
    : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Report type chooser */}
      <div>
        <div style={labelStyle}>Report type</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6 }}>
          {stdTypes.map((rt) => (
            <button
              key={rt.value}
              type="button"
              onClick={() => { setReportType(rt.value); setDims({}); }}
              style={chipStyle(reportType === rt.value)}
            >
              {rt.label}
            </button>
          ))}
        </div>
        {allType && (
          <button
            type="button"
            onClick={() => { setReportType(allType.value); setDims({}); }}
            style={{ ...chipStyle(reportType === allType.value), width: '100%', marginTop: 6 }}
          >
            {allType.label} — full revenue snapshot
          </button>
        )}
      </div>

      {def && (
        <>
          <div style={{ borderTop: '1px solid var(--hairline, #E6DFCC)', paddingTop: 10 }}>
            <div style={hintStyle}>
              Narrow down — these are the dimensions <strong>{def.label}</strong> accepts.
              Click a chip to set, click again to clear (defaults apply).
            </div>
            {def.dimGroups.map((g) => (
              <div key={g.key} style={{ marginTop: 8 }}>
                <div style={labelStyle}>{g.label}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {g.options.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => pickDim(g.key, opt.value)}
                      style={chipStyle(dims[g.key] === opt.value)}
                    >{opt.label}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Schedule */}
          <div style={{ borderTop: '1px solid var(--hairline, #E6DFCC)', paddingTop: 10 }}>
            <div style={labelStyle}>Schedule</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SCHEDULES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSchedule(s.value)}
                  style={chipStyle(schedule === s.value)}
                >{s.label}</button>
              ))}
            </div>
            {schedule !== 'once' && (
              <div style={{ ...hintStyle, marginTop: 6 }}>
                Recurring delivery will land in My Docs · server-side persistence is owed by pair-Claude.
              </div>
            )}
          </div>

          {/* Email recipients */}
          <div style={{ borderTop: '1px solid var(--hairline, #E6DFCC)', paddingTop: 10 }}>
            <div style={labelStyle}>Email delivery <span style={{ fontWeight: 400, color: 'var(--ink-soft, #5A5A5A)' }}>(optional)</span></div>
            {emails.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                {emails.map((e) => (
                  <span key={e} style={emailChipStyle}>
                    ✉ {e}
                    <button
                      type="button"
                      aria-label={`Remove ${e}`}
                      onClick={() => setEmails((arr) => arr.filter((x) => x !== e))}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-soft, #5A5A5A)', padding: 0, fontSize: 12 }}
                    >×</button>
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="email"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addEmail(emailDraft);
                  }
                  if (e.key === 'Backspace' && !emailDraft && emails.length > 0) {
                    setEmails((arr) => arr.slice(0, -1));
                  }
                }}
                placeholder="name@hotel.com — Enter / comma to add"
                style={inputStyle}
              />
              <button type="button" onClick={() => addEmail(emailDraft)} style={addBtnStyle}>Add</button>
            </div>
          </div>

          {/* Open button */}
          <div style={{ borderTop: '1px solid var(--hairline, #E6DFCC)', paddingTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer" style={openBtnStyle}>
                Open report →
              </a>
            ) : (
              <button type="button" disabled style={{ ...openBtnStyle, opacity: 0.4, cursor: 'not-allowed' }}>
                Pick a type
              </button>
            )}
            {def && <span style={{ fontSize: 11, color: 'var(--ink-soft, #5A5A5A)' }}>{dimSummary}</span>}
          </div>
        </>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  fontWeight: 600,
  color: 'var(--ink-soft, #5A5A5A)',
  marginBottom: 6,
};
const hintStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--ink-soft, #5A5A5A)',
  fontStyle: 'italic',
};
function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px',
    borderRadius: 99,
    border: `1px solid ${active ? 'var(--primary, #1F3A2E)' : 'var(--hairline, #E6DFCC)'}`,
    background: active ? 'var(--primary, #1F3A2E)' : 'var(--paper, #FFFFFF)',
    color: active ? '#FFFFFF' : 'var(--ink, #1B1B1B)',
    fontSize: 12,
    fontWeight: active ? 600 : 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };
}
const emailChipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: 'var(--paper, #FFFFFF)',
  border: '1px solid var(--hairline, #E6DFCC)',
  borderRadius: 99,
  padding: '3px 10px',
  fontSize: 11,
};
const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '7px 10px',
  border: '1px solid var(--hairline, #E6DFCC)',
  borderRadius: 4,
  fontSize: 12,
  background: 'var(--paper, #FFFFFF)',
  color: 'var(--ink, #1B1B1B)',
  fontFamily: 'inherit',
};
const addBtnStyle: React.CSSProperties = {
  padding: '7px 14px',
  border: '1px solid var(--hairline, #E6DFCC)',
  borderRadius: 4,
  background: 'var(--paper, #FFFFFF)',
  color: 'var(--ink, #1B1B1B)',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const openBtnStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '10px 18px',
  background: 'var(--primary, #1F3A2E)',
  color: '#FFFFFF',
  border: 'none',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  textDecoration: 'none',
  cursor: 'pointer',
};
