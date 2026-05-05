'use client';

// app/marketing/compiler/_components/InlinePromptBar.tsx
// Compact one-row prompt input. Sits at the very top of /marketing/compiler.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function InlinePromptBar({ presets = [] as string[] }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!prompt.trim()) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch('/api/compiler/parse', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'parse failed');
      router.push(`/marketing/compiler/${j.runId}`);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{
        display: 'flex', alignItems: 'stretch', gap: 8,
        background: 'var(--paper-warm)',
        border: '1px solid var(--paper-deep)',
        borderRadius: 6,
        padding: 6,
      }}>
        <input
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder='5 day mindfulness retreat — 4 pax — full moon  (sets duration · theme · pax · lunar; rooms + dates + rate plan come next)'
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: 'var(--t-sm)',
            fontFamily: 'var(--sans)',
            background: 'var(--paper)',
            border: '1px solid var(--paper-deep)',
            borderRadius: 4,
            color: 'var(--ink)',
          }}
        />
        <button
          onClick={submit}
          disabled={busy || !prompt.trim()}
          style={{
            padding: '0 18px',
            background: busy ? 'var(--ink-faint)' : 'var(--moss)',
            color: 'var(--paper)',
            border: 'none', borderRadius: 4,
            fontSize: 'var(--t-xs)', cursor: busy ? 'wait' : 'pointer',
            textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', fontWeight: 600,
            fontFamily: 'var(--mono)',
          }}
        >
          {busy ? 'Parsing…' : 'Parse → configure'}
        </button>
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="t-eyebrow" style={{ marginRight: 4 }}>
          TEMPLATES
        </span>
        <span style={{
          fontSize: 'var(--t-xs)', fontFamily: 'var(--mono)',
          color: 'var(--ink-mute)', letterSpacing: 'var(--ls-loose)',
          marginRight: 4,
        }}>
          click to fill, then edit and send →
        </span>
        {presets.map(p => (
          <button
            key={p} type="button" onClick={() => setPrompt(p)}
            title="Click to fill the prompt — then edit and submit"
            style={{
              padding: '3px 8px',
              background: 'var(--paper)',
              border: '1px solid var(--paper-deep)',
              borderRadius: 3,
              fontSize: 'var(--t-xs)',
              fontFamily: 'var(--mono)',
              color: 'var(--ink-soft)',
              cursor: 'pointer',
            }}
          >
            {p}
          </button>
        ))}
      </div>
      {err && <div style={{ marginTop: 8, fontSize: 'var(--t-xs)', color: 'var(--st-bad, #b65f4a)' }}>{err}</div>}
    </div>
  );
}
