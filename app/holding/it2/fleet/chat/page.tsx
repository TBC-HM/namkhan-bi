// app/holding/it2/fleet/chat/page.tsx
// Central Chat v1 (brief central-chat-v1) — replaces the it-area-reorg shim
// that re-exported the legacy /holding/it/cockpit/chat persona-tab page.
//
// One-channel command law (PBS 2026-07-30): this surface mounts the ONE
// CentralChat component in Second Brain mode. Felix is the sole dispatcher —
// no persona tabs, no direct specialist chat. Owner-class questions surfaced
// in replies deep-link to /holding/it2/questions (Decision Inbox).

import CentralChat from '@/components/chat/CentralChat';
import { TOKENS, SERIF, MONO } from '@/app/holding/it/cockpit/_components/tokens';

export const dynamic = 'force-dynamic';

export default function It2FleetChatPage() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', color: TOKENS.ink, fontFamily: 'var(--sans)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
        <h2 style={{ fontFamily: SERIF, fontSize: 22, margin: 0 }}>
          Central Chat · <em style={{ color: TOKENS.brass }}>Felix</em>
        </h2>
        <div style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3 }}>
          one channel · Second Brain · Felix dispatches to the fleet
        </div>
      </div>
      <CentralChat mode="second-brain" />
    </div>
  );
}
