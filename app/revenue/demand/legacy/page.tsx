// app/revenue/demand/legacy/page.tsx
// Legacy stub — the live demand page is now the primitives-based version at /revenue/demand.
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function DemandLegacyPage() {
  return (
    <div style={{ padding: 24, color: 'var(--ink-soft)' }}>
      <h1 style={{ fontSize: 'var(--t-lg)', marginBottom: 12 }}>Revenue · Demand · legacy archive</h1>
      <p style={{ fontSize: 'var(--t-sm)' }}>
        The legacy Demand page has been replaced by the primitives-based version at{' '}
        <Link href="/revenue/demand" style={{ color: 'var(--brass)' }}>/revenue/demand</Link>.
      </p>
    </div>
  );
}
