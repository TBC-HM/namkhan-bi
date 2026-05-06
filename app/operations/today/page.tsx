// app/operations/today/page.tsx
// Permanent redirect — Today merged into /operations on 2026-05-04. Old links keep working.

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function OperationsTodayRedirect(): never {
  redirect('/operations');
}
