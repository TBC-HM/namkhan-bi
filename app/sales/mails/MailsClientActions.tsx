'use client';
// app/sales/mails/MailsClientActions.tsx
// Client wrapper around <UnifiedMailInbox/> for /sales/mails.
// Owns:
//   - Per-row inline "Convert" chip via renderRowActions.
//   - Bulk primary/secondary handlers (Convert to Leads / Dismiss).
//   - Local optimistic state for linkedLeadByThreadId + dismissedThreadIds so
//     the user gets instant feedback without a page reload.
//
// PBS 2026-07-14 · Per RSC rule: server components must NOT pass function
// props to a client component. This file is that client boundary.

import { useCallback, useMemo, useState } from 'react';
import UnifiedMailInbox, {
  type Thread,
  type MailboxSummary,
} from '@/app/(cockpit)/_design/UnifiedMailInbox';

const T = {
  WHITE: '#FFFFFF', HAIR: '#E6DFCC', INK: '#1B1B1B', INK_M: '#5A5A5A',
  CHIP: '#F5F0E0', MUTED: '#8B7355',
};

interface Props {
  initialThreads: Thread[];
  mailboxes: MailboxSummary[];
  linkedLeadByThreadId: Record<string, number>;
  dismissedThreadIds: string[];
  aliasByMailboxId: Record<string, string>;
}

function parseEmail(raw: string): { name: string; email: string } {
  const m = raw.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { name: '', email: raw.trim() };
}

async function convertOne(t: Thread, aliasByMailboxId: Record<string, string>): Promise<number | null> {
  const parsed = parseEmail(t.from);
  const alias = aliasByMailboxId[t.mailbox_id] ?? (t.mailbox_address.split('@')[0] || 'sales');
  const r = await fetch('/api/sales/leads/convert-from-email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      from_email: parsed.email,
      from_name: parsed.name,
      subject: t.subject,
      snippet: t.snippet,
      thread_id: t.threadId,
      message_id: t.id,
      mailbox_alias: alias,
      mailbox_id: t.mailbox_id,
    }),
  });
  if (!r.ok) return null;
  const j = await r.json().catch(() => ({}));
  const leadId = Number(j.lead_id);
  return Number.isFinite(leadId) && leadId > 0 ? leadId : null;
}

export default function MailsClientActions(props: Props) {
  const { initialThreads, mailboxes, linkedLeadByThreadId, dismissedThreadIds, aliasByMailboxId } = props;
  const [linkedLeads, setLinkedLeads] = useState<Record<string, number>>(linkedLeadByThreadId);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set(dismissedThreadIds));
  const [rowBusyThreadId, setRowBusyThreadId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const convertRow = useCallback(async (t: Thread) => {
    if (rowBusyThreadId) return;
    setRowBusyThreadId(t.threadId);
    try {
      const leadId = await convertOne(t, aliasByMailboxId);
      if (leadId) {
        setLinkedLeads((prev) => ({ ...prev, [t.threadId]: leadId }));
        showToast('Converted → Lead #' + leadId + ' · open at /sales/leads');
      } else {
        showToast('Convert failed — try again');
      }
    } finally {
      setRowBusyThreadId(null);
    }
  }, [aliasByMailboxId, rowBusyThreadId, showToast]);

  const renderRowActions = useCallback((t: Thread) => {
    // The primitive itself renders the "→ Lead #N" and "Dismissed" chips
    // via its linkedLeads / dismissedThreadIds props. We only render the
    // Convert chip when neither applies.
    if (linkedLeads[t.threadId]) return null;
    if (dismissed.has(t.threadId)) return null;
    const busy = rowBusyThreadId === t.threadId;
    return (
      <button
        type="button"
        onClick={() => void convertRow(t)}
        disabled={busy}
        title="Convert this thread to a Lead"
        style={{
          background: T.CHIP,
          color: T.INK,
          border: '1px solid ' + T.HAIR,
          borderRadius: 4,
          padding: '4px 8px',
          fontSize: 11,
          fontWeight: 600,
          cursor: busy ? 'wait' : 'pointer',
          whiteSpace: 'nowrap',
          opacity: busy ? 0.6 : 1,
        }}
      >{busy ? 'Converting…' : '+ Convert'}</button>
    );
  }, [linkedLeads, dismissed, rowBusyThreadId, convertRow]);

  const onBulkPrimary = useCallback(async (threads: Thread[]) => {
    let converted = 0;
    let skipped = 0;
    const nextLinks: Record<string, number> = {};
    for (const t of threads) {
      if (linkedLeads[t.threadId]) { skipped += 1; continue; }
      const leadId = await convertOne(t, aliasByMailboxId);
      if (leadId) { nextLinks[t.threadId] = leadId; converted += 1; }
    }
    if (Object.keys(nextLinks).length > 0) {
      setLinkedLeads((prev) => ({ ...prev, ...nextLinks }));
    }
    showToast('Converted ' + converted + ' lead' + (converted === 1 ? '' : 's')
      + (skipped ? ' · ' + skipped + ' already linked' : '')
      + ' → open at /sales/leads');
  }, [aliasByMailboxId, linkedLeads, showToast]);

  const onBulkSecondary = useCallback(async (threads: Thread[]) => {
    const eligible = threads.filter((t) => !linkedLeads[t.threadId] && !dismissed.has(t.threadId));
    if (eligible.length === 0) { showToast('Nothing to dismiss (already leads or dismissed).'); return; }
    const aliasMap: Record<string, string> = {};
    for (const t of eligible) aliasMap[t.threadId] = aliasByMailboxId[t.mailbox_id] ?? '';
    const r = await fetch('/api/sales/mails/dismiss', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        thread_ids: eligible.map((t) => t.threadId),
        mailbox_alias_by_id: aliasMap,
      }),
    });
    if (!r.ok) { showToast('Dismiss failed'); return; }
    const j = await r.json().catch(() => ({ dismissed: 0 }));
    setDismissed((prev) => {
      const next = new Set(prev);
      eligible.forEach((t) => next.add(t.threadId));
      return next;
    });
    showToast('Dismissed ' + (j.dismissed ?? eligible.length) + ' thread' + (eligible.length === 1 ? '' : 's'));
  }, [aliasByMailboxId, linkedLeads, dismissed, showToast]);

  const dismissedList = useMemo(() => Array.from(dismissed), [dismissed]);

  return (
    <>
      <UnifiedMailInbox
        initialThreads={initialThreads}
        mailboxes={mailboxes}
        linkedLeads={linkedLeads}
        dismissedThreadIds={dismissedList}
        enableMultiSelect={true}
        bulkActionLabel="Convert to Leads"
        bulkSecondaryLabel="Dismiss"
        onBulkPrimary={onBulkPrimary}
        onBulkSecondary={onBulkSecondary}
        renderRowActions={renderRowActions}
      />
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: T.INK,
            color: T.WHITE,
            border: '1px solid ' + T.INK,
            borderRadius: 6,
            padding: '10px 16px',
            fontSize: 12,
            fontWeight: 600,
            boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
            zIndex: 6000,
            maxWidth: '90vw',
          }}
          role="status"
          aria-live="polite"
        >{toast}</div>
      )}
    </>
  );
}
