// PBS 2026-05-29 #59 — per-property wrapper for /revenue/rateplans
import RatePlansPage from '@/app/revenue/rateplans/page';
export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function Page({ params, searchParams }: { params: { property_id: string }; searchParams: Record<string, string | string[] | undefined> }) {
  const pid = Number(params.property_id);
  return <RatePlansPage searchParams={searchParams} propertyId={pid} />;
}
