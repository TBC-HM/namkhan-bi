// app/sales/inquiries/_components/InquiryFeed.tsx
// Block 8 left panel — chronological inbound list, color-tagged by Triager type.
// Mockup-mode: static rows. Live mode (post schema deploy) reads sales.inquiries.

import { ReactNode } from 'react';
import { MaybeOtaBadge } from '@/components/ota/OtaBadge';

type InquiryType =
  | 'FIT'
  | 'Group'
  | 'Wedding'
  | 'Retreat'
  | 'Package'
  | 'B2B/DMC'
  | 'OTA';

interface InquiryRow {
  id: string;
  age: string;            // "12m ago" / "2h ago"
  type: InquiryType;
  source: string;         // "Direct email" / "WhatsApp" / "Booking.com PSM"
  who: string;
  subject: string;
  value: string;          // "$1,840" or "—"
  status: 'New' | 'Auto-drafted' | 'In review' | 'Sent' | 'Stale';
  repeat?: boolean;
  language?: string;
}

const ROWS: InquiryRow[] = [
  {
    id: 'I-2401',
    age: '12m',
    type: 'FIT',
    source: 'Direct email',
    who: 'Smith family · UK',
    subject: '3n river view, 14-Aug, repeat guest, late check-in?',
    value: '$1,840',
    status: 'Auto-drafted',
    repeat: true,
    language: 'EN',
  },
  {
    id: 'I-2400',
    age: '26m',
    type: 'Group',
    source: 'Direct email',
    who: 'Hanoi Architects retreat (12 rooms × 3n)',
    subject: 'Meeting room + farewell dinner 12-Jul → 14-Jul',
    value: '$14,200',
    status: 'Auto-drafted',
    language: 'VN→EN',
  },
  {
    id: 'I-2399',
    age: '48m',
    type: 'B2B/DMC',
    source: 'DMC · Khiri Travel',
    who: 'Khiri Travel · Bangkok',
    subject: '18% off BAR for 16-Sep shoulder series',
    value: '−$2,200 RISK',
    status: 'In review',
    language: 'EN',
  },
  {
    id: 'I-2398',
    age: '1h 12m',
    type: 'Retreat',
    source: 'Website form',
    who: 'Bangkok yoga retreat (8 rooms × 5n)',
    subject: '2 daily classes + 4 dinners + transfers',
    value: '$4,600',
    status: 'Auto-drafted',
    language: 'EN',
  },
  {
    id: 'I-2397',
    age: '2h 4m',
    type: 'Package',
    source: 'Direct email',
    who: 'German honeymoon · 2 pax',
    subject: 'Mekong Honeymoon, 5n, private boat',
    value: '$3,400',
    status: 'Auto-drafted',
    language: 'DE',
  },
  {
    id: 'I-2396',
    age: '3h 8m',
    type: 'Wedding',
    source: 'WhatsApp',
    who: 'Mehta wedding · 24 guests',
    subject: '4n + reception + min-spend?',
    value: '—',
    status: 'New',
    language: 'EN',
  },
  {
    id: 'I-2395',
    age: '6h',
    type: 'OTA',
    source: 'Booking.com PSM',
    who: 'Lee · KR',
    subject: 'Airport pickup + early check-in',
    value: '$0',
    status: 'New',
    language: 'KR→EN',
  },
];

const typeColor: Record<InquiryType, string> = {
  FIT: '#2f6f4a',
  Group: '#6b1f1f',
  Wedding: '#a87024',
  Retreat: '#a17a4f',
  Package: '#1f3d2e',
  'B2B/DMC': '#4a4538',
  OTA: '#8a8170',
};

const statusBg: Record<InquiryRow['status'], string> = {
  New: 'var(--st-warn-bg)',
  'Auto-drafted': 'var(--st-good-bg)',
  'In review': 'var(--paper-warm)',
  Sent: 'var(--paper-warm)',
  Stale: 'var(--st-bad-bg)',
};

export default function InquiryFeed({ overlay }: { overlay?: ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--paper-warm)',
        border: '1px solid #e6dfc9',
        borderRadius: 8,
        marginTop: 14,
      }}
    >
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid #e6dfc9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div
            style={{
              fontSize: "var(--t-sm)",
              color: '#8a8170',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            Live inquiry feed · today
          </div>
          <h3
            style={{
              fontFamily: 'var(--serif)',
              fontSize: "var(--t-xl)",
              fontWeight: 500,
              margin: '2px 0 0',
            }}
          >
            Inbound, <em style={{ color: '#a17a4f' }}>ranked</em> by $ × decay × confidence
          </h3>
        </div>
        <span style={{ fontSize: "var(--t-sm)", color: '#8a8170' }}>
          {ROWS.length} open · last 24h
        </span>
      </div>

      {overlay ? <div style={{ padding: 12 }}>{overlay}</div> : null}

      {ROWS.map((r, i) => (
        <div
          key={r.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '60px 90px 1fr 110px 120px',
            gap: 12,
            padding: '10px 14px',
            borderTop: i === 0 ? 0 : '1px solid #f0e8d0',
            alignItems: 'center',
            fontSize: "var(--t-base)",
          }}
        >
          <span
            style={{
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: "var(--t-sm)",
              color: '#8a8170',
            }}
          >
            {r.age}
          </span>
          <span
            style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: 3,
              background: 'var(--paper-warm)',
              border: `1px solid ${typeColor[r.type]}`,
              color: typeColor[r.type],
              fontSize: "var(--t-xs)",
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 600,
              textAlign: 'center',
            }}
          >
            {r.type}
          </span>
          <div>
            <div style={{ fontWeight: 600, color: '#1c1815' }}>
              {r.who}
              {r.repeat ? (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: "var(--t-xs)",
                    background: '#1f3d2e',
                    color: 'var(--paper-warm)',
                    padding: '1px 5px',
                    borderRadius: 3,
                    letterSpacing: '0.04em',
                  }}
                >
                  REPEAT
                </span>
              ) : null}
              {r.language ? (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: "var(--t-xs)",
                    color: '#8a8170',
                    fontWeight: 400,
                  }}
                >
                  · {r.language}
                </span>
              ) : null}
            </div>
            <div style={{ fontSize: "var(--t-sm)", color: '#4a4538', marginTop: 2 }}>
              {r.subject}
            </div>
            <div style={{ fontSize: "var(--t-xs)", color: '#8a8170', marginTop: 2 }}>
              <MaybeOtaBadge name={r.source} />
            </div>
          </div>
          <span
            style={{
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontWeight: 600,
              color: r.value.startsWith('−') ? 'var(--oxblood)' : '#1c1815',
            }}
          >
            {r.value}
          </span>
          <span
            style={{
              display: 'inline-block',
              padding: '3px 8px',
              borderRadius: 4,
              background: statusBg[r.status],
              border: '1px solid #e6dfc9',
              fontSize: "var(--t-sm)",
              textAlign: 'center',
            }}
          >
            {r.status}
          </span>
        </div>
      ))}
    </div>
  );
}
