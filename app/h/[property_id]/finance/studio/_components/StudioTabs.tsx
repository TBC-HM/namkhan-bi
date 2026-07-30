'use client';

// StudioTabs — r2 shell around the Studio surfaces:
// Builder (canon grid over gold views) · Workbooks (registry §9.2) ·
// Scratch (from-scratch sheets §10.3) · Documents (user docs §10.2/§10.4).
// Wraps the untouched StudioClient so the builder stays a single concern.

import { useState } from 'react';
import type { StudioCatalogEntry, StudioTemplateRow } from '@/lib/studio/types';
import StudioClient from './StudioClient';
import WorkbooksPanel from './WorkbooksPanel';
import ScratchSheet from './ScratchSheet';
import UserDocsPanel from './UserDocsPanel';
import { UI } from './studioUi';

type Tab = 'builder' | 'workbooks' | 'scratch' | 'documents';

interface Props {
  propertyId: number;
  catalog: StudioCatalogEntry[];
  initialTemplates: StudioTemplateRow[];
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'builder', label: 'Builder' },
  { key: 'workbooks', label: 'Workbooks' },
  { key: 'scratch', label: 'Scratch sheets' },
  { key: 'documents', label: 'My documents' },
];

export default function StudioTabs({ propertyId, catalog, initialTemplates }: Props) {
  const [tab, setTab] = useState<Tab>('builder');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            style={tab === t.key ? UI.chipOn : UI.chip}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'builder' && (
        <StudioClient propertyId={propertyId} catalog={catalog} initialTemplates={initialTemplates} />
      )}
      {tab === 'workbooks' && <WorkbooksPanel scope="property" propertyId={propertyId} />}
      {tab === 'scratch' && <ScratchSheet scope="property" propertyId={propertyId} />}
      {tab === 'documents' && <UserDocsPanel level="property" propertyId={propertyId} />}
    </div>
  );
}
