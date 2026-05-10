/**
 * <MultiSelectFilter>
 * Popover-based multi-select checkbox list.
 * Writes values to URL via the setFilter callback from useRevenueFilters.
 * Shows a badge count when selections are active.
 */
'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './MultiSelectFilter.module.css';

interface Props {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  onClear: () => void;
  loading?: boolean;
}

export function MultiSelectFilter({ label, options, selected, onChange, onClear, loading }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function toggle(value: string) {
    const next = selected.includes(value)
      ? selected.filter(v => v !== value)
      : [...selected, value];
    onChange(next);
  }

  const count = selected.length;

  return (
    <div className={styles.root} ref={ref}>
      <button
        className={styles.trigger}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        type="button"
      >
        <span className={styles.label}>{label}</span>
        {count > 0 && <span className={styles.badge}>{count}</span>}
        <span className={styles.chevron} aria-hidden>▾</span>
      </button>

      {open && (
        <div className={styles.popover} role="listbox" aria-multiselectable="true">
          {loading && <p className={styles.loading}>Loading…</p>}

          {!loading && options.length === 0 && (
            <p className={styles.empty}>No options</p>
          )}

          {!loading && options.map(opt => (
            <label key={opt} className={styles.item}>
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
              />
              <span>{opt}</span>
            </label>
          ))}

          {count > 0 && (
            <button
              type="button"
              className={styles.clear}
              onClick={() => { onClear(); setOpen(false); }}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
