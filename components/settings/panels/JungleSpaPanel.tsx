// components/settings/panels/JungleSpaPanel.tsx
// PBS 2026-07-18 v2 · Experiences → RetreatsPanel (real data), Treatments → SpaTreatmentsPanel.
'use client';

import { useState } from 'react';
import FacilitiesPanel from './FacilitiesPanel';
import RetreatsPanel from './RetreatsPanel';
import SpaTreatmentsPanel from './SpaTreatmentsPanel';

type Sub = 'facilities' | 'experiences' | 'treatments';

const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';

interface Props {
  facilities: any[];
  treatments: any[];
  retreats: any[];
  propertyId: number;
}

export default function JungleSpaPanel({ facilities, treatments, retreats, propertyId }: Props) {
  const [sub, setSub] = useState<Sub>('facilities');

  const TABS: Array<{ key: Sub; label: string; count: number }> = [
    { key: 'facilities',  label: 'Facilities',  count: facilities.length },
    { key: 'experiences', label: 'Experiences', count: retreats.length },
    { key: 'treatments',  label: 'Treatments',  count: treatments.length },
  ];

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: INK, letterSpacing: '-0.01em' }}>The Jungle Spa</div>
        <div style={{ fontSize: 11, color: INK_M, marginTop: 2 }}>
          Physical spa spaces · multi-day wellness experiences · individual treatments
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid ' + HAIR, marginBottom: 16 }}>
        {TABS.map((t) => {
          const active = sub === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setSub(t.key)}
              style={{
                padding: '8px 14px',
                fontSize: 11,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                border: 'none',
                background: 'transparent',
                color: active ? FOREST : INK_M,
                borderBottom: active ? '2px solid ' + FOREST : '2px solid transparent',
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                marginBottom: -1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {t.label}
              <span style={{ fontSize: 10, opacity: 0.7 }}>· {t.count}</span>
            </button>
          );
        })}
      </div>

      {sub === 'facilities'  && <FacilitiesPanel data={facilities} propertyId={propertyId} />}
      {sub === 'experiences' && <RetreatsPanel retreats={retreats} propertyId={propertyId} />}
      {sub === 'treatments'  && <SpaTreatmentsPanel treatments={treatments} facilities={facilities} propertyId={propertyId} />}
    </div>
  );
}
