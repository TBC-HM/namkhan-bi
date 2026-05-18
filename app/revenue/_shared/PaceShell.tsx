// app/revenue/_shared/PaceShell.tsx
// Property-aware Pace dispatcher. PBS 2026-05-18: single source of truth.
// NamkhanPaceBody (= app/revenue/pace/page.tsx default export) now accepts
// propertyId — same JSX shape, data filtered by property. Donna and Namkhan
// render identical layout.

import NamkhanPaceBody from '../pace/page';

export interface PaceShellProps {
  propertyId: number;
  searchParams: Record<string, string | string[] | undefined>;
}

export default function PaceShell({ propertyId, searchParams }: PaceShellProps) {
  return (
    <NamkhanPaceBody
      searchParams={searchParams as any}
      propertyId={propertyId}
    />
  );
}
