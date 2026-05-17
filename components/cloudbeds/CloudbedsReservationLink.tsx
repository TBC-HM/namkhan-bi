// components/cloudbeds/CloudbedsReservationLink.tsx
//
// Canonical reservation-id renderer. Always emits an external <a> link
// to the Cloudbeds dashboard reservation drawer for the given property.
//
// Default property = Namkhan (260955). Pass `propertyId` for Donna or
// future properties. PBS rule 2026-05-15: every reservation ID in the
// app must use this component — never raw text.

import { cloudbedsReservationUrl } from '@/lib/cloudbedsLinks';

interface Props {
  reservationId: string | number | null | undefined;
  propertyId?: number | string;
  /** Truncate display to last N chars (handy in tight columns). */
  truncate?: number;
  /** Render style. 'mono' = monospace small (table cells). 'inline' = inherit text. */
  variant?: 'mono' | 'inline';
}

export default function CloudbedsReservationLink({
  reservationId,
  propertyId = 260955,
  truncate,
  variant = 'mono',
}: Props) {
  if (reservationId == null || reservationId === '') return <span>—</span>;
  const id = String(reservationId).trim();
  const url = cloudbedsReservationUrl(propertyId, id);
  const display = truncate && id.length > truncate ? `…${id.slice(-truncate)}` : id;
  const style: React.CSSProperties = variant === 'mono'
    ? { fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--brass)', textDecoration: 'underline' }
    : { color: 'var(--brass)', textDecoration: 'underline' };

  if (!url) return <span style={style}>{display}</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer noopener" style={style} title={`Open ${id} in PMS dashboard`}>
      {display}
    </a>
  );
}
