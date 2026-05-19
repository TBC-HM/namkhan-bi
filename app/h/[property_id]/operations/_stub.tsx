// app/h/[property_id]/operations/_stub.tsx
// Shared Donna stub for operations sub-pages. Mirrors finance/_stub but
// on primitives. Redirects Namkhan to the legacy /operations/<sub> path.

import { redirect } from 'next/navigation';
import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

interface Props {
  propertyId: number;
  routeLabel: string;
  namkhanPath: string;
  hint?: string;
}

export default function OperationsStub({ propertyId, routeLabel, namkhanPath, hint }: Props) {
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect(namkhanPath);
  return (
    <DashboardPage
      title={`Operations · ${routeLabel}`}
      subtitle={`Donna · property_id=${propertyId} · awaiting per-property wiring`}
    >
      <Container
        title={`${routeLabel} · awaiting Donna feed`}
        subtitle={`Namkhan source: ${namkhanPath}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 720 }}>
          <p style={{ margin: 0, fontSize: 13 }}>
            This page is part of the Donna operations navigation but isn&apos;t wired to
            Donna&apos;s data yet. The canonical Namkhan view lives at{' '}
            <a href={namkhanPath} style={{ color: 'var(--primary, #1F3A2E)', fontWeight: 600 }}>{namkhanPath}</a>.
          </p>
          {hint && (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>{hint}</p>
          )}
        </div>
      </Container>
    </DashboardPage>
  );
}
