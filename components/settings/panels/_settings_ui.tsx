// components/settings/panels/_settings_ui.tsx
// PBS 2026-07-03: shared micro-primitives for CRUD panels · keeps individual
// panels ~100 lines. Paper-white + hairline + ink · no dark tokens.
'use client';

import type { CSSProperties, ReactNode } from 'react';

export const btnPrimary: CSSProperties = { padding: '7px 14px', background: '#1F3A2E', color: '#FFFFFF', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
export const btnGhost:   CSSProperties = { padding: '6px 12px', background: '#FFFFFF', color: '#1B1B1B', border: '1px solid #E6DFCC', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' };
export const btnDanger:  CSSProperties = { padding: '6px 12px', background: '#B03826', color: '#FFFFFF', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
export const inputStyle: CSSProperties = { width: '100%', padding: '7px 10px', border: '1px solid #E6DFCC', borderRadius: 4, background: '#FFFFFF', color: '#1B1B1B', fontSize: 13, fontFamily: 'inherit' };
export const fieldLabel: CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A5A5A', marginBottom: 4 };
export const sectionTitle: CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1F3A2E', margin: '0 0 12px' };
export const rowStyle:   CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 4 };
export const th: CSSProperties = { padding: '6px 10px', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#000', textAlign: 'left' };
export const tdL: CSSProperties = { padding: '5px 10px', fontSize: 12, color: '#1B1B1B' };
export const tdR: CSSProperties = { padding: '5px 10px', fontSize: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#1B1B1B' };

export function pill(bg: string, color: string): CSSProperties {
  return { padding: '1px 8px', borderRadius: 99, background: bg, color, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' };
}

export function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div style={{ margin: '12px 20px', padding: 10, background: '#FBE8E4', border: '1px solid #E8B7AB', borderRadius: 4, fontSize: 12, color: '#8A2419' }}>
      {error}
    </div>
  );
}

export function LabeledInput({ label, value, onChange, type = 'text', placeholder, span = 1 }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; span?: 1 | 2 | 3;
}) {
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      <div style={fieldLabel}>{label}</div>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

export function LabeledTextarea({ label, value, onChange, rows = 3, span = 1 }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number; span?: 1 | 2 | 3;
}) {
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      <div style={fieldLabel}>{label}</div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
    </div>
  );
}

export function LabeledSelect({ label, value, onChange, options, span = 1 }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; span?: 1 | 2 | 3;
}) {
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      <div style={fieldLabel}>{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
        {options.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
      </select>
    </div>
  );
}

export function LabeledCheckbox({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#1B1B1B', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function ArrayInput({ label, value, onChange, placeholder, span = 1 }: {
  label: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string; span?: 1 | 2 | 3;
}) {
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      <div style={fieldLabel}>{label}</div>
      <input
        type="text"
        value={(value ?? []).join(', ')}
        onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
        placeholder={placeholder ?? 'comma-separated'}
        style={inputStyle}
      />
    </div>
  );
}

export function FormShell({ title, onSave, onCancel, busy, children }: {
  title: string; onSave: () => void; onCancel: () => void; busy: boolean; children: ReactNode;
}) {
  return (
    <div style={{ padding: 20, background: '#FAFAF7', borderBottom: '1px solid #E6DFCC' }}>
      <div style={{ ...sectionTitle, marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        {children}
      </div>
      <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
        <button type="button" onClick={onSave} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.5 : 1 }}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={onCancel} disabled={busy} style={btnGhost}>Cancel</button>
      </div>
    </div>
  );
}

export function DeleteConfirm({ show, busy, onConfirm, onCancel }: {
  show: boolean; busy: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  if (!show) return null;
  return (
    <>
      <button type="button" onClick={onConfirm} disabled={busy} style={btnDanger}>{busy ? '…' : 'Confirm'}</button>
      <button type="button" onClick={onCancel} style={btnGhost}>Cancel</button>
    </>
  );
}
