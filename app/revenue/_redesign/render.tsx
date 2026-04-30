// app/revenue/_redesign/render.tsx
// Server component that renders Federico's mockup tab content for a given slug.
// HTML chunks are imported as TS string-default modules so they get bundled (Vercel serverless functions
// don't have access to arbitrary fs paths at runtime).
// All `_redesign` files are colocated; the leading underscore keeps Next.js from routing them.

import tabPulse from './tabPulse';
import tabPace from './tabPace';
import tabChannels from './tabChannels';
import tabRateplans from './tabRateplans';
import tabPricing from './tabPricing';
import tabCompset from './tabCompset';
import tabAgentsettings from './tabAgentsettings';

export type MockupSlug =
  | 'pulse'
  | 'pace'
  | 'channels'
  | 'rateplans'
  | 'pricing'
  | 'compset'
  | 'agentsettings';

const TABS: Record<MockupSlug, string> = {
  pulse: tabPulse,
  pace: tabPace,
  channels: tabChannels,
  rateplans: tabRateplans,
  pricing: tabPricing,
  compset: tabCompset,
  agentsettings: tabAgentsettings,
};

export function MockupTab({ slug }: { slug: MockupSlug }) {
  // Mockup CSS hides .tab-content unless .active is present. Force-show this slug.
  const html = (TABS[slug] || '').replace(/class="tab-content"/, 'class="tab-content active"');
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
