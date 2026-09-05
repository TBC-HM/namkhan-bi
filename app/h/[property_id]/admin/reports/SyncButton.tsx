'use client';
// SyncButton — triggers sync-cloudbeds for one unsynced stock report.
import { useState } from 'react';

interface Props {
  propertyId: number;
  reportId: number;
  reportName: string;
}

export default function SyncButton({ propertyId, reportId, reportName }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');

  async function handleSync() {
    setState('loading');
    setErrMsg('');
    try {
      const res = await fetch(`/api/admin/reports/sync?property_id=${propertyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: reportId, report_name: reportName }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErrMsg(j.error ?? `Error ${res.status}`);
        setState('error');
        return;
      }
      setState('done');
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Network error');
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <span style={{ fontSize: 10, color: '#1F3A2E', fontWeight: 600 }}>
        ✓ Syncing…
      </span>
    );
  }

  if (state === 'error') {
    return (
      <span style={{ fontSize: 10, color: '#B8542A' }} title={errMsg}>
        ✗ Failed
      </span>
    );
  }

  return (
    <button
      onClick={handleSync}
      disabled={state === 'loading'}
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.04em',
        background: state === 'loading' ? 'rgba(90,90,90,0.06)' : 'rgba(68,85,200,0.07)',
        color: state === 'loading' ? '#8A8A8A' : '#4455C8',
        border: `1px solid ${state === 'loading' ? 'rgba(90,90,90,0.15)' : 'rgba(68,85,200,0.25)'}`,
        borderRadius: 3,
        cursor: state === 'loading' ? 'default' : 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {state === 'loading' ? '…' : '↻ Sync'}
    </button>
  );
}
