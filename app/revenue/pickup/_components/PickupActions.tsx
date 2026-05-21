'use client';

// app/revenue/pickup/_components/PickupActions.tsx
// Send + Print actions for the Pickup matrix page header. Print uses the
// browser print dialog (the parent page ships a print-stylesheet so the
// matrix renders ink-on-paper). Send opens a mailto with a short pre-built
// subject + body — keeps the flow simple until a server-side report mailer
// lands.

export default function PickupActions({ property, asOfDate }: { property: string; asOfDate: string }) {
  function doPrint() { window.print(); }
  function doSend() {
    const subject = encodeURIComponent(`Pickup matrix · ${property} · ${asOfDate}`);
    const body = encodeURIComponent(
      `Pickup matrix for ${property} as of ${asOfDate}.\n\n` +
      `Live link: ${typeof window !== 'undefined' ? window.location.href : ''}\n\n` +
      `Sent from namkhan-bi cockpit.`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }
  return (
    <div style={{ display: 'flex', gap: 6 }} className="no-print">
      <button type="button" onClick={doSend} style={btnStyle}>✉ Send</button>
      <button type="button" onClick={doPrint} style={btnStylePrimary}>🖨 Print</button>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 4,
  border: '1px solid var(--hairline, #E6DFCC)',
  background: 'var(--paper, #FFFFFF)',
  color: 'var(--ink, #1B1B1B)',
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: '0.04em',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const btnStylePrimary: React.CSSProperties = {
  ...btnStyle,
  background: 'var(--primary, #1F3A2E)',
  color: '#FFFFFF',
  border: '1px solid var(--primary, #1F3A2E)',
};
