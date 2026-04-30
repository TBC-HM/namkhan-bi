// app/sales/page.tsx
// Pillar root — redirect to first sub-tab (Inquiries).

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function SalesIndex() {
  redirect('/sales/inquiries');
}
