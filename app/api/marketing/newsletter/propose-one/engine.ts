// app/api/marketing/newsletter/propose-one/engine.ts
// v5.0 (2026-07-26, Newsletter Writer Team v1 · Layer 0) · The writer engine
// MOVED to lib/emailAgents/engine.ts — REUSE-FIRST: one implementation, shared
// by this legacy route, /api/cron/write-pending-drafts, and the newsletter-v2
// routes. This file is a re-export shim so existing importers keep working
// unchanged. Do NOT add logic here.

export {
  proposeOne,
  refreshLiveContext,
  loadPaceState,
  staleSurfaces,
  fallbackPhotoPick,
  DEFAULT_PROPERTY_ID,
  type ProposeBody,
  type PaceState,
  type LiveContext,
} from '@/lib/emailAgents/engine';
