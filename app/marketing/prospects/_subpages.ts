// app/marketing/prospects/_subpages.ts
// Re-export marketing subpages for prospects/* action pages that import
// from '../../_subpages' (two levels up from sequences/<child>).
// Created 2026-07-06 to unblock Vercel build after PR #105 shipped
// pages referencing a non-existent module.
export { MARKETING_SUBPAGES } from '../_subpages';