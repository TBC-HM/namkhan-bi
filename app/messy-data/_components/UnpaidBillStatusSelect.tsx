'use client';

// PBS 2026-05-09: per-row classification dropdown for unpaid bills.
// Auto-submits on change → POST /api/messy/unpaid-bills/update → revalidate.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface Option { value: string; label: string }

interface Props {
  id: number;
  initial: string;
  options: Option[];
}

export default function UnpaidBillStatusSelect({ id, initial, options }: Props) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    setValue(next);
    setSaving(true);
    try {
      const res = await fetch('/api/messy/unpaid-bills/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, human_status: next }),
      });
      if (!res.ok) {
        // Revert on failure.
        setValue(initial);
      } else {
        startTransition(() => router.refresh());
      }
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || pending;

  return (
    <select
      value={value}
      onChange={onChange}
      disabled={busy}
      style={{
        background: '#1a1812',
        color: busy ? '#7d7565' : '#d8cca8',
        border: '1px solid #2a261d',
        borderRadius: 4,
        fontFamily: 'var(--mono)',
        fontSize: 'var(--t-xs)',
        padding: '2px 4px',
        cursor: busy ? 'wait' : 'pointer',
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
