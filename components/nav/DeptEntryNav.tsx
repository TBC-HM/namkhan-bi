'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const DEPT_LABELS: Record<string, string> = {
  revenue: 'Revenue',
  sales: 'Sales',
  marketing: 'Marketing',
  operations: 'Operations',
  guest: 'Guest',
  finance: 'Finance',
  it: 'IT',
};

export default function DeptEntryNav() {
  const pathname = usePathname();
  const dept = pathname?.split('/')[1] ?? '';
  const label = DEPT_LABELS[dept] ?? dept;

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '20px 32px',
      background: '#000000',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
    }}>
      {/* N brand mark — left */}
      <span style={{
        fontFamily: 'TT Drugs, "Times New Roman", Georgia, serif',
        fontSize: '24px',
        fontWeight: 700,
        color: '#ffffff',
        letterSpacing: '0.05em',
      }}>
        N
      </span>

      {/* Home link — center */}
      <Link
        href="/architect"
        style={{
          fontFamily: 'Lora, Georgia, "Times New Roman", serif',
          fontSize: '13px',
          color: 'rgba(255,255,255,0.55)',
          textDecoration: 'none',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        Home
      </Link>

      {/* Dept breadcrumb — right */}
      <span style={{
        fontFamily: 'Lora, Georgia, "Times New Roman", serif',
        fontSize: '13px',
        color: 'rgba(255,255,255,0.40)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
    </nav>
  );
}
