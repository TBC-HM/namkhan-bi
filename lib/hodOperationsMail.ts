// lib/hodOperationsMail.ts
// Ops HoD Reservations-Operations-Manager mail panel helpers.
// Mirror of lib/hodRevenueMail.ts — reuses the SHARED hidden HOD-DISMISSED
// Gmail label under the SHARED mailbox account (pb@thenamkhan.com) so a mail
// dismissed on Revenue also stays hidden on Operations.
//
// PBS 2026-07-14 (source-of-truth pivot).
import { HOD_DISMISS_LABEL, ensureHodDismissLabelId } from '@/lib/hodRevenueMail';

export const ROM_MAIL_FROM = 'rom@thenamkhan.com';
export const ROM_GMAIL_Q = 'from:' + ROM_MAIL_FROM + ' -label:' + HOD_DISMISS_LABEL;

export { HOD_DISMISS_LABEL, ensureHodDismissLabelId };
