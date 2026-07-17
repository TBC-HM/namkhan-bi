// components/settings/panels/JungleSpaPanel.tsx
// PBS 2026-07-18 · new mini-hub for the spa cluster (facility_id 6 + treatment
// rooms 118-120 at Namkhan). Three sub-tabs:
//   · Facilities   — the physical spa rooms (reuses property.facilities rows)
//   · Experiences  — multi-day wellness journeys (backed by property.retreats,
//                    filtered where wellness_focus is spa-related — awaits DDL)
//   · Treatments   — individual bookable treatments (awaits property.spa_treatments DDL)
// Facilities sub-tab wires immediately; Experiences + Treatments show a
// coming-soon banner until PBS greenlights the two new tables.
'use client';

import { useState } from 'react';
import FacilitiesPanel from './FacilitiesPanel';

type Sub = 'facilities' | 'experiences' | 'treatments';

const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const AMBER  = '#B87F26';
const CREAM  = '#F5F0E1';

interface Props {
  facilities: any[];
  propertyId: number;
}

export default function JungleSpaPanel({ facilities, propertyId }: Props) {
  const [sub, setSub] = useState<Sub>('facilities');

  const TABS: Array<{ key: Sub; label: string; count: number | null; live: boolean }> = [
    { key: 'facilities',  label: 'Facilities',  count: facilities.length, live: true },
    { key: 'experiences', label: 'Experiences', count: null,              live: false },
    { key: 'treatments',  label: 'Treatments',  count: null,              live: false },
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
              {t.count != null && <span style={{ fontSize: 10, opacity: 0.7 }}>· {t.count}</span>}
              {!t.live && (
                <span style={{ background: AMBER, color: '#FFF', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 8, letterSpacing: 0 }}>
                  soon
                </span>
              )}
            </button>
          );
        })}
      </div>

      {sub === 'facilities' && <FacilitiesPanel data={facilities} propertyId={propertyId} />}

      {sub === 'experiences' && (
        <div style={{ background: CREAM, border: '1px solid ' + HAIR, borderRadius: 4, padding: 20, textAlign: 'center', color: INK_M }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 6 }}>Experiences · coming soon</div>
          <div style={{ fontSize: 12, lineHeight: 1.5 }}>
            Multi-day wellness experiences (Yoga Immersion, Detox Reset, etc.) will surface here once the <code>property.retreats</code> table is created. This table is pending PBS DDL approval — schema drafted in chat.
          </div>
        </div>
      )}

      {sub === 'treatments' && (
        <div style={{ background: CREAM, border: '1px solid ' + HAIR, borderRadius: 4, padding: 20, textAlign: 'center', color: INK_M }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 6 }}>Treatments · coming soon</div>
          <div style={{ fontSize: 12, lineHeight: 1.5 }}>
            Individual bookable treatments (massage · aromatherapy · reflexology, per-therapist assignment, contraindications) will surface here once the <code>property.spa_treatments</code> table is created. Pending PBS DDL approval.
          </div>
        </div>
      )}
    </div>
  );
}