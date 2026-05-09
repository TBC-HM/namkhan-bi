// app/sales/pipeline/page.tsx
// PBS 2026-05-09: "SCHOULD LEADS AND PIPELINE BE BETTER ON ONE PAGE ? IF SO
// PLEASE MAKE A SENSEFULL REDESIGN". → Pipeline merged into /sales/leads
// (cold prospects → outreach → quote → booking is one funnel, not two pages).
// This route now redirects to keep deep links working.

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function PipelinePage() {
  redirect('/sales/leads?view=pipeline');
}
