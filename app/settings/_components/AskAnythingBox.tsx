'use client';

import { useState, useTransition } from 'react';

interface AskAnythingBoxProps {
  placeholder?: string;
}

export function AskAnythingBox({
  placeholder = 'Ask anything about the property… e.g. "What are our active certifications?" or "Which USPs mention the farm?"',
}: AskAnythingBoxProps) {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isPending) return;

    setAnswer(null);
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch('/api/settings/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: query.trim(), scope: 'property_settings' }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json?.error ?? `HTTP ${res.status}`);
        }
        const json = await res.json();
        setAnswer(json.answer ?? '—');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    });
  };

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        marginTop: '2rem',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '1rem',
          fontWeight: 600,
          marginBottom: '0.75rem',
          color: 'var(--color-text)',
        }}
      >
        Ask anything about the property
      </div>
      <p
        style={{
          fontSize: '0.8rem',
          color: 'var(--color-text-muted)',
          marginBottom: '1rem',
        }}
      >
        Scoped to property data only — contacts, certifications, descriptions, USPs, facilities.
        Agent and IT configuration is excluded.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          disabled={isPending}
          style={{
            flexGrow: 1,
            minWidth: '16rem',
            padding: '0.65rem 1rem',
            border: '1px solid var(--color-border)',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            background: 'var(--color-bg)',
            color: 'var(--color-text)',
            outline: 'none',
            fontFamily: 'inherit',
          }}
          aria-label="Settings question"
        />
        <button
          type="submit"
          disabled={isPending || !query.trim()}
          style={{
            padding: '0.65rem 1.5rem',
            background: query.trim() && !isPending ? 'var(--color-primary)' : 'var(--color-border)',
            color: '#fff',
            border: 'none',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: isPending || !query.trim() ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
            whiteSpace: 'nowrap',
          }}
        >
          {isPending ? 'Thinking…' : 'Ask →'}
        </button>
      </form>

      {/* Answer */}
      {answer !== null && (
        <div
          style={{
            marginTop: '1rem',
            background: 'var(--color-surface-alt)',
            border: '1px solid var(--color-border)',
            borderRadius: '0.5rem',
            padding: '1rem 1.25rem',
            fontSize: '0.875rem',
            color: 'var(--color-text)',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}
          role="region"
          aria-label="Answer"
        >
          {answer}
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            marginTop: '1rem',
            background: 'rgba(192,57,43,0.08)',
            border: '1px solid rgba(192,57,43,0.3)',
            borderRadius: '0.5rem',
            padding: '0.75rem 1rem',
            fontSize: '0.8rem',
            color: 'var(--color-danger, #c0392b)',
          }}
          role="alert"
        >
          ⚠ {error}
        </div>
      )}
    </div>
  );
}
