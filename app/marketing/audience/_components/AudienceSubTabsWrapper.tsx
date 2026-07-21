'use client';
// app/marketing/audience/_components/AudienceSubTabsWrapper.tsx
// PBS 2026-07-21 · Sub-strip owner + client-side tab switcher.
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
} from './AudienceUnifiedClient';
import ScrapeEngineTab from './ScrapeEngineTab';

interface Props {
  initialRows: AudienceRow[];
  initialGroups: GroupRow[];
  initialSource: 'all' | 'subscribers' | 'prospects';
  initialTab: AudienceSubTabKey;
}

export default function AudienceSubTabsWrapper({
  initialRows, initialGroups, initialSource, initialTab,
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
        />
      ) : (
        <ScrapeEngineTab />
      )}
    </div>
  );
}
