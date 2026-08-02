'use client';
// app/holding/it2/system/health/SweepTrigger.tsx
// Manual sweep trigger button. Calls the runHealthSweep server action,
// then refreshes the page to show updated results.

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { runHealthSweep } from './actions';

export function SweepTrigger() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  function handleClick() {
    setMsg(null);
    startTransition(async () => {
      const result = await runHealthSweep();
      if (result.ok) {
        setMsg({ text: `✓ ${result.checked} checked · ${result.failed} failed`, ok: true });
      } else {
        setMsg({ text: `✗ ${result.error ?? 'sweep failed'}`, ok: false });
      }
      router.refresh();
    });
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
      <button
        onClick={handleClick}
        disabled={isPending}
        style={{
          fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 5, cursor: isPending ? 'default' : 'pointer',
          border: '1px solid #084838', background: isPending ? '#E8F5E9' : '#084838',
          color: isPending ? '#084838' : '#FFFFFF', opacity: isPending ? 0.7 : 1,
        }}
      >
        {isPending ? 'Running sweep…' : 'Run sweep now'}
      </button>
      {msg && (
        <span style={{ fontSize: 12, fontWeight: 600, color: msg.ok ? '#2E7D32' : '#C62828' }}>
          {msg.text}
        </span>
      )}
    </div>
  );
}
