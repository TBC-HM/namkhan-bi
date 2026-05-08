'use client';

/**
 * DeptDropdown — shared navigation component
 * Slice of ticket #159: renders a styled "Departments ▾" dropdown
 * linking to all 7 department entry pages.
 *
 * Usage:
 *   import DeptDropdown from '@/components/nav/DeptDropdown';
 *   <DeptDropdown />
 *
 * Optional props:
 *   current  — the slug of the active dept (highlights that item)
 *   label    — override button label (default: "Departments")
 */

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

export interface DeptLink {
  label: string;
  slug: string;
  href: string;
}

export const DEPARTMENTS: DeptLink[] = [
  { label: 'Revenue',    slug: 'revenue',    href: '/revenue' },
  { label: 'Sales',      slug: 'sales',      href: '/sales' },
  { label: 'Marketing',  slug: 'marketing',  href: '/marketing' },
  { label: 'Operations', slug: 'operations', href: '/operations' },
  { label: 'Guest',      slug: 'guest',      href: '/guest' },
  { label: 'Finance',    slug: 'finance',    href: '/finance' },
  { label: 'IT',         slug: 'it',         href: '/it' },
];

interface DeptDropdownProps {
  /** slug of current active dept — highlights that entry */
  current?: string;
  /** override button label */
  label?: string;
}

export default function DeptDropdown({ current, label = 'Departments' }: DeptDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click-outside
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('keydown', handleKey);
    }
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 14px',
          background: 'var(--surface-2, #111)',
          border: '1px solid var(--border, #2a2a2a)',
          borderRadius: 6,
          color: 'var(--text-primary, #f0f0f0)',
          fontFamily: 'var(--sans, "Inter Tight", sans-serif)',
          fontSize: 'var(--t-md, 13px)',
          letterSpacing: 'var(--ls-loose, 0.06em)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            transition: 'transform 200ms',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            fontSize: 10,
            opacity: 0.7,
          }}
        >
          ▾
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Select department"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            minWidth: 180,
            margin: 0,
            padding: '6px 0',
            listStyle: 'none',
            background: 'var(--surface-2, #111)',
            border: '1px solid var(--border, #2a2a2a)',
            borderRadius: 6,
            boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
            zIndex: 200,
          }}
        >
          {DEPARTMENTS.map((dept) => {
            const isActive = dept.slug === current;
            return (
              <li
                key={dept.slug}
                role="option"
                aria-selected={isActive}
              >
                <Link
                  href={dept.href}
                  onClick={() => setOpen(false)}
                  style={{
                    display: 'block',
                    padding: '8px 18px',
                    fontFamily: 'var(--sans, "Inter Tight", sans-serif)',
                    fontSize: 'var(--t-md, 13px)',
                    letterSpacing: 'var(--ls-loose, 0.06em)',
                    color: isActive
                      ? 'var(--gold, #c9a84c)'
                      : 'var(--text-primary, #f0f0f0)',
                    textDecoration: 'none',
                    background: isActive
                      ? 'var(--surface-3, #1a1a1a)'
                      : 'transparent',
                    fontWeight: isActive ? 600 : 400,
                    transition: 'background 120ms, color 120ms',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLAnchorElement).style.background =
                        'var(--surface-3, #1a1a1a)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLAnchorElement).style.background =
                        'transparent';
                    }
                  }}
                >
                  {dept.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
