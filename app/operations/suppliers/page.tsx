// app/operations/suppliers/page.tsx
// Operations · Suppliers — thin wrapper around the shared SuppliersView.
// Threads OPERATIONS_SUBPAGES so the Operations sub-page strip shows up.

import SuppliersView from './_components/SuppliersView';
import { OPERATIONS_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function SuppliersPage() {
  return (
    <SuppliersView
      subPages={OPERATIONS_SUBPAGES}
      activeHrefSuffix="/operations/suppliers"
      surfaceLabel="Operations"
    />
  );
}
