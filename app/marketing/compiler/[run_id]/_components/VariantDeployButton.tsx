'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function VariantDeployButton({ runId, variantId }: { runId: string; variantId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const deploy = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/compiler/runs/${runId}/deploy`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ variantId, designVariant: 'B' }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'deploy failed');
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setBusy(false);
    }
  };

  return (
    <div style={{ flex: 1 }}>
      <button
        onClick={deploy}
        disabled={busy}
        style={{
          width: '100%', padding: '8px 12px',
          background: busy ? 'var(--ink-faint)' : 'var(--moss)',
          color: 'var(--paper)', border: 'none', borderRadius: 4,
          fontSize: 'var(--t-sm)', cursor: busy ? 'wait' : 'pointer',
          textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', fontWeight: 600,
        }}
      >
        {busy ? 'Deploying…' : 'Pick & deploy'}
      </button>
      {err && <div style={{ marginTop: 6, fontSize: 'var(--t-xs)', color: 'var(--bad, #b65f4a)' }}>{err}</div>}
    </div>
  );
}
