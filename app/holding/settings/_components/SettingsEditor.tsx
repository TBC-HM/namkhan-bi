// app/holding/settings/_components/SettingsEditor.tsx
// PBS 2026-07-09: one card per holding.settings row. Editable form,
// Save button hits /api/holding/settings/save which calls fn_holding_settings_save
// (SECURITY DEFINER RPC — the non-public schema write path).

'use client';

import { useState, useTransition, type CSSProperties } from 'react';

interface Field { key: string; label: string; type?: 'text' | 'textarea' | 'email' | 'color' | 'url' }

export default function SettingsEditor({
  settingKey, initial, fields,
}: {
  settingKey: string;
  initial: Record<string, string>;
  fields: Field[];
}) {
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const setField = (k: string, v: string) => setValues((prev) => ({ ...prev, [k]: v }));

  const save = () => {
    startTransition(async () => {
      setMsg(null);
      try {
        const r = await fetch('/api/holding/settings/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: settingKey, value: values }),
        });
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error ?? `save failed (${r.status})`);
        }
        setMsg('✓ saved');
        setTimeout(() => setMsg(null), 2500);
      } catch (e) {
        setMsg(`✗ ${(e as Error).message}`);
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 8 }}>
        {fields.map((f) => {
          const value = values[f.key] ?? '';
          return (
            <label key={f.key} style={fieldLabelStyle}>
              <span style={fieldTitleStyle}>{f.label}</span>
              {f.type === 'textarea' ? (
                <textarea
                  value={value}
                  onChange={(e) => setField(f.key, e.target.value)}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                />
              ) : f.type === 'color' ? (
                <div style={{ display: 'flex', gap: 4 }}>
                  <input
                    type="color"
                    value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#084838'}
                    onChange={(e) => setField(f.key, e.target.value)}
                    style={{ width: 32, height: 30, border: '1px solid #E6DFCC', borderRadius: 4, cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setField(f.key, e.target.value)}
                    placeholder="#RRGGBB"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                </div>
              ) : (
                <input
                  type={f.type ?? 'text'}
                  value={value}
                  onChange={(e) => setField(f.key, e.target.value)}
                  style={inputStyle}
                />
              )}
            </label>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <button type="button" onClick={save} disabled={pending} style={saveBtnStyle}>
          {pending ? 'Saving…' : 'Save'}
        </button>
        {msg && (
          <span style={{ fontSize: 11, color: msg.startsWith('✓') ? '#0B5B3A' : '#B04A2F' }}>{msg}</span>
        )}
      </div>
    </div>
  );
}

const fieldLabelStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3 };
const fieldTitleStyle: CSSProperties = {
  fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
  fontWeight: 600, color: '#5A5A5A',
};
const inputStyle: CSSProperties = {
  padding: '6px 8px', fontSize: 12, border: '1px solid #E6DFCC',
  borderRadius: 4, background: '#FFFFFF', color: '#1B1B1B',
};
const saveBtnStyle: CSSProperties = {
  fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
  padding: '6px 14px', borderRadius: 4,
  background: '#084838', color: '#FFFFFF', border: 'none', cursor: 'pointer',
};
