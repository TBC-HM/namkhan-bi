'use client';

import Link from 'next/link';
import PageHeader from '@/components/layout/PageHeader';

// ---------------------------------------------------------------------------
// Operations entry page — /operations
// Pillar landing: surfaces quick-nav cards for each Operations sub-section.
// No DB call needed here — each child page fetches its own data.
// ---------------------------------------------------------------------------

const NAV_CARDS: { href: string; title: string; description: string; emoji: string }[] = [
  {
    href: '/operations/staff',
    title: 'Staff & Payroll',
    description: 'Headcount, payroll breakdown, department summary and trend.',
    emoji: '👤',
  },
  {
    href: '/operations/inventory',
    title: 'Inventory',
    description: 'Room supplies, F&B stock levels and low-stock alerts.',
    emoji: '📦',
  },
];

export default function OperationsPage() {
  return (
    <main style={{ padding: '0 0 48px' }}>
      <PageHeader
        pillar="Operations"
        tab="Home"
        title="Operations"
        lede="Manage your team, payroll and inventory from one place."
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 20,
          padding: '28px 24px 0',
        }}
      >
        {NAV_CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div
              style={{
                border: '1px solid var(--border, #e5e7eb)',
                borderRadius: 10,
                padding: '24px 20px',
                background: 'var(--card-bg, #fff)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                cursor: 'pointer',
                transition: 'box-shadow 0.15s ease',
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLDivElement).style.boxShadow =
                  '0 4px 16px rgba(0,0,0,0.08)')
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLDivElement).style.boxShadow = 'none')
              }
            >
              <span style={{ fontSize: 32 }}>{card.emoji}</span>
              <strong style={{ fontSize: 16, fontWeight: 600 }}>{card.title}</strong>
              <span style={{ fontSize: 13, color: 'var(--muted, #6b7280)', lineHeight: 1.5 }}>
                {card.description}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
