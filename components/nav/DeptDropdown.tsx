'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

export interface DeptDropdownItem {
  label: string;
  href: string;
}

export interface DeptDropdownProps {
  dept: string;
  items: DeptDropdownItem[];
}

export default function DeptDropdown({ dept, items }: DeptDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        style={{
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.25)',
          color: '#fff',
          padding: '6px 14px',
          borderRadius: 6,
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          whiteSpace: 'nowrap',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {dept} <span style={{ fontSize: 10, opacity: 0.7 }}>▾</span>
      </button>

      {open && (
        <ul
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            minWidth: 180,
            background: '#111',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8,
            listStyle: 'none',
            margin: 0,
            padding: '4px 0',
            zIndex: 1000,
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          }}
        >
          {items.map((item) => (
            <li key={item.href} role="option" aria-selected={false}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                style={{
                  display: 'block',
                  padding: '9px 16px',
                  color: 'rgba(255,255,255,0.85)',
                  textDecoration: 'none',
                  fontSize: 14,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background =
                    'rgba(255,255,255,0.08)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                }}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
