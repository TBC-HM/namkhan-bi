// app/marketing/media/_client/MediaHub.tsx
// PBS 2026-07-12 — Client tab strip for Media hub.
// PBS 2026-07-11 pm: added Library→AI Studio jump. Clicking "Send to AI" on
// any Library row switches to AI Studio and preselects that asset.
'use client';

import { useState } from 'react';
import LibraryTab from './LibraryTab';
import AiStudioTab from './AiStudioTab';
import VideoTab from './VideoTab';
import SettingsTab from './SettingsTab';

type TabKey = 'library' | 'ai' | 'video' | 'settings';

interface Props {
  propertyId: number;
  byTier: any[];
  mediaPage: any[];
  channelSpecs: any[];
  rulesActive: any[];
  aiGens: any[];
  videoEdits: any[];
  reality: any | null;
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'library',  label: 'Library'    },
  { key: 'ai',       label: 'AI Studio'  },
  { key: 'video',    label: 'Video'      },
  { key: 'settings', label: 'Settings ⚙' },
];

const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';

export default function MediaHub(props: Props) {
  const [tab, setTab] = useState<TabKey>('library');
  const [aiInitialAssetId, setAiInitialAssetId] = useState<string | null>(null);

  function handleSendToAi(assetId: string) {
    setAiInitialAssetId(assetId);
    setTab('ai');
  }

  return (
    <div>
      <div style={{ display:'flex', gap:4, borderBottom:'1px solid '+HAIR, marginBottom:16 }}>
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding:'10px 18px', fontSize:12, letterSpacing:'0.06em',
              textTransform:'uppercase', border:'none', background:'transparent',
              color: active ? FOREST : INK_M,
              borderBottom: active ? '2px solid ' + FOREST : '2px solid transparent',
              fontWeight: active ? 700 : 500, cursor:'pointer', marginBottom:-1,
            }}>{t.label}</button>
          );
        })}
      </div>

      {tab === 'library'  && <LibraryTab  propertyId={props.propertyId} byTier={props.byTier} mediaPage={props.mediaPage} channelSpecs={props.channelSpecs} onSendToAi={handleSendToAi} />}
      {tab === 'ai'       && <AiStudioTab propertyId={props.propertyId} mediaPage={props.mediaPage} aiGens={props.aiGens} initialSourceAssetId={aiInitialAssetId} />}
      {tab === 'video'    && <VideoTab    propertyId={props.propertyId} mediaPage={props.mediaPage} channelSpecs={props.channelSpecs} videoEdits={props.videoEdits} />}
      {tab === 'settings' && <SettingsTab propertyId={props.propertyId} channelSpecs={props.channelSpecs} rulesActive={props.rulesActive} reality={props.reality} />}
    </div>
  );
}
