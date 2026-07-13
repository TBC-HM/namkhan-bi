// lib/hodRevenueMail.ts
// Small helpers for the Revenue HoD Reservations-Manager mail panel.
// Kept separate from lib/userGmail.ts (per PBS: only ADD helpers to userGmail,
// so we live outside of it entirely).
//
// PBS 2026-07-14.
import { listLabels, refreshIfExpired } from '@/lib/userGmail';

export const HOD_DISMISS_LABEL = 'HOD-DISMISSED';
export const RM_MAIL_FROM = 'rm@thenamkhan.com';
export const RM_GMAIL_Q = 'from:' + RM_MAIL_FROM + ' -label:' + HOD_DISMISS_LABEL;

// Idempotent — creates the hidden HOD-DISMISSED label if it does not exist,
// returns the Gmail label ID.
export async function ensureHodDismissLabelId(userId: string): Promise<string> {
  const labels = await listLabels(userId);
  const found = labels.find((l) => l.name === HOD_DISMISS_LABEL);
  if (found) return found.id;
  const { access } = await refreshIfExpired(userId);
  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + access, 'content-type': 'application/json' },
    body: JSON.stringify({ name: HOD_DISMISS_LABEL, labelListVisibility: 'labelHide', messageListVisibility: 'hide' }),
  });
  if (!r.ok) throw new Error('hod_dismiss_label_create_failed_' + r.status + '_' + (await r.text()).slice(0, 200));
  const j = (await r.json()) as { id: string };
  return j.id;
}
