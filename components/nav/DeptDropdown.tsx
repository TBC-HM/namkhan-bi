'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

const DEPARTMENTS = [
  { label: 'Revenue',    href: '/revenue' },
  { label: 'Sales',      href: '/sales' },
  { label: 'Marketing',  href: '/marketing' },
  { label: 'Operations', href: '/operations' },
  { label: 'Guest',      href: '/guest' },
  { label: 'Finance',    href: '/finance' },
  { label: 'IT',         href: '/it' },
] as const;

interface DeptDropdownProps {
  /** Label shown on the trigger button. Defaults to "Departments ▾". */
  label?: string;
}

export default function DeptDropdown({ label = 'Departments ▾' }: DeptDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click-outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.25)',
          borderRadius: 6,
          color: '#fff',
          padding: '6px 14px',
          fontSize: 13,
          fontFamily: 'inherit',
          cursor: 'pointer',
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </button>

      {open && (
        <ul
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 999,
            margin: 0,
            padding: '6px 0',
            listStyle: 'none',
            background: '#111',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8,
            minWidth: 170,
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          }}
        >
          {DEPARTMENTS.map((dept) => (
            <li key={dept.href} role="option">
              <Link
                href={dept.href}
                onClick={() => setOpen(false)}
                style={{
                  display: 'block',
                  padding: '8px 18px',
                  color: '#e5e5e5',
                  textDecoration: 'none',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  letterSpacing: '0.02em',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background =
                    'rgba(255,255,255,0.08)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                }}
              >
                {dept.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
