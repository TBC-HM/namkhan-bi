'use client';
// RunNowButtons v2 — fire-and-poll architecture.
// 1. POST /api/compset/run → returns 202 + run_id within ~2s (EF queues background work).
// 2. Poll GET /api/compset/run/status?run_id=X every 4s until status != 'running'.
// 3. On terminal status, refresh the page so freshly-written rates appear in the deep view.
//
// Why: Supabase EF gateway has a 150s idle timeout. Our 22-job batch takes ~180s.
// Without fire-and-poll the user always sees a 504 even though the run succeeded.

import { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import StatusPill from '@/components/ui/StatusPill';
import { fmtTableUsd } from '@/lib/format';

type RunState = {
  run_id?: string;
  status?: string;          // running | success | partial | failed | crashed
  final_status?: string | null;
  jobs_total?: number | null;
  rates_so_far?: number;
  success?: number | null;
  failed?: number | null;
  cost_usd?: number | null;
  duration_ms?: number | null;
  crash_error?: string | null;
  estimated_seconds?: number;
  is_done?: boolean;
  error?: string;
} | null;

type Mode = 'phase_1_validation' | 'daily_lean';

interface Props {
  agentStatus: string;
}

const POLL_INTERVAL_MS = 4_000;
const POLL_TIMEOUT_MS = 600_000; // 10 min hard cap on UI polling

export default function RunNowButtons({ agentStatus }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState<Mode | null>(null);
  const [state, setState] = useState<RunState>(null);
  const pollHandle = useRef<number | null>(null);

  // Cleanup poll on unmount
  useEffect(() => () => {
    if (pollHandle.current != null) clearTimeout(pollHandle.current);
  }, []);

  const disabled = agentStatus === 'planned' || agentStatus === 'paused' || running !== null;

  async function pollLoop(run_id: string, startTs: number) {
    if (Date.now() - startTs > POLL_TIMEOUT_MS) {
      setState((s) => ({ ...(s ?? {}), error: 'poll timeout (10 min) — check Agent Run History' }));
      setRunning(null);
      return;
    }
    try {
      const res = await fetch(`/api/compset/run/status?run_id=${run_id}`, { cache: 'no-store' });
      const data = await res.json();
      setState((s) => ({ ...(s ?? {}), ...data }));

      if (data.is_done) {
        setRunning(null);
        if ((data.success ?? 0) > 0) {
          startTransition(() => router.refresh());
        }
        return;
      }
    } catch (e) {
      // Transient — keep polling
    }
    pollHandle.current = window.setTimeout(() => pollLoop(run_id, startTs), POLL_INTERVAL_MS);
  }

  async function fire(mode: Mode) {
    setRunning(mode);
    setState({ status: 'starting' });
    try {
      const startRes = await fetch('/api/compset/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const startData = await startRes.json();
      if (!startRes.ok || !startData.run_id) {
        setState({ error: startData.error ?? `start failed (HTTP ${startRes.status})` });
        setRunning(null);
        return;
      }
      setState({
        run_id: startData.run_id,
        status: 'running',
        jobs_total: startData.jobs_total,
        estimated_seconds: startData.estimated_seconds,
        rates_so_far: 0,
      });
      pollHandle.current = window.setTimeout(() => pollLoop(startData.run_id, Date.now()), POLL_INTERVAL_MS);
    } catch (e: any) {
      setState({ error: String(e?.message ?? e) });
      setRunning(null);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => fire('phase_1_validation')}
          disabled={disabled}
          title="BDC only · 11 hotels × 2 dates · ~22 scrapes · ~3 min"
          style={{ ...btnPrimary, opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
        >
          {running === 'phase_1_validation' ? '⏳ RUNNING…' : '▶ RUN NOW (BDC)'}
        </button>
        <button
          type="button"
          onClick={() => fire('daily_lean')}
          disabled={disabled}
          title="All channels in agent runtime_settings"
          style={{ ...btnSecondary, opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
        >
          {running === 'daily_lean' ? '⏳ RUNNING…' : 'DEEP SHOP'}
        </button>
      </div>

      {state && (
        <div style={banner}>
          {state.error ? (
            <>
              <StatusPill tone="expired">ERROR</StatusPill>
              <span>{state.error}</span>
            </>
          ) : state.is_done || state.final_status ? (
            <>
              <StatusPill
                tone={
                  state.final_status === 'success'
                    ? 'active'
                    : state.final_status === 'partial'
                      ? 'pending'
                      : 'expired'
                }
              >
                {(state.final_status ?? 'DONE').toUpperCase()}
              </StatusPill>
              <span>
                {state.success ?? 0} ok · {state.failed ?? 0} failed · {state.jobs_total ?? 0} total
              </span>
              {state.cost_usd != null && <span>· {fmtTableUsd(state.cost_usd)}</span>}
              {state.duration_ms != null && <span>· {(state.duration_ms / 1000).toFixed(1)}s</span>}
              {pending && <span style={{ color: 'var(--ink-mute)' }}>· refreshing page…</span>}
            </>
          ) : (
            <>
              <StatusPill tone="info">RUNNING</StatusPill>
              <span>
                {state.rates_so_far ?? 0} / {state.jobs_total ?? '?'} scraped
                {state.estimated_seconds != null && ` · est ${state.estimated_seconds}s total`}
              </span>
              <span style={{ color: 'var(--ink-mute)' }}>· polling every 4s</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const btnBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 14px',
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)',
  textTransform: 'uppercase',
  fontWeight: 600,
  borderRadius: 4,
  border: 'none',
};
const btnPrimary: React.CSSProperties = { ...btnBase, background: 'var(--moss)', color: 'var(--paper)' };
const btnSecondary: React.CSSProperties = {
  ...btnBase, background: 'transparent', color: 'var(--ink-soft)',
  border: '1px solid var(--paper-deep)',
};
const banner: React.CSSProperties = {
  marginTop: 10,
  padding: '8px 12px',
  background: 'var(--paper)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 4,
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  color: 'var(--ink-soft)',
  display: 'inline-flex',
  gap: 10,
  alignItems: 'center',
  flexWrap: 'wrap',
};
