'use client';

// Parity Run button — fires /api/parity/run, refreshes page on completion.
// Cheap (SQL-only check, no Nimble cost), so we can wait synchronously.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import StatusPill from '@/components/ui/StatusPill';

interface Props { agentStatus: string; }

export default function ParityRunButton({ agentStatus }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ inserted?: number; error?: string } | null>(null);

  const disabled = agentStatus === 'planned' || agentStatus === 'paused' || running;

  async function fire() {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch('/api/parity/run', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setResult({ error: data.error ?? `HTTP ${res.status}` });
      } else {
        setResult({ inserted: data.inserted ?? 0 });
        startTransition(() => router.refresh());
      }
    } catch (e: any) {
      setResult({ error: String(e?.message ?? e) });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={fire}
        disabled={disabled}
        title="Re-runs the parity check now (SQL-only, free)"
        style={{
          ...btnPrimary,
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {running ? '⏳ CHECKING…' : '▶ RUN CHECK NOW'}
      </button>
      {result && (
        <div style={banner}>
          {result.error ? (
            <>
              <StatusPill tone="expired">ERROR</StatusPill>
              <span>{result.error}</span>
            </>
          ) : (
            <>
              <StatusPill tone="active">DONE</StatusPill>
              <span>{result.inserted ?? 0} new breaches inserted</span>
              {pending && <span style={{ color: 'var(--ink-mute)' }}>· refreshing…</span>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  padding: '8px 14px',
  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
  fontWeight: 600, borderRadius: 4, border: 'none',
  background: 'var(--moss)', color: 'var(--paper)',
};

const banner: React.CSSProperties = {
  marginTop: 8, padding: '6px 10px',
  background: 'var(--paper)', border: '1px solid var(--paper-deep)',
  borderRadius: 4,
  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-soft)',
  display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
};
