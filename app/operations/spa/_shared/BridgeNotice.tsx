// app/operations/spa/_shared/BridgeNotice.tsx
// Shown while the proposed spa.* bridge views are not yet applied.
// Audit-first law: the operational schema exists (spa.treatment_bookings,
// spa.therapists — 0 rows) but has no public.v_* bridges. No DDL is applied
// by the build agent; SQL awaits approval in db/proposed/build-spa-module/.

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
