'use client';

// components/settings/JsonEditor.tsx
// Free-form JSON textarea with inline parse-error reporting.

import { useEffect, useState } from 'react';

interface Props {
  value: unknown;
  onChange: (next: unknown) => void;
}

export default function JsonEditor({ value, onChange }: Props) {
  const [text, setText] = useState<string>(() => JSON.stringify(value ?? null, null, 2));
  const [err, setErr] = useState<string | null>(null);

  // Re-sync if parent value changes after server reload.
  useEffect(() => {
    setText(JSON.stringify(value ?? null, null, 2));
    setErr(null);
  }, [value]);

  return (
    <div>
      <textarea
        className="settings-input"
        style={{
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: 12,
          minHeight: 160,
          width: '100%',
          borderColor: err ? 'var(--bad, #c93b3b)' : undefined,
        }}
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          if (v.trim() === '') {
            onChange(null);
            setErr(null);
            return;
          }
          try {
            onChange(JSON.parse(v));
            setErr(null);
          } catch (parseErr: any) {
            setErr(parseErr?.message ?? 'Invalid JSON');
          }
        }}
      />
      {err && (
        <div className="text-mono" style={{ fontSize: 10, color: 'var(--bad, #c93b3b)', marginTop: 2 }}>
          JSON: {err}
        </div>
      )}
    </div>
  );
}
