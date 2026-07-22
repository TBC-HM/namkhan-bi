// app/operations/inventory/suppliers/page.tsx
//
// Legacy route → tenant-scoped canonical. All chrome/design lives at
// /h/[property_id]/operations/inventory/suppliers. This file is a pure redirect;
// the sibling _components and any dynamic child routes are preserved.

import { redirect } from 'next/navigation';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const dynamic = 'force-dynamic';

export default function Page() {
  redirect(`/h/${NAMKHAN_PROPERTY_ID}/operations/inventory/suppliers`);
}
