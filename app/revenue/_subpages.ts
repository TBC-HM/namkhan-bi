// app/revenue/_subpages.ts
// Re-export from canonical DEPT_CFG so the strip is identical across the
// dept entry page (rendered by <DeptEntry/>) and every sub-route (rendered
// by <Page subPages>). PBS 2026-05-09: "main menu changes when I change
// tabs — make sure they always sit on the same place".

import { DEPT_CFG } from '@/lib/dept-cfg';
export const REVENUE_SUBPAGES = DEPT_CFG.revenue.subPages;
