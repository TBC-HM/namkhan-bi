// app/finance/legal/docs/page.tsx
// Legacy unscoped surface → 307 redirect to the canonical property-scoped
// route. Honors §0.3 universal tenant URL rule (every dept/sub URL MUST be
// under /h/[property_id]/...).

import { redirect } from 'next/navigation';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const dynamic = 'force-static';

export default function FinanceLegalDocsRedirect() {
  redirect(`/h/${NAMKHAN_PROPERTY_ID}/finance/legal/docs`);
}
