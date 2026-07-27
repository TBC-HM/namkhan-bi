'use client';

// FP&C Module v1 — triggers the queue-only variance_narrative skill (A5).
// The skill drafts a narrative and lands it as an awaits_user cockpit ticket.
// Nothing is auto-published (claude_md §0.6).

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function NarrativeButton({ propertyId, yearMonth }: { propertyId: number; yearMonth: string | null }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/cockpit/skills/variance_narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId, ...(yearMonth ? { year_month: yearMonth } : {}) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setMsg(`✗ ${json?.error || `HTTP ${res.status}`}`);
      else if (json.ticket_id) {
        setMsg(`✓ Draft for ${json.year_month} awaiting review (ticket #${json.ticket_id}, ${json.breaches} class(es) >±10%).`);
        startTransition(() => router.refresh());
      } else {
        setMsg(`✓ ${json.note || 'no narrative needed'}`);
      }
    } catch (e) {
      setMsg(`✗ ${e instanceof Error ? e.message : 'request failed'}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <button
        type="button"
        disabled={busy}
        onClick={run}
        style={{
          padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer',
          background: 'var(--paper)', color: 'var(--primary)', border: '1px solid var(--primary)',
          borderRadius: 6, opacity: busy ? 0.5 : 1,
        }}
      >
        {busy ? 'Drafting…' : 'Draft variance narrative'}
      </button>
      {msg && <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{msg}</span>}
    </div>
  );
}
