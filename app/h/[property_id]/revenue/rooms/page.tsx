// app/h/[property_id]/revenue/rooms/page.tsx
// Rooms intelligence — thin wrapper that calls the generic registry renderer
// with the path-form page_slug. The container row in v_container_registry
// drives the entire page (tiles + drill). To change layout / metrics / drill
// columns, edit the registry row's columns_spec — NOT this file.

import PageRenderer from '@/app/_components/registry/PageRenderer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  params: { property_id: string };
  searchParams: Record<string, string | string[] | undefined>;
}

export default function RoomsIntelPage({ params, searchParams }: Props) {
  const propertyId = Number(params.property_id);
  return (
    <PageRenderer
      pageSlug="/h/[property_id]/revenue/rooms"
      propertyId={propertyId}
      title="Revenue · Rooms intelligence"
      subtitle="Category KPI tiles → granular room-type drill · driven by v_container_registry"
      searchParams={searchParams}
    />
  );
}
