'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeptPage {
  label: string;
  href: string;
}

export interface DeptDropdownProps {
  /** Current department slug — determines the trigger label and active item */
  dept: 'revenue' | 'sales' | 'marketing' | 'operations' | 'guest' | 'finance' | 'it';
  /** Override the trigger label (defaults to the dept display name with ▾) */
  triggerLabel?: string;
}

// ---------------------------------------------------------------------------
// Per-department sub-page definitions (ticket #159 spec)
// ---------------------------------------------------------------------------

const DEPT_LABEL: Record<DeptDropdownProps['dept'], string> = {
  revenue:    'Revenue',
  sales:      'Sales',
  marketing:  'Marketing',
  operations: 'Operations',
  guest:      'Guest',
  finance:    'Finance',
  it:         'IT',
};

const DEPT_PAGES: Record<DeptDropdownProps['dept'], DeptPage[]> = {
  revenue: [
    { label: 'Pulse',      href: '/revenue/pulse' },
    { label: 'Pace',       href: '/revenue/pace' },
    { label: 'Channels',   href: '/revenue/channels' },
    { label: 'Rate Plans', href: '/revenue/rate-plans' },
    { label: 'Pricing',    href: '/revenue/pricing' },
    { label: 'Comp Set',   href: '/revenue/comp-set' },
  ],
  sales: [
    { label: 'Inquiries', href: '/sales/inquiries' },
    { label: 'Bookings',  href: '/sales/bookings' },
    { label: 'B2B',       href: '/sales/b2b' },
    { label: 'Pipeline',  href: '/sales/pipeline' },
  ],
  marketing: [
    { label: 'Library',   href: '/marketing/library' },
    { label: 'Campaigns', href: '/marketing/campaigns' },
    { label: 'Reviews',   href: '/marketing/reviews' },
    { label: 'BDC',       href: '/marketing/bdc' },
  ],
  operations: [
    { label: 'Today',     href: '/operations/today' },
    { label: 'Restaurant',href: '/operations/restaurant' },
    { label: 'Spa',       href: '/operations/spa' },
    { label: 'Inventory', href: '/operations/inventory' },
    { label: 'Suppliers', href: '/operations/suppliers' },
  ],
  guest: [
    { label: 'Directory',   href: '/guest/directory' },
    { label: 'Pre-Arrival', href: '/guest/pre-arrival' },
    { label: 'Reviews',     href: '/guest/reviews' },
  ],
  finance: [
    { label: 'P&L',       href: '/finance/pnl' },
    { label: 'Cash Flow', href: '/finance/cash-flow' },
    { label: 'USALI',     href: '/finance/usali' },
    { label: 'Forecast',  href: '/finance/forecast' },
  ],
  it: [
    { label: 'Cockpit',  href: '/it/cockpit' },
    { label: 'Health',   href: '/it/health' },
    { label: 'Schedule', href: '/it/schedule' },
    { label: 'Logs',     href: '/it/logs' },
    { label: 'Cost',     href: '/it/cost' },
  ],
};

// ---------------------------------------------------------------------------
// Styles (inline — no extra deps)
// ---------------------------------------------------------------------------

const BRASS = '#C9A96E';

const triggerStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 14px',
  background: 'transparent',
  border: `1px solid ${BRASS}`,
  borderRadius: 6,
  color: BRASS,
  fontFamily: 'var(--font-mono, "Courier New", monospace)',
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '0.05em',
  textTransform: 'uppercase' as const,
  cursor: 'pointer',
  whiteSpace: 'nowrap' as const,
  userSelect: 'none' as const,
};

const menuStyle: React.CSSProperties = {
  position: 'absolute' as const,
  top: 'calc(100% + 6px)',
  left: 0,
  zIndex: 9999,
  minWidth: 180,
  background: '#111',
  border: `1px solid ${BRASS}`,
  borderRadius: 8,
  padding: '6px 0',
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
};

const itemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '9px 18px',
  background: 'transparent',
  border: 'none',
  color: '#e5e5e5',
  fontFamily: 'var(--font-mono, "Courier New", monospace)',
  fontSize: 12,
  letterSpacing: '0.04em',
  textAlign: 'left' as const,
  cursor: 'pointer',
  textTransform: 'uppercase' as const,
};

const itemHoverStyle: React.CSSProperties = {
  background: 'rgba(201,169,110,0.12)',
  color: BRASS,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DeptDropdown({ dept, triggerLabel }: DeptDropdownProps) {
  const [open, setOpen] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const label = triggerLabel ?? `${DEPT_LABEL[dept]} ▾`;
  const pages = DEPT_PAGES[dept];

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      {/* Trigger */}
      <button
        type="button"
        style={triggerStyle}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {label}
      </button>

      {/* Dropdown menu */}
      {open && (
        <div role="listbox" style={menuStyle}>
          {pages.map((page, idx) => (
            <button
              key={page.href}
              role="option"
              aria-selected={false}
              type="button"
              style={{
                ...itemStyle,
                ...(hoveredIdx === idx ? itemHoverStyle : {}),
              }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={() => navigate(page.href)}
            >
              {page.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
