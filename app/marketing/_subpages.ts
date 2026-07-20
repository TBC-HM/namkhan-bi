// app/marketing/_subpages.ts — canonical strip via DEPT_CFG.
import { DEPT_CFG } from '@/lib/dept-cfg';
// PBS 2026-07-20 · Socials posts engine appended to the Marketing strip.
export const MARKETING_SUBPAGES = [
  ...DEPT_CFG.marketing.subPages,
  { label: 'Socials', href: '/marketing/socials' },
];
