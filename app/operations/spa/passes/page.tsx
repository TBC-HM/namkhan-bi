// app/operations/spa/passes/page.tsx — Namkhan spa passes & packages (spa module v1, gap 6).
import PassesView from '../_shared/PassesView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SpaPassesPage() {
  return <PassesView propertyId={260955} />;
}
