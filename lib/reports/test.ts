// lib/reports/test.ts
// Smoke template — returns a 1-line HTML body so the run endpoint can be
// exercised without depending on any real data.

import type { RenderFn } from './_shared';
import { pageShell, paragraph, resolveProperty } from './_shared';

export const render: RenderFn = async (params) => {
  const theme = resolveProperty(params.property_id);
  const subject = `${theme.property_name} · report smoke OK`;
  const summary_text = `Smoke OK for property ${theme.property_id} at ${new Date().toISOString()}.`;
  const html = pageShell({
    theme,
    title: 'Report smoke test',
    subtitle: summary_text,
    bodyHtml: paragraph('If you can read this, /api/reports/run is alive.', theme),
  });
  return { html, subject, summary_text };
};
