// app/operations/spa/_shared/BridgeNotice.tsx
// Graceful-degradation notice: shown only if the spa bridge views become
// unreadable. The bridges (v_spa_rooms / v_spa_therapists /
// v_spa_treatment_bookings) were APPLIED 2026-07-30 (migrations
// spa_rooms_and_bridges + spa_booking_functions), so in normal operation
// this never renders — if it does, check DB migrations / grants.

import { TOKENS, MONO } from '@/app/holding/it/cockpit/_components/tokens';

export default function BridgeNotice({ what }: { what: string }) {
  return (
    <div style={{
      border: `1px solid ${TOKENS.brass}`, background: `${TOKENS.brass}18`,
      borderRadius: 6, padding: '14px 16px', fontSize: 13, color: TOKENS.ink, lineHeight: 1.6,
    }}>
      <div style={{ fontFamily: MONO, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: TOKENS.inkSoft, marginBottom: 6 }}>
        Bridge views pending approval
      </div>
      {what} reads <code style={{ fontFamily: MONO }}>public.v_spa_treatment_bookings / v_spa_therapists / v_spa_rooms</code> —
      bridges over the existing (empty) <code style={{ fontFamily: MONO }}>spa.*</code> schema that are proposed, not yet applied.
      Apply <code style={{ fontFamily: MONO }}>db/proposed/build-spa-module/001–002.sql</code> after PBS approval, then this
      surface goes live without a code change. Catalogue (settings) and folio analytics are unaffected and live today.
    </div>
  );
}
