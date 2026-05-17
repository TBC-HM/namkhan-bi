// lib/reports/index.ts
// Registry of template-code → render function. All templates live in this dir
// and export a `render(params, supabase)` async function returning
// { html, subject, summary_text }.

import type { RenderFn } from './_shared';
import { render as testRender } from './test';
import { render as paceRender } from './pace';
import { render as dailyRevenueRender } from './daily_revenue';
import { render as weeklyPnlRender } from './weekly_pnl';
import { render as varianceRender } from './variance';
import { render as channelMixRender } from './channel_mix';
import { render as labourCostRender } from './labour_cost';
import { render as inboxDigestRender } from './inbox_digest';
import { render as itDigestRender } from './it_digest';

export const REPORT_REGISTRY: Record<string, RenderFn> = {
  test: testRender,
  pace: paceRender,
  daily_revenue: dailyRevenueRender,
  weekly_pnl: weeklyPnlRender,
  variance: varianceRender,
  channel_mix: channelMixRender,
  labour_cost: labourCostRender,
  inbox_digest: inboxDigestRender,
  it_digest: itDigestRender,
};

export type { RenderFn, RenderResult, RenderParams } from './_shared';
