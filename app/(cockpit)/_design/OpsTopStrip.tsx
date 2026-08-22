// app/(cockpit)/_design/OpsTopStrip.tsx
// PBS 2026-08-21 · Standalone Operations top-strip nav for sub-pages that
// don't (yet) wrap in DashboardPage. Renders OPERATIONS_SUBPAGES as
// tenant-scoped links + highlights the given active parent path.
"use client";

import Link from "next/link";
import { OPERATIONS_SUBPAGES } from "@/app/operations/_subpages";

interface Props {
  propertyId: number;
  /** parent path fragment used to mark active — e.g. '/maintenance' */
  activeSuffix: string;
}

export default function OpsTopStrip({ propertyId, activeSuffix }: Props) {
  const HAIR = '#E6DFCC';
  const INK = '#1B1B1B';
  const INK_M = '#5A5A5A';
  return (
    <div style={{
      display: 'flex', gap: 4, alignItems: 'center', overflowX: 'auto',
      borderBottom: `1px solid ${HAIR}`, padding: '10px 24px', marginBottom: 16,
      background: '#FFFFFF',
    }}>
      {OPERATIONS_SUBPAGES.map((sp) => {
        const href = sp.href.replace('/h/260955/', `/h/${propertyId}/`);
        const active = sp.href.endsWith(activeSuffix);
        return (
          <Link key={sp.href} href={href} style={{
            padding: '6px 8px', fontSize: 12,
            color: active ? '#FFFFFF' : INK,
            background: active ? INK : 'transparent',
            border: `1px solid ${active ? INK : HAIR}`,
            borderRadius: 4, textDecoration: 'none',
            fontWeight: active ? 700 : 500, whiteSpace: 'nowrap',
            letterSpacing: '0.02em',
          }}>
            {sp.label}
          </Link>
        );
      })}
    </div>
  );
}
