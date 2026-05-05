// app/guest/_components/Reachable.tsx
//
// Reusable Reachable block — shows the % of guests reachable by email,
// phone, and WhatsApp (= phone with country-code prefix). Real numbers
// only — counts come from a server-fetched profile slice.
//
// Drop into any guest/marketing page that needs a contact-coverage view.

import { cardWrap, cardTitle, cardSub } from './GuestShell';

export interface ReachableProps {
  /** Total guest profiles in scope (denominator). */
  total: number;
  /** Guests with a non-empty email column. */
  withEmail: number;
  /** Guests with a non-empty phone column. */
  withPhone: number;
  /**
   * Guests whose phone looks WhatsApp-routable (starts with `+` and ≥ 8
   * digits — every plausible international format). Real heuristic, no
   * separate WhatsApp consent table yet.
   */
  withWhatsapp: number;
  title?: string;
  sub?: string;
}

export default function Reachable({
  total,
  withEmail,
  withPhone,
  withWhatsapp,
  title = 'Reachable',
  sub = 'Email · phone · WhatsApp coverage of profiles in scope',
}: ReachableProps) {
  if (total === 0) {
    return (
      <div style={cardWrap}>
        <div style={cardTitle}>{title}</div>
        <div style={cardSub}>{sub}</div>
        <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: 'var(--t-sm)' }}>
          No profiles in scope
        </div>
      </div>
    );
  }

  const channels = [
    { label: 'Email',    n: withEmail,    color: 'var(--moss)' },
    { label: 'Phone',    n: withPhone,    color: 'var(--brass)' },
    { label: 'WhatsApp', n: withWhatsapp, color: 'var(--brass-soft)' },
  ];
  const w = 320, h = 200, barH = 22, padL = 4, padR = 78;
  const barMaxW = w - padL - padR;

  return (
    <div style={cardWrap}>
      <div style={cardTitle}>{title}</div>
      <div style={cardSub}>{sub}</div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 200 }}>
        {channels.map((c, i) => {
          const pct = total > 0 ? (c.n / total) * 100 : 0;
          const y = 32 + i * (barH + 22);
          const wPx = (pct / 100) * barMaxW;
          return (
            <g key={c.label}>
              <text x={padL + 4} y={y - 4} style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--ink)' }}>
                {c.label}
              </text>
              <rect x={padL} y={y} width={barMaxW} height={barH} fill="var(--paper-deep)" />
              <rect x={padL} y={y} width={wPx} height={barH} fill={c.color}>
                <title>{`${c.label} · ${c.n} of ${total} · ${pct.toFixed(0)}%`}</title>
              </rect>
              <text x={w - padR + 4} y={y + barH / 2 + 4} style={{ fontFamily: 'var(--mono)', fontSize: 11, fill: 'var(--ink)', fontWeight: 600 }}>
                {pct.toFixed(0)}%
              </text>
              <text x={w - padR + 4} y={y + barH + 12} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>
                {c.n.toLocaleString()} of {total.toLocaleString()}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Server helper — counts the 3 channels off any profile rows array. */
export function countReachable(rows: { email: string | null; phone: string | null }[]): {
  total: number;
  withEmail: number;
  withPhone: number;
  withWhatsapp: number;
} {
  let withEmail = 0, withPhone = 0, withWhatsapp = 0;
  for (const r of rows) {
    if (r.email && r.email.includes('@') && r.email.length > 4) withEmail += 1;
    if (r.phone && /\d/.test(r.phone)) withPhone += 1;
    // WhatsApp-routable heuristic: starts with + and has ≥ 8 digits.
    if (r.phone && /^\+\d{8,}$/.test((r.phone || '').replace(/[\s\-()]/g, ''))) {
      withWhatsapp += 1;
    }
  }
  return { total: rows.length, withEmail, withPhone, withWhatsapp };
}
