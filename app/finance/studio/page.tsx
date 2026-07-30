// app/finance/studio/page.tsx
// Legacy unprefixed route — Namkhan-only 307 redirect per universal tenant
// URL law (canonical page: /h/260955/finance/studio).

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function LegacyFinanceStudioRedirect() {
  redirect('/h/260955/finance/studio');
}
