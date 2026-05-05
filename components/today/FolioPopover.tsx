'use client';

// components/today/FolioPopover.tsx
//
// Click target on the In-house table's Spent column. Opens a modal showing
// the full guest folio (every POS line + room charge) for one reservation.
// All data is server-pre-fetched and passed in — no client fetch.

import { useEffect, useState, type CSSProperties } from 'react';

export interface FolioLine {
  transaction_id: string;
  transaction_date: string;
  description: string;
  amount: number;
  usali_dept: string | null;
  usali_subdept: string | null;
  category: string | null;
}

interface Props {
  /** Cloudbeds reservation ID. */
  reservationId: string;
  guestName: string;
  guestCountry?: string | null;
  roomTypeName: string;
  checkIn: string;
  checkOut: string;
  totalFolio: number;
  paid: number;
  balance: number;
  posStay: number;
  posToday: number;
  cbDeepLink: string;
  email: string | null;
  /** Pre-loaded folio lines for this reservation. Sorted desc by date by caller. */
  lines: FolioLine[];
}

export default function FolioPopover(props: Props) {
  const [open, setOpen] = useState(false);

  // Lock body scroll while open + close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const fmtAmt = (n: number) => {
    const abs = Math.abs(n);
    const sign = n < 0 ? '−' : '';
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}k`;
    return `${sign}$${abs.toFixed(2)}`;
  };
  const fmtDateTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
    return d.toLocaleString('en-GB', { year: '2-digit', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const buttonStyle: CSSProperties = {
    background: 'transparent',
    border: 0,
    padding: 0,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--ink)',
    borderBottom: '1px dotted var(--brass)',
    textDecoration: 'none',
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={buttonStyle}
        title="Open folio"
      >
        {props.posStay > 0 ? `$${Math.round(props.posStay).toLocaleString()}` : '—'}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Folio · ${props.guestName}`}
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20, 17, 12, 0.55)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '40px 16px',
            overflowY: 'auto',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--paper-warm)',
              borderRadius: 8,
              border: '1px solid var(--paper-deep)',
              maxWidth: 880,
              width: '100%',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.25)',
              maxHeight: 'calc(100vh - 80px)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--paper-deep)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 16,
            }}>
              <div>
                <div style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 'var(--t-xs)',
                  letterSpacing: 'var(--ls-extra)',
                  textTransform: 'uppercase',
                  color: 'var(--brass)',
                }}>Folio · res {props.reservationId}</div>
                <div style={{
                  fontFamily: 'var(--serif)',
                  fontStyle: 'italic',
                  fontSize: 'var(--t-xl)',
                  lineHeight: 1.15,
                  marginTop: 2,
                }}>
                  {props.guestName}
                  {props.guestCountry ? <span style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-soft)', fontStyle: 'normal', marginLeft: 8 }}>· {props.guestCountry}</span> : null}
                </div>
                <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-soft)', marginTop: 4 }}>
                  {props.roomTypeName} · {props.checkIn} → {props.checkOut}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--paper-deep)',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontFamily: 'var(--mono)',
                  fontSize: 'var(--t-xs)',
                  letterSpacing: 'var(--ls-extra)',
                  textTransform: 'uppercase',
                  color: 'var(--brass)',
                  borderRadius: 4,
                }}
              >Close ✕</button>
            </div>

            {/* Summary strip */}
            <div style={{
              padding: '12px 18px',
              borderBottom: '1px solid var(--paper-deep)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: 12,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {[
                { l: 'Total folio', v: `$${Math.round(props.totalFolio).toLocaleString()}` },
                { l: 'Paid',        v: `$${Math.round(props.paid).toLocaleString()}` },
                { l: 'Balance',     v: `$${Math.round(props.balance).toLocaleString()}`, tone: props.balance > 0 ? 'neg' : 'neutral' },
                { l: 'POS today',   v: `$${Math.round(props.posToday).toLocaleString()}` },
                { l: 'POS stay',    v: `$${Math.round(props.posStay).toLocaleString()}` },
                { l: 'Lines',       v: `${props.lines.length}` },
              ].map((m, i) => (
                <div key={i}>
                  <div style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 'var(--t-xs)',
                    letterSpacing: 'var(--ls-extra)',
                    textTransform: 'uppercase',
                    color: 'var(--brass)',
                  }}>{m.l}</div>
                  <div style={{
                    fontFamily: 'var(--serif)',
                    fontStyle: 'italic',
                    fontSize: 'var(--t-lg)',
                    color: m.tone === 'neg' ? 'var(--bad, #b53a2a)' : 'var(--ink)',
                  }}>{m.v}</div>
                </div>
              ))}
            </div>

            {/* Action row */}
            <div style={{ padding: '8px 18px', borderBottom: '1px solid var(--paper-deep)', display: 'flex', gap: 8, alignItems: 'center', fontSize: 'var(--t-xs)', color: 'var(--ink-soft)' }}>
              <a
                href={props.cbDeepLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 'var(--t-xs)',
                  letterSpacing: 'var(--ls-extra)',
                  textTransform: 'uppercase',
                  color: 'var(--brass)',
                  border: '1px solid var(--brass)',
                  padding: '3px 8px',
                  borderRadius: 4,
                  textDecoration: 'none',
                }}
              >Open in Cloudbeds PMS ↗</a>
              {props.email
                ? <a href={`mailto:${props.email}`} style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)', border: '1px solid var(--paper-deep)', padding: '3px 8px', borderRadius: 4, textDecoration: 'none' }}>Email</a>
                : <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-soft)', opacity: 0.6 }}>email not synced</span>}
              <span style={{ marginLeft: 'auto' }}>Lines below sorted newest → oldest.</span>
            </div>

            {/* Folio lines */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {props.lines.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-soft)', fontStyle: 'italic' }}>
                  No POS lines posted to this reservation yet.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-sm)' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--paper-warm)' }}>
                    <tr>
                      {[
                        { l: 'Date',    a: 'left' as const },
                        { l: 'Item',    a: 'left' as const },
                        { l: 'Dept',    a: 'left' as const },
                        { l: 'Amount',  a: 'right' as const },
                      ].map((c, i) => (
                        <th key={i} style={{
                          textAlign: c.a,
                          padding: '8px 14px',
                          borderBottom: '1px solid var(--paper-deep)',
                          fontFamily: 'var(--mono)',
                          fontSize: 'var(--t-xs)',
                          letterSpacing: 'var(--ls-extra)',
                          textTransform: 'uppercase',
                          color: 'var(--brass)',
                          fontWeight: 500,
                        }}>{c.l}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {props.lines.map((l) => (
                      <tr key={l.transaction_id}>
                        <td style={{ padding: '6px 14px', borderBottom: '1px solid var(--rule, #e3dfd3)', whiteSpace: 'nowrap', color: 'var(--ink-soft)' }}>
                          {fmtDateTime(l.transaction_date)}
                        </td>
                        <td style={{ padding: '6px 14px', borderBottom: '1px solid var(--rule, #e3dfd3)' }}>{l.description}</td>
                        <td style={{ padding: '6px 14px', borderBottom: '1px solid var(--rule, #e3dfd3)', color: 'var(--ink-soft)', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>
                          {l.usali_dept ?? '—'}{l.usali_subdept ? ` · ${l.usali_subdept}` : ''}
                        </td>
                        <td style={{
                          padding: '6px 14px',
                          borderBottom: '1px solid var(--rule, #e3dfd3)',
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          color: l.amount < 0 ? 'var(--bad, #b53a2a)' : 'var(--ink)',
                        }}>{fmtAmt(l.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
