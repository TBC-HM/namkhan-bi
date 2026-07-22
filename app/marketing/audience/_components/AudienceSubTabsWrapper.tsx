'use client';
// app/marketing/audience/_components/AudienceSubTabsWrapper.tsx
// PBS 2026-07-21 · Sub-strip owner + client-side tab switcher.
// PBS 2026-07-22 · Contract sync — AudienceUnifiedClient gained initialTab +
//                  initialTiles props after this wrapper was written. This file
//                  is currently orphaned (marketing/audience/page.tsx imports
//                  AudienceUnifiedClient directly) but tsc still checks it, so
//                  we pass the new props here to keep the tree compiling.
// Renders <AudienceSubTabs> at the top and toggles between:
//   - <AudienceUnifiedClient>  (default, "audience" tab)
//   - <ScrapeEngineTab>        ("scrape" tab)
// Kept as a thin client wrapper so page.tsx stays a server component and
// keeps fetching v_marketing_audience server-side.

import { useState } from 'react';
import AudienceSubTabs, { type AudienceSubTabKey } from './AudienceSubTabs';
import AudienceUnifiedClient, {
  type AudienceRow,
  type GroupRow,
  type AudienceTiles,
} from './AudienceUnifiedClient';
import ScrapeEngineTab from './ScrapeEngineTab';

const ZERO_TILES: AudienceTiles = {
  total_subs: 0,
  mailable: 0,
  guests_sea: 0,
  guests_int: 0,
  returning_guests: 0,
  dmc: 0,
  responders: 0,
  prospects: 0,
  purged_bounced: 0,
  purged_unsubscribed: 0,
};

interface Props {
  initialRows: AudienceRow[];
  initialGroups: GroupRow[];
  initialSource: 'all' | 'subscribers' | 'prospects';
  initialTab: AudienceSubTabKey;
  initialTiles?: AudienceTiles;
}

export default function AudienceSubTabsWrapper({
  initialRows, initialGroups, initialSource, initialTab, initialTiles,
}: Props) {
  const [active, setActive] = useState<AudienceSubTabKey>(initialTab);

  return (
    <div>
      <AudienceSubTabs active={active} onChange={setActive} />
      {active === 'audience' ? (
        <AudienceUnifiedClient
          initialRows={initialRows}
          initialGroups={initialGroups}
          initialSource={initialSource}
          initialTab="table"
          initialTiles={initialTiles ?? ZERO_TILES}
        />
      ) : (
        <ScrapeEngineTab />
      )}
    </div>
  );
}
