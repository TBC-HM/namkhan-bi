// lib/hodRevenueMail.ts
// Small helpers for the Revenue HoD Reservations-Manager mail panel.
//
// PBS 2026-07-14 (source-of-truth pivot): now runs against the SHARED
// mailbox token (pb@thenamkhan.com) via lib/sharedGmail, not the
// currently-signed-in user's token. The signed-in user must still be
// authenticated at the route layer.

import { getSharedGmailAccessToken } from '@/lib/sharedGmail';

export const HOD_DISMISS_LABEL = 'HOD-DISMISSED';
export const RM_MAIL_FROM = 'rm@thenamkhan.com';
export const RM_GMAIL_Q = 'from:' + RM_MAIL_FROM + ' -label:' + HOD_DISMISS_LABEL;

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';

/**
 * Idempotent — creates the hidden HOD-DISMISSED label if it does not exist
 * on the SHARED account. Returns the Gmail label ID.
 */
export async function ensureHodDismissLabelId(): Promise<string> {
  const { access } = await getSharedGmailAccessToken();
  const listR = await fetch(GMAIL_API + '/users/me/labels', {
    headers: { authorization: 'Bearer ' + access },
  });
  if (!listR.ok) throw new Error('gmail_labels_list_failed_' + listR.status);
  const listJ = (await listR.json()) as { labels?: Array<{ id: string; name: string }> };
  const found = (listJ.labels ?? []).find((l) => l.name === HOD_DISMISS_LABEL);
  if (found) return found.id;
  const r = await fetch(GMAIL_API + '/users/me/labels', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + access, 'content-type': 'application/json' },
    body: JSON.stringify({ name: HOD_DISMISS_LABEL, labelListVisibility: 'labelHide', messageListVisibility: 'hide' }),
  });
  if (!r.ok) throw new Error('hod_dismiss_label_create_failed_' + r.status + '_' + (await r.text()).slice(0, 200));
  const j = (await r.json()) as { id: string };
  return j.id;
}

interface GmailMsgRaw {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: { headers?: Array<{ name: string; value: string }> };
}

export interface HodMailRow {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  dateMs: number;
  snippet: string;
  unread: boolean;
}

/**
 * List messages matching a Gmail search string in the SHARED mailbox.
 * Returns a flat mapped row list ready for the HoD panels.
 */
export async function listSharedMessagesByQuery(q: string, max: number): Promise<HodMailRow[]> {
  const { access } = await getSharedGmailAccessToken();
  const limit = Math.max(1, Math.min(50, max));
  const listUrl = GMAIL_API + '/users/me/messages?maxResults=' + limit + '&q=' + encodeURIComponent(q);
  const listR = await fetch(listUrl, { headers: { authorization: 'Bearer ' + access } });
  if (!listR.ok) throw new Error('gmail_' + listR.status + '_' + (await listR.text()).slice(0, 200));
  const listJ = (await listR.json()) as { messages?: Array<{ id: string; threadId: string }> };
  const items = listJ.messages ?? [];
  if (items.length === 0) return [];
  const details = await Promise.all(items.map(async (m) => {
    const url = GMAIL_API + '/users/me/messages/' + m.id +
      '?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date';
    const r = await fetch(url, { headers: { authorization: 'Bearer ' + access } });
    if (!r.ok) return null;
    const j = (await r.json()) as GmailMsgRaw;
    const headers = j.payload?.headers ?? [];
    const h = (n: string) => headers.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? '';
    const dateStr = h('Date');
    const dateMs = j.internalDate ? Number(j.internalDate) : (dateStr ? Date.parse(dateStr) || 0 : 0);
    const labels = j.labelIds ?? [];
    return {
      id: j.id,
      threadId: j.threadId,
      subject: h('Subject'),
      from: h('From'),
      date: dateStr,
      dateMs,
      snippet: j.snippet ?? '',
      unread: labels.includes('UNREAD'),
    } as HodMailRow;
  }));
  return details.filter((x): x is HodMailRow => x !== null);
}

/** Modify labels on a message in the SHARED mailbox. */
export async function modifyLabelsShared(messageId: string, add: string[] = [], remove: string[] = []): Promise<void> {
  const { access } = await getSharedGmailAccessToken();
  const r = await fetch(GMAIL_API + '/users/me/messages/' + messageId + '/modify', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + access, 'content-type': 'application/json' },
    body: JSON.stringify({ addLabelIds: add, removeLabelIds: remove }),
  });
  if (!r.ok) throw new Error('gmail_modify_failed_' + r.status + '_' + (await r.text()).slice(0, 200));
}
