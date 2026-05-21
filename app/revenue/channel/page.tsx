// app/revenue/channel/page.tsx
// Canonical channel page (Namkhan default property).
// Same routing rationale as /revenue/leakage: middleware strips
// /h/260955/* -> /* so /revenue/channel is the Namkhan render path.
// /h/1000001/revenue/channel handles Donna.

import PageRenderer from '@/app/_components/registry/PageRenderer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function ChannelPage() {
  return (
    <PageRenderer
      pageSlug="channel"
      propertyId={260955}
      title="Revenue · Channel"
      subtitle="channel economics · source mix · driven by registry"
    />
  );
}
