'use client';

// components/settings/FieldRenderer.tsx
// Maps a v_settings_field_schema row → form input. Highlights LOREM IPSUM
// placeholders so the owner sees what's still missing.

import ArrayEditor from './ArrayEditor';
import JsonEditor from './JsonEditor';
import { ENUM_VALUES, isPlaceholder, type FieldSchemaRow } from '@/lib/settings';

interface Props {
  field: FieldSchemaRow;
  value: unknown;
  onChange: (next: unknown) => void;
}

export default function FieldRenderer({ field, value, onChange }: Props) {
  const placeholder = isPlaceholder(value);
  const inputClass = `settings-input${placeholder ? ' settings-input-placeholder' : ''}`;

  // string-coerce display value for plain text inputs
  const sval = value == null ? '' : String(value);

  const Label = (
    <label className="settings-label">
      {field.label}
      {!field.nullable && <span className="settings-required">*</span>}
      {placeholder && (
        <span className="settings-placeholder-flag">⚠ placeholder · needs real value</span>
      )}
    </label>
  );

  // textarea / long content gets full row
  const wide =
    field.input_type === 'textarea' ||
    field.input_type === 'json' ||
    field.input_type === 'array' ||
    field.column_name === 'long_description' ||
    field.column_name === 'short_description';

  const wrapStyle = wide ? { gridColumn: '1 / -1' } : undefined;

  switch (field.input_type) {
    case 'textarea':
      return (
        <div style={wrapStyle}>
          {Label}
          <textarea
            className={inputClass}
            style={{ minHeight: 100 }}
            value={sval}
            onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
          />
        </div>
      );

    case 'array':
      return (
        <div style={wrapStyle}>
          {Label}
          <ArrayEditor
            value={Array.isArray(value) ? (value as string[]) : []}
            onChange={(v) => onChange(v)}
          />
        </div>
      );

    case 'json':
      return (
        <div style={wrapStyle}>
          {Label}
          <JsonEditor value={value} onChange={onChange} />
        </div>
      );

    case 'toggle':
      return (
        <div>
          {Label}
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            style={{ height: 18, width: 18 }}
          />
        </div>
      );

    case 'number':
      return (
        <div>
          {Label}
          <input
            type="number"
            className={inputClass}
            value={sval}
            onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          />
        </div>
      );

    case 'color':
      return (
        <div>
          {Label}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="color"
              value={sval || '#084838'}
              onChange={(e) => onChange(e.target.value)}
              style={{ height: 32, width: 48, border: '1px solid var(--line)', padding: 0 }}
            />
            <input
              className={inputClass}
              style={{ flex: 1 }}
              value={sval}
              onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
              placeholder="#RRGGBB"
            />
          </div>
        </div>
      );

    case 'url':
      return (
        <div style={wrapStyle}>
          {Label}
          <input
            type="url"
            className={inputClass}
            value={sval}
            onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
            placeholder="https://"
          />
        </div>
      );

    case 'date':
      return (
        <div>
          {Label}
          <input
            type="date"
            className={inputClass}
            value={sval ? sval.slice(0, 10) : ''}
            onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
          />
        </div>
      );

    case 'time':
      return (
        <div>
          {Label}
          <input
            type="time"
            className={inputClass}
            value={sval ? sval.slice(0, 5) : ''}
            onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
          />
        </div>
      );

    case 'datetime':
      return (
        <div>
          {Label}
          <input
            type="datetime-local"
            className={inputClass}
            value={sval ? sval.slice(0, 16) : ''}
            onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
          />
        </div>
      );

    case 'enum': {
      const opts = ENUM_VALUES[field.udt_name] ?? [];
      return (
        <div>
          {Label}
          <select
            className={inputClass}
            value={sval}
            onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
          >
            <option value="">—</option>
            {opts.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      );
    }

    default:
      // text, fallback
      return (
        <div>
          {Label}
          <input
            className={inputClass}
            value={sval}
            onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
          />
        </div>
      );
  }
}
