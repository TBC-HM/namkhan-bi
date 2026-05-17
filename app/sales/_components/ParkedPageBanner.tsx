// app/sales/_components/ParkedPageBanner.tsx
//
// PBS 2026-05-16: Yellow banner shown at the top of pages that were removed
// from the sales submenu during the 4-page collapse but kept reachable until
// PBS confirms deletion. Provides a CTA to the new unified destination.

import Link from 'next/link';

interface Props {
  /** Old page name (e.g. "Inquiries"). */
  oldName: string;
  /** Suggested replacement URL (e.g. "/sales/leads?origin=inquiry"). */
  goToHref: string;
  /** Replacement label shown in the CTA (e.g. "Pipeline · Inquiry origin filter"). */
  goToLabel: string;
}

export default function ParkedPageBanner({ oldName, goToHref, goToLabel }: Props) {
  return (
    <div style={{
      background: 'rgba(194, 143, 44, 0.10)',
      border: '1px solid var(--st-warn, #C28F2C)',
      borderLeft: '3px solid var(--st-warn, #C28F2C)',
      borderRadius: 4,
      padding: '10px 14px',
      marginBottom: 18,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 14,
      flexWrap: 'wrap',
    }}>
      <div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--st-warn, #C28F2C)', fontWeight: 600 }}>
          Parked · pending deletion
        </div>
        <div style={{ marginTop: 2, fontSize: 'var(--t-sm)', color: 'var(--ink, #1A1A1A)' }}>
          <strong>{oldName}</strong> was removed from the sales submenu — the canonical workflow is now the unified Pipeline + Accounts. This page is kept live for review until PBS confirms deletion.
        </div>
      </div>
      <Link
        href={goToHref}
        style={{
          background: 'var(--brass, #a8854a)',
          color: 'var(--surf-0, #0a0a0a)',
          padding: '6px 14px',
          borderRadius: 3,
          fontFamily: 'var(--mono)',
          fontSize: 'var(--t-xs)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          fontWeight: 600,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >→ {goToLabel}</Link>
    </div>
  );
}
