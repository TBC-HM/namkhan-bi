'use client';

// components/settings/ArrayEditor.tsx
// Edits Postgres text[] / int[] columns. Adds/removes string items.

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
}

export default function ArrayEditor({ value, onChange }: Props) {
  const items = Array.isArray(value) ? value : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 6 }}>
          <input
            className="settings-input"
            value={item ?? ''}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            aria-label="Remove"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => onChange([...items, ''])}
        style={{ alignSelf: 'flex-start', fontSize: 11 }}
      >
        + Add item
      </button>
    </div>
  );
}
