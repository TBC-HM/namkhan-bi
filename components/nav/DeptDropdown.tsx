'use client';

/**
 * DeptDropdown — shared department selector (slice of #159).
 *
 * Usage:
 *   <DeptDropdown value={dept} onChange={setDept} />
 *
 * Reads `?dept=` from the URL when used as a URL-param-driven picker.
 * Controlled usage: pass `value` + `onChange` props directly.
 *
 * Dept list mirrors USALI departments used across namkhan-bi pages:
 *   Rooms | F&B | Spa | Activities | Mekong Cruise | Other Operated |
 *   A&G | Sales & Marketing | POM | Utilities | Mgmt Fees | Undistributed
 *
 * Styled exclusively via CSS vars — no hardcoded hex (DESIGN_NAMKHAN_BI rule §4).
 */

import React, { useCallback, useId } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

// ─── USALI department list (ordered: operated → undistributed) ──────────────

export const ALL_DEPT_VALUE = '__all__';

export interface DeptOption {
  value: string;
  label: string;
  group: 'Operated' | 'Undistributed';
}

export const DEPT_OPTIONS: DeptOption[] = [
  // Operated departments
  { value: 'Rooms',           label: 'Rooms',           group: 'Operated' },
  { value: 'F&B',             label: 'F&B',             group: 'Operated' },
  { value: 'Spa',             label: 'Spa',             group: 'Operated' },
  { value: 'Activities',      label: 'Activities',      group: 'Operated' },
  { value: 'Mekong Cruise',   label: 'Mekong Cruise',   group: 'Operated' },
  { value: 'Other Operated',  label: 'Other Operated',  group: 'Operated' },
  // Undistributed departments
  { value: 'A&G',             label: 'A&G',             group: 'Undistributed' },
  { value: 'Sales & Marketing', label: 'Sales & Marketing', group: 'Undistributed' },
  { value: 'POM',             label: 'POM',             group: 'Undistributed' },
  { value: 'Utilities',       label: 'Utilities',       group: 'Undistributed' },
  { value: 'Mgmt Fees',       label: 'Mgmt Fees',       group: 'Undistributed' },
];

// ─── Props ───────────────────────────────────────────────────────────────────

export interface DeptDropdownProps {
  /** Currently selected dept value (controlled). Defaults to ALL_DEPT_VALUE. */
  value?: string;
  /** Fired when the user picks a new dept. */
  onChange?: (dept: string) => void;
  /** Show an "All departments" option. Default true. */
  showAll?: boolean;
  /** Label shown in the <label> element. Default "Department". */
  label?: string;
  /** Hide the <label> element visually (still accessible). Default false. */
  labelHidden?: boolean;
  /**
   * If true, the component manages its own state via the ?dept= URL search
   * param (push to router on change). Ignores `value`/`onChange`.
   * Default false.
   */
  urlSync?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DeptDropdown({
  value,
  onChange,
  showAll = true,
  label = 'Department',
  labelHidden = false,
  urlSync = false,
}: DeptDropdownProps) {
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL-sync mode: derive value from ?dept= param
  const urlDept = urlSync ? (searchParams.get('dept') ?? ALL_DEPT_VALUE) : null;
  const resolvedValue = urlSync ? urlDept! : (value ?? ALL_DEPT_VALUE);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const next = e.target.value;
      if (urlSync) {
        const params = new URLSearchParams(searchParams.toString());
        if (next === ALL_DEPT_VALUE) {
          params.delete('dept');
        } else {
          params.set('dept', next);
        }
        router.push(`${pathname}?${params.toString()}`);
      } else {
        onChange?.(next);
      }
    },
    [urlSync, searchParams, pathname, router, onChange],
  );

  return (
    <div style={styles.wrapper}>
      <label
        htmlFor={id}
        style={labelHidden ? styles.srOnly : styles.label}
      >
        {label}
      </label>
      <select
        id={id}
        value={resolvedValue}
        onChange={handleChange}
        style={styles.select}
      >
        {showAll && (
          <option value={ALL_DEPT_VALUE}>All departments</option>
        )}
        <optgroup label="Operated">
          {DEPT_OPTIONS.filter((d) => d.group === 'Operated').map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </optgroup>
        <optgroup label="Undistributed">
          {DEPT_OPTIONS.filter((d) => d.group === 'Undistributed').map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  );
}

// ─── Styles (CSS vars only — no hardcoded hex per DESIGN_NAMKHAN_BI §4) ─────

const styles = {
  wrapper: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 4,
  },
  label: {
    fontFamily: 'var(--mono)',
    fontSize: 'var(--t-xs)',
    letterSpacing: 'var(--ls-extra)',
    color: 'var(--ink)',
    textTransform: 'uppercase' as const,
    userSelect: 'none' as const,
  },
  select: {
    fontFamily: 'var(--sans)',
    fontSize: 'var(--t-sm)',
    color: 'var(--ink)',
    background: 'var(--surf-2)',
    border: '1px solid var(--rule)',
    borderRadius: 4,
    padding: '6px 28px 6px 10px',
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    cursor: 'pointer',
    minWidth: 180,
  },
  /** Visually hidden but accessible */
  srOnly: {
    position: 'absolute' as const,
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden' as const,
    clip: 'rect(0,0,0,0)',
    whiteSpace: 'nowrap' as const,
    border: 0,
  },
} satisfies Record<string, React.CSSProperties>;
