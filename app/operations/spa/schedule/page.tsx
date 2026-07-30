// app/operations/spa/schedule/page.tsx — Namkhan spa schedule (spa module v1).
import ScheduleView from '../_shared/ScheduleView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { searchParams: Record<string, string | string[] | undefined>; }

export default async function SpaSchedulePage({ searchParams }: Props) {
  return <ScheduleView propertyId={260955} searchParams={searchParams} />;
}
