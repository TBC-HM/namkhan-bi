// app/holding/it2/modules/status/page.tsx
// 307 redirect to /holding/it2/modules/specs — ONE module surface truth
// (module-surface-slice-status-page-merge, 2026-08-08).
// The release ledger and cut-release form moved to /holding/it2/system/releases
// (System = fleet ops, matching Build Briefs relocation).

import { redirect } from 'next/navigation';

export default function ModulesStatusRedirect() {
  redirect('/holding/it2/modules/specs');
}