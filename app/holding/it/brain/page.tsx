// app/holding/it/brain/page.tsx
// PBS 2026-07-24: the Brain console moved to /h/[property_id]/settings/brain.
// PBS 2026-08-19: that settings console was RETIRED — brain access is the floating
// panel only — so this path had been 307-redirecting straight into a notFound().
// 2026-09-09: repointed at the surviving holding brain-pipeline surface (document
// families + subtypes drive indexing). BrainClient lives in components/brain/.

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function BrainPage() {
  redirect('/holding/settings/documents');
}
