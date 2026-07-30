// app/operations/spa/catalogue/page.tsx — Namkhan spa treatment catalogue (spa module v1).
import CatalogueView from '../_shared/CatalogueView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SpaCataloguePage() {
  return <CatalogueView propertyId={260955} />;
}
