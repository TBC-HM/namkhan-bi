'use client';
// components/seo/SeoResearchBar.tsx
// Seed keyword input + trigger for Research tab
import { useState } from 'react';

const GREEN = '#084838';
const INK = '#1B1B1B';
const INK_M = '#5A5A5A';
const INK_F = '#8A8A8A';
const HAIR = '#E6DFCC';
const AMBER = '#C28F2C';

interface Props {
  resultCount: number;
  lastFetched: string | null;
  propertyId: number;
}

export default function SeoResearchBar({ resultCount, lastFetched, propertyId }: Props) {
  const [seed, setSeed] = useState('');
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState<string | null>(null);

  const fire = async () => {
    if (state === 'running') return;
    setState('running');
    setMsg(null);
    try {
      const body: Record<string, unknown> = { mode: 'suggestions', property_id: propertyId };
      if (seed.trim()) body.seed_keyword = seed.trim();

      const res = await fetch('/api/marketing/seo/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (j.ok) {
        setState('done');
        const r = j.result;
        if (r?.upserted != null) setMsg(`${r.upserted} keyword ideas saved — refresh page to see results`);
        else if (r?.suggestions != null) setMsg(`${r.suggestions} ideas found — refresh page`);
        else setMsg('Done — refresh page to see results');
        setTimeout(() => setState('idle'), 8000);
      } else {
        setState('error');
        setMsg(j.error ?? j.result?.error ?? 'Research failed');
        setTimeout(() => setState('idle'), 5000);
      }
    } catch (e: any) {
      setState('error');
      setMsg(e.message ?? 'Network error');
      setTimeout(() => setState('idle'), 5000);
    }
  };

  const btnColors = {
    idle:    { bg: GREEN,      color: '#fff', border: GREEN      },
    running: { bg: '#0a5c38', color: '#fff', border: '#0a5c38'  },
    done:    { bg: '#0E7A4B', color: '#fff', border: '#0E7A4B'  },
    error:   { bg: '#B03826', color: '#fff', border: '#B03826'  },
  };
  const c = btnColors[state];

  return (
    <div>
      {/* Seed input row */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          padding: '12px 14px',
          background: '#F9F6F0',
          border: `1px solid ${HAIR}`,
          borderRadius: 6,
          marginBottom: 14,
          flexWrap: 'wrap' as const,
        }}
      >
        <label style={{ fontSize: 11, fontWeight: 600, color: INK, whiteSpace: 'nowrap' as const }}>
          Research seed keyword
        </label>
        <input
          type="text"
          value={seed}
          onChange={e => setSeed(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') fire(); }}
          placeholder="e.g. eco lodge luang prabang"
          style={{
            flex: 1,
            minWidth: 220,
            fontSize: 12,
            padding: '6px 10px',
            border: `1px solid ${HAIR}`,
            borderRadius: 4,
            color: INK,
            background: '#FFFFFF',
            outline: 'none',
          }}
        />
        <button
          onClick={fire}
          disabled={state === 'running'}
          style={{
            padding: '7px 16px',
            background: c.bg,
            color: c.color,
            border: `1px solid ${c.border}`,
            borderRadius: 5,
            cursor: state === 'running' ? 'wait' : 'pointer',
            fontSize: 12,
            fontWeight: 700,
            whiteSpace: 'nowrap' as const,
            transition: 'all .15s',
            opacity: state === 'running' ? 0.8 : 1,
          }}
        >
          {state === 'running'
            ? '⏳ Researching…'
            : state === 'done'
            ? '✓ Done'
            : state === 'error'
            ? '✗ Error'
            : '🔍 Research keywords'}
        </button>

        {/* Result count + last fetched */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap' as const }}>
          {resultCount > 0 && (
            <span style={{ fontSize: 11, color: INK_M }}>
              <strong style={{ color: INK }}>{resultCount}</strong> ideas in database
            </span>
          )}
          {lastFetched && (
            <span style={{ fontSize: 10, color: INK_F, fontFamily: 'ui-monospace,monospace' }}>
              Last fetched: {lastFetched}
            </span>
          )}
        </div>
      </div>

      {/* Status message */}
      {msg && (
        <div
          style={{
            fontSize: 11,
            color: state === 'error' ? '#B03826' : '#0E7A4B',
            background: state === 'error' ? '#FEE2E2' : '#E6F4EA',
            border: `1px solid ${state === 'error' ? '#B03826' : '#86CFA0'}`,
            borderRadius: 4,
            padding: '6px 12px',
            marginBottom: 10,
            fontFamily: 'ui-monospace,monospace',
          }}
        >
          {msg}
        </div>
      )}

      {/* Hint when empty seed */}
      {!seed.trim() && state === 'idle' && (
        <div style={{ fontSize: 11, color: INK_F, marginBottom: 4 }}>
          Leave seed blank to use your top 3 tracked keywords automatically.
        </div>
      )}
    </div>
  );
}
