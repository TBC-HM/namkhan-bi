// app/h/[property_id]/finance/_stub.tsx
// 2026-05-19 refactor onto @/app/(cockpit)/_design primitives.
// Shared stub for Donna finance sub-pages awaiting per-property wiring.

import { redirect } from 'next/navigation';
import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

interface Props {
  propertyId: number;
  routeLabel: string;
  namkhanPath: string;
  hint?: string;
}

export default function FinanceStub({ propertyId, routeLabel, namkhanPath, hint }: Props) {
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect(namkhanPath);

  return (
    <DashboardPage
      title={`Finance · ${routeLabel}`}
      subtitle={`Donna · property_id=${propertyId} · per-Donna wiring pending`}
    >
      <Container
        title={`${routeLabel} · awaiting Donna feed`}
        subtitle={`Namkhan source: ${namkhanPath}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 720 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink, #1B1B1B)' }}>
            This page is part of the Donna finance navigation but isn&apos;t wired to
            Donna&apos;s data yet. The canonical implementation lives at{' '}
            <a href={namkhanPath} style={{ color: 'var(--primary, #1F3A2E)', fontWeight: 600 }}>{namkhanPath}</a>
            {' '}(Namkhan-scoped). Rather than show Namkhan numbers under a Donna URL,
            we stop here.
          </p>
          {hint && (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>{hint}</p>
          )}
          <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-soft, #5A5A5A)' }}>
            See <a href={`/h/${propertyId}/finance/pnl`} style={{ color: 'var(--primary, #1F3A2E)' }}>Donna P&amp;L</a>
            {' '}for the reference per-property implementation pattern.
          </p>
        </div>
      </Container>
    </DashboardPage>
  );
}
