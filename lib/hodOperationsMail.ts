// lib/hodOperationsMail.ts
// Small helpers for the Operations HoD Reservations-Operations-Manager mail panel.
// Mirror of lib/hodRevenueMail.ts (Reservations Manager) — reuses the SHARED
// hidden 'HOD-DISMISSED' Gmail label so a mail dismissed on Revenue also stays
// hidden on Operations and vice versa.
//
// PBS 2026-07-14.
import { HOD_DISMISS_LABEL, ensureHodDismissLabelId } from '@/lib/hodRevenueMail';

// Filter address: Reservations Operations Manager. If Gmail returns zero
// messages against this alias PBS may have meant a different one — do NOT
// guess a fallback silently, surface the empty state.
export const ROM_MAIL_FROM = 'rom@thenamkhan.com';
export const ROM_GMAIL_Q = 'from:' + ROM_MAIL_FROM + ' -label:' + HOD_DISMISS_LABEL;

// Re-export the shared dismiss-label helpers so the Ops routes can import
// from a single file. Both queues share the label — dismiss once, hide
// everywhere.
export { HOD_DISMISS_LABEL, ensureHodDismissLabelId };
