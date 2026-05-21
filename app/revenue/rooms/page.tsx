// app/revenue/rooms/page.tsx
// Default-property route at /revenue/rooms. Middleware strips /h/260955/*
// to /* for Namkhan, so this is the Namkhan render path. Donna keeps the
// /h/1000001/revenue/rooms path (handled by the parallel page wrapper).

import PageRenderer from '@/app/_components/registry/PageRenderer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

export default function RoomsIntelPage({ searchParams }: Props) {
  return (
    <PageRenderer
      pageSlug="/h/[property_id]/revenue/rooms"
      propertyId={260955}
      title="Revenue · Rooms intelligence"
      subtitle="Category KPI tiles → granular room-type drill · driven by v_container_registry"
      searchParams={searchParams}
    />
  );
}
