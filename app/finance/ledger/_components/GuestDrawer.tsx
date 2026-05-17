'use client';

// app/finance/ledger/_components/GuestDrawer.tsx
//
// Slides in from the right when a guest row is clicked in the aged-AR table
// (or a name is clicked in the city ledger). Surfaces email + phone + two
// controller actions: "Send reminder" (mailto guest) and "Verify" (mailto
// fc@thenamkhan.com — finance compliance). PBS-locked 2026-05-15.

import { useEffect } from 'react';
import { fmtMoney } from '@/lib/format';
import CloudbedsReservationLink from '@/components/cloudbeds/CloudbedsReservationLink';

export interface GuestSubject {
  kind: 'guest' | 'house_account';
  display_name: string;
  reservation_id?: string | null;
  guest_email?: string | null;
  guest_phone?: string | null;
  source_name?: string | null;
  check_in_date?: string | null;
  check_out_date?: string | null;
  open_balance?: number | null;
  days_overdue?: number | null;
  bucket?: string | null;
  // House-account variant
  account_id?: string | null;
  account_type?: string | null;
}

interface Props {
  subject: GuestSubject | null;
  onClose: () => void;
}

const FC_EMAIL = 'fc@thenamkhan.com';

function buildReminderMailto(s: GuestSubject): string {
  const to = encodeURIComponent(s.guest_email ?? '');
  const subject = encodeURIComponent(
    `Outstanding balance — The Namkhan · reservation ${s.reservation_id ?? ''}`,
  );
  const body = encodeURIComponent(
    [
      `Dear ${s.display_name},`,
      '',
      `Our records show an outstanding balance of ${fmtMoney(Number(s.open_balance ?? 0), 'USD')} on your stay${
        s.check_out_date ? ` ending ${s.check_out_date}` : ''
      }.`,
      '',
      `Could you settle this at your earliest convenience? If you believe this is an error, please reply and we will investigate immediately.`,
      '',
      `Reservation #: ${s.reservation_id ?? '—'}`,
      `Balance: ${fmtMoney(Number(s.open_balance ?? 0), 'USD')}`,
      `Days overdue: ${s.days_overdue ?? '—'}`,
      '',
      `Kind regards,`,
      `The Namkhan · Finance`,
    ].join('\n'),
  );
  return `mailto:${to}?subject=${subject}&body=${body}`;
}

function buildVerifyMailto(s: GuestSubject): string {
  const to = encodeURIComponent(FC_EMAIL);
  const subject = encodeURIComponent(
    `[VERIFY] ${s.display_name} · balance ${fmtMoney(Number(s.open_balance ?? 0), 'USD')} · ${s.reservation_id ?? s.account_id ?? ''}`,
  );
  const body = encodeURIComponent(
    [
      `Please verify the following ledger entry before action:`,
      '',
      `Guest / account: ${s.display_name}`,
      `Reservation #:   ${s.reservation_id ?? '—'}`,
      `Account ID:      ${s.account_id ?? '—'}`,
      `Source:          ${s.source_name ?? '—'}`,
      `Check-in:        ${s.check_in_date ?? '—'}`,
      `Check-out:       ${s.check_out_date ?? '—'}`,
      `Balance:         ${fmtMoney(Number(s.open_balance ?? 0), 'USD')}`,
      `Days overdue:    ${s.days_overdue ?? '—'}`,
      `Bucket:          ${s.bucket ?? '—'}`,
      `Email:           ${s.guest_email ?? '—'}`,
      `Phone:           ${s.guest_phone ?? '—'}`,
      '',
      `Confirm whether the balance is genuine and whether we should pursue collection.`,
      '',
      `— Finance · The Namkhan`,
    ].join('\n'),
  );
  return `mailto:${to}?subject=${subject}&body=${body}`;
}

export default function GuestDrawer({ subject, onClose }: Props) {
  // Close on ESC
  useEffect(() => {
    if (!subject) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [subject, onClose]);

  if (!subject) return null;
  const canEmail = Boolean(subject.guest_email);
  const reminderHref = canEmail ? buildReminderMailto(subject) : '';
  const verifyHref   = buildVerifyMailto(subject);

  return (
    <>
      {/* Scrim */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.35)',
          zIndex: 50,
        }}
      />
      {/* Drawer */}
      <aside
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(460px, 92vw)',
          background: 'var(--paper-warm)',
          borderLeft: '1px solid var(--paper-deep)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.18)',
          zIndex: 51,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--paper-deep)',
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10,
        }}>
          <div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
              letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
              color: 'var(--brass)', fontWeight: 700,
            }}>
              {subject.kind === 'guest' ? 'AR · Guest drawer' : 'City ledger · Account drawer'}
            </div>
            <h3 style={{ margin: '4px 0 0', fontFamily: 'var(--serif)', fontSize: 'var(--t-lg)', fontWeight: 500, color: 'var(--ink)' }}>
              {subject.display_name}
            </h3>
            {subject.source_name && (
              <div style={{ marginTop: 2, fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', fontFamily: 'var(--mono)' }}>
                {subject.source_name}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: 22, lineHeight: 1, color: 'var(--ink-mute)',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: 18, overflowY: 'auto', flex: 1 }}>
          {/* Balance + dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <KV label="Balance" value={fmtMoney(Number(subject.open_balance ?? 0), 'USD')} highlight />
            <KV label="Days overdue" value={subject.days_overdue == null ? '—' : `${subject.days_overdue}`} />
            <KV label="Check-in"  value={subject.check_in_date ?? '—'} />
            <KV label="Check-out" value={subject.check_out_date ?? '—'} />
            <div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
                Reservation
              </div>
              <div style={{ fontSize: 'var(--t-sm)', fontFamily: 'var(--mono)', marginTop: 2 }}>
                {subject.reservation_id
                  ? <CloudbedsReservationLink reservationId={subject.reservation_id} variant="inline" />
                  : (subject.account_id ?? '—')}
              </div>
            </div>
            <KV label="Bucket" value={subject.bucket ?? '—'} />
          </div>

          {/* Contact info */}
          <div style={{
            padding: '10px 12px', marginBottom: 16,
            background: 'var(--paper)', border: '1px solid var(--paper-deep)',
            borderRadius: 6,
          }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 6 }}>
              Contact
            </div>
            <div style={{ display: 'grid', gap: 4, fontSize: 'var(--t-sm)' }}>
              <div>
                <span style={{ color: 'var(--ink-mute)' }}>email · </span>
                {subject.guest_email
                  ? <a href={`mailto:${subject.guest_email}`} style={{ color: 'var(--brass)' }}>{subject.guest_email}</a>
                  : <span style={{ color: 'var(--ink-mute)', fontStyle: 'italic' }}>missing — fix in PMS</span>}
              </div>
              <div>
                <span style={{ color: 'var(--ink-mute)' }}>phone · </span>
                {subject.guest_phone
                  ? <a href={`tel:${subject.guest_phone}`} style={{ color: 'var(--brass)' }}>{subject.guest_phone}</a>
                  : <span style={{ color: 'var(--ink-mute)', fontStyle: 'italic' }}>missing</span>}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {canEmail ? (
              <a
                href={reminderHref}
                style={actionBtn('brass')}
              >
                ✉ Send reminder · to {subject.guest_email}
              </a>
            ) : (
              <button disabled style={{ ...actionBtn('disabled'), cursor: 'not-allowed' }}>
                ✉ Send reminder · no email on file
              </button>
            )}
            <a
              href={verifyHref}
              style={actionBtn('moss')}
            >
              🔎 Verify · email to {FC_EMAIL}
            </a>
            <div style={{ marginTop: 4, fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
              Opens your default mail client with the message pre-filled.
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function KV({ label, value, highlight, mono }: { label: string; value: string; highlight?: boolean; mono?: boolean }) {
  return (
    <div>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
        letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
        color: 'var(--ink-mute)',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: highlight ? 'var(--t-md)' : 'var(--t-sm)',
        fontWeight: highlight ? 600 : 400,
        fontFamily: mono ? 'var(--mono)' : 'inherit',
        color: highlight ? 'var(--brass)' : 'var(--ink)',
        marginTop: 2,
      }}>
        {value}
      </div>
    </div>
  );
}

function actionBtn(tone: 'brass' | 'moss' | 'disabled'): React.CSSProperties {
  const bg = tone === 'brass' ? 'var(--brass)'
           : tone === 'moss'  ? 'var(--moss, #2D6A4F)'
           : 'var(--paper-deep)';
  const fg = tone === 'disabled' ? 'var(--ink-mute)' : '#FFF';
  return {
    display: 'block',
    padding: '10px 14px',
    fontFamily: 'var(--mono)',
    fontSize: 'var(--t-sm)',
    letterSpacing: 'var(--ls-extra)',
    textTransform: 'uppercase',
    textDecoration: 'none',
    textAlign: 'center',
    background: bg,
    color: fg,
    border: 'none',
    borderRadius: 4,
    fontWeight: 700,
    cursor: 'pointer',
  };
}
