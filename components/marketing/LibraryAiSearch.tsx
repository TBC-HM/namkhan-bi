'use client';

// components/marketing/LibraryAiSearch.tsx
// AI-style "what kind of asset are you looking for?" search bar at the top
// of /marketing/library. Submission routes to /cockpit/chat?dept=marketing&q=…
// so Lumen handles the natural-language query (and can call media-vector
// retrieval skills as they come online).
//
// The taxonomy filter rail still works in parallel for deterministic
// browsing; this is the AI shortcut for "find me three vibe-fit reels for
// a couples retreat campaign" type questions.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const QUICK_PROMPTS = [
  'Best shots for an OTA carousel',
  'Reels with the river at sunset',
  'Photos missing alt-text',
  'Find similar to my last hero shot',
  'Lifestyle shots without identifiable people',
];

export default function LibraryAiSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');

  function go(query: string) {
    const t = query.trim();
    if (!t) return;
    router.push(`/cockpit/chat?dept=marketing&q=${encodeURIComponent(t)}&project=media-library`);
  }

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, var(--paper-warm) 0%, var(--paper) 100%)',
        border: '1px solid var(--line)',
        borderRadius: 8,
        padding: '14px 16px',
        marginBottom: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--brass)' }}>
        <span>✦</span>
        <span>Lumen · ask the library</span>
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); go(q); }}
        style={{ display: 'flex', gap: 8, alignItems: 'center' }}
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="What kind of asset are you looking for? (e.g. three sunset shots for IG, with no people in frame)"
          aria-label="Ask the library AI"
          style={{
            flex: 1,
            fontFamily: 'var(--serif)',
            fontStyle: 'italic',
            fontSize: 'var(--t-md)',
            color: 'var(--ink)',
            background: 'var(--paper)',
            border: '1px solid var(--line)',
            padding: '8px 12px',
            borderRadius: 6,
          }}
        />
        <button
          type="submit"
          style={{
            padding: '8px 16px',
            fontFamily: 'var(--mono)',
            fontSize: 'var(--t-xs)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            fontWeight: 600,
            background: 'var(--moss)',
            color: 'var(--paper-warm)',
            border: '1px solid var(--moss)',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Ask Lumen →
        </button>
      </form>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => { setQ(p); go(p); }}
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 'var(--t-xs)',
              letterSpacing: '0.05em',
              color: 'var(--ink-soft)',
              background: 'var(--paper)',
              border: '1px solid var(--line-soft)',
              padding: '4px 8px',
              borderRadius: 999,
              cursor: 'pointer',
            }}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
