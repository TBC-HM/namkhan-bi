// app/revenue/compset/legacy/page.tsx
// Legacy stub — the live compset page is now the primitives-based version at /revenue/compset.
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function CompsetLegacyPage() {
  return (
    <div style={{ padding: 24, color: 'var(--ink-soft)' }}>
      <h1 style={{ fontSize: 'var(--t-lg)', marginBottom: 12 }}>Revenue · Compset · legacy archive</h1>
      <p style={{ fontSize: 'var(--t-sm)' }}>
        The legacy compset page (CompactAgentHeader + PropertyTable + AnalyticsBlock) has been
        replaced by the primitive-based version at{' '}
        <Link href="/revenue/compset" style={{ color: 'var(--brass)' }}>/revenue/compset</Link>.
      </p>
    </div>
  );
}
