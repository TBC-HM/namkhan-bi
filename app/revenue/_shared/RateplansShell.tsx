// app/revenue/_shared/RateplansShell.tsx
// Property-aware Rate Plans dispatcher. PBS 2026-05-18: single source of truth.
// app/revenue/rateplans/page.tsx now accepts propertyId and renders the same
// JSX layout for both properties.

import NamkhanRateplansBody from '../rateplans/page';

export interface RateplansShellProps {
  propertyId: number;
  searchParams: Record<string, string | string[] | undefined>;
}

export default function RateplansShell({ propertyId, searchParams }: RateplansShellProps) {
  return (
    <NamkhanRateplansBody
      searchParams={searchParams as any}
      propertyId={propertyId}
    />
  );
}
