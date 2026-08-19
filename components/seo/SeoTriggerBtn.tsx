'use client';
// SeoTriggerBtn — fires a DataForSEO pipeline action from the UI
import { useState } from 'react';

const GREEN = '#084838';

interface Props {
  mode: string;
  label: string;
  propertyId: number;
  description?: string;
  variant?: 'primary' | 'secondary';
}

export default function SeoTriggerBtn({ mode, label, propertyId, description, variant = 'primary' }: Props) {
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState<string | null>(null);

  const fire = async () => {
    if (state === 'running') return;
    setState('running');
    setMsg(null);
    try {
      const res = await fetch('/api/marketing/seo/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, property_id: propertyId }),
      });
      const j = await res.json();
      if (j.ok) {
        setState('done');
        const r = j.result;
        if (r?.posted != null) setMsg(`${r.posted} tasks posted`);
        else if (r?.fetched != null) setMsg(`${r.fetched} fetched · ${r.with_position ?? 0} ranked`);
        else if (r?.keywords != null) setMsg(`${r.keywords} keywords processed`);
        else if (r?.upserted != null) setMsg(`${r.upserted} records`);
        else setMsg('Done');
        setTimeout(() => setState('idle'), 5000);
      } else {
        setState('error');
        setMsg(j.result?.error ?? 'Failed');
        setTimeout(() => setState('idle'), 4000);
      }
    } catch (e: any) {
      setState('error');
      setMsg(e.message ?? 'Network error');
      setTimeout(() => setState('idle'), 4000);
    }
  };

  const colors = {
    idle: { bg: variant === 'primary' ? GREEN : '#F4EFE2', color: variant === 'primary' ? '#fff' : GREEN, border: GREEN },
    running: { bg: '#0a5c38', color: '#fff', border: '#0a5c38' },
    done: { bg: '#0E7A4B', color: '#fff', border: '#0E7A4B' },
    error: { bg: '#B03826', color: '#fff', border: '#B03826' },
  };
  const c = colors[state];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button
        onClick={fire}
        disabled={state === 'running'}
        style={{
          padding: '7px 16px', background: c.bg, color: c.color,
          border: `1px solid ${c.border}`, borderRadius: 5, cursor: state === 'running' ? 'wait' : 'pointer',
          fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' as const,
          transition: 'all .15s', opacity: state === 'running' ? 0.8 : 1,
        }}
      >
        {state === 'running' ? '⏳ Running…' : state === 'done' ? '✓ Done' : state === 'error' ? '✗ Error' : label}
      </button>
      {description && state === 'idle' && (
        <span style={{ fontSize: 11, color: '#5A5A5A' }}>{description}</span>
      )}
      {msg && (
        <span style={{ fontSize: 11, color: state === 'error' ? '#B03826' : '#0E7A4B', fontFamily: 'ui-monospace,monospace' }}>
          {msg}
        </span>
      )}
    </div>
  );
}
