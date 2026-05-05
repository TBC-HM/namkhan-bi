'use client';

// app/marketing/compiler/_components/PromptParser.tsx
// Single-line prompt input -> POST /api/compiler/parse -> POST /api/compiler/build -> redirect.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PromptParser({ presets = [] as string[] }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!prompt.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const parseRes = await fetch('/api/compiler/parse', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const parseJson = await parseRes.json();
      if (!parseRes.ok) throw new Error(parseJson.error ?? 'parse failed');

      const buildRes = await fetch('/api/compiler/build', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ runId: parseJson.runId }),
      });
      const buildJson = await buildRes.json();
      if (!buildRes.ok) throw new Error(buildJson.error ?? 'build failed');

      router.push(`/marketing/compiler/${parseJson.runId}`);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder="5 day mindfulness retreat — lux only — green season — 8 pax"
        rows={2}
        style={{
          width: '100%',
          padding: '14px 16px',
          fontSize: 'var(--t-base)',
          fontFamily: 'var(--sans)',
          background: 'var(--paper)',
          border: '1px solid var(--ink-faint)',
          borderRadius: 4,
          color: 'var(--ink)',
          resize: 'vertical',
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
          ⌘/Ctrl + Enter to compile
        </div>
        <button
          onClick={submit}
          disabled={busy || !prompt.trim()}
          style={{
            padding: '10px 22px',
            background: busy ? 'var(--ink-faint)' : 'var(--moss)',
            color: 'var(--paper)',
            border: 'none',
            borderRadius: 4,
            cursor: busy ? 'wait' : 'pointer',
            fontSize: 'var(--t-sm)',
            letterSpacing: 'var(--ls-extra)',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          {busy ? 'Compiling…' : 'Compile retreat'}
        </button>
      </div>
      {err && (
        <div style={{ fontSize: 'var(--t-sm)', color: 'var(--bad, #b65f4a)' }}>
          Error: {err}
        </div>
      )}
      {presets.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          {presets.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPrompt(p)}
              style={{
                padding: '6px 12px',
                background: 'var(--paper-deep, #f5efdf)',
                border: '1px solid var(--ink-faint)',
                borderRadius: 999,
                fontSize: 'var(--t-xs)',
                color: 'var(--ink-soft)',
                cursor: 'pointer',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
