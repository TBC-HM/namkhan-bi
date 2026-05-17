// app/finance/_subpages.ts — canonical strip via DEPT_CFG.
//
// `FINANCE_SUBPAGES`            — global / Namkhan-namespace strip (legacy hrefs).
// `financeSubPagesForProperty`  — property-scoped strip with the per-property
//                                 inbox appended as the last entry. Use this
//                                 from `app/h/[property_id]/finance/*` pages
//                                 so Cifra/Intel can jump to agent deliveries
//                                 directly from any finance surface.

import { DEPT_CFG } from '@/lib/dept-cfg';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';

interface SubPageLink { label: string; href: string }

export const FINANCE_SUBPAGES: SubPageLink[] = DEPT_CFG.finance.subPages;

// PBS 2026-05-15: Reports is now in FINANCE_SUBPAGES with a Namkhan-default
// href that the rewriter swaps per-property. So this helper just rewrites
// the whole strip — Reports is no longer appended separately.
export function financeSubPagesForProperty(propertyId: number | string): SubPageLink[] {
  const id = typeof propertyId === 'string' ? parseInt(propertyId, 10) : propertyId;
  return rewriteSubPagesForProperty(FINANCE_SUBPAGES, id);
}
