// app/revenue/_shared/ChannelsShell.tsx
// Property-aware Channels dispatcher. PBS 2026-05-18: single source of truth —
// the Namkhan body (= app/revenue/channels/page.tsx default export) now accepts
// propertyId and renders the same JSX layout for both properties. Data flows
// through propertyId-aware lib functions (lib/data-channels.ts).

import NamkhanChannelsBody from '../channels/page';

export interface ChannelsShellProps {
  propertyId: number;
  searchParams: Record<string, string | string[] | undefined>;
}

export default function ChannelsShell({ propertyId, searchParams }: ChannelsShellProps) {
  return (
    <NamkhanChannelsBody
      searchParams={searchParams as any}
      propertyId={propertyId}
    />
  );
}
