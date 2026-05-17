// lib/reports/it_digest.ts
// Weekly IT digest using v_it_weekly_digest (already exists).

import type { RenderFn } from './_shared';
import {
  fmtNum,
  fmtMoneyDual,
  pageShell,
  resolveProperty,
  section,
  table,
  kpiGrid,
  paragraph,
} from './_shared';

export const render: RenderFn = async (params, supabase) => {
  const theme = resolveProperty(params.property_id);
  const { data } = await supabase.from('v_it_weekly_digest').select('*').limit(1);
  const row: any = (data && data[0]) || {};

  const top3: any[] = Array.isArray(row.top_3_by_impact) ? row.top_3_by_impact : [];
  const top3Rows = top3.slice(0, 3).map((t: any) => ({
    title: typeof t === 'string' ? t : t.title || t.name || JSON.stringify(t),
    impact:
      typeof t === 'object' && t
        ? t.impact || t.summary || t.description || ''
        : '',
  }));

  const summary_text =
    `${theme.property_name} IT digest · deploys staging ${row.deploys_staging ?? '—'} / prod ${row.deploys_prod ?? '—'}, ` +
    `tickets closed ${row.tickets_closed ?? '—'}, emergencies ${row.emergencies_escalated ?? '—'}, cost ${fmtMoneyDual(row.cost_usd, theme)}.`;

  const html = pageShell({
    theme,
    title: 'IT Digest',
    subtitle: 'Last 7 days',
    bodyHtml:
      section(
        'Deployment & ops',
        theme,
        kpiGrid(
          [
            { label: 'Deploys (prod)', value: fmtNum(row.deploys_prod) },
            { label: 'Deploys (staging)', value: fmtNum(row.deploys_staging) },
            { label: 'Background repairs', value: fmtNum(row.background_repairs) },
            { label: 'Tickets closed', value: fmtNum(row.tickets_closed) },
          ],
          theme,
        ),
      ) +
      section(
        'Quality & cost',
        theme,
        kpiGrid(
          [
            { label: 'Emergencies escalated', value: fmtNum(row.emergencies_escalated) },
            { label: 'Workers spawned', value: fmtNum(row.workers_spawned) },
            { label: 'Hallucinations caught', value: fmtNum(row.hallucinations_caught) },
            { label: 'Cost', value: fmtMoneyDual(row.cost_usd, theme) },
          ],
          theme,
        ),
      ) +
      section(
        'Top 3 by impact',
        theme,
        top3Rows.length > 0
          ? table(
              [
                { key: 'title', label: 'Item' },
                { key: 'impact', label: 'Impact' },
              ],
              top3Rows,
              theme,
            )
          : paragraph('No top-impact items recorded this week.', theme),
      ),
  });

  return {
    html,
    subject: `${theme.property_name} · IT digest · weekly`,
    summary_text,
  };
};
