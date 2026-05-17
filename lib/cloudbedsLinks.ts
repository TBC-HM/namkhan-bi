// lib/cloudbedsLinks.ts
//
// Global rule (PBS-locked 2026-05-15): every reservation ID rendered
// anywhere in the application is a direct link to the Cloudbeds dashboard
// reservation drawer for that property.
//
// URL format:  https://hotels.cloudbeds.com/connect/<propertyId>#/reservations/<reservationId>
//
// Use the `<CloudbedsReservationLink>` component (in cloudbedsLinks.tsx)
// wherever a reservation ID would otherwise be plain text.

export const CLOUDBEDS_BASE = 'https://hotels.cloudbeds.com/connect';

export function cloudbedsReservationUrl(propertyId: number | string, reservationId: string | number | null | undefined): string | null {
  if (reservationId == null || reservationId === '') return null;
  const pid = Number(propertyId);
  if (!Number.isFinite(pid) || pid <= 0) return null;
  return `${CLOUDBEDS_BASE}/${pid}#/reservations/${String(reservationId).trim()}`;
}
