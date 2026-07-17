// components/settings/panels/FnbHubPanel.tsx
// PBS 2026-07-18 · F&B mini-hub mirroring JungleSpaPanel structure.
'use client';

import { useState } from 'react';
import FacilitiesPanel from './FacilitiesPanel';
import FnbMenusPanel from './FnbMenusPanel';
import ActivitiesPanel from './ActivitiesPanel';

type Sub = 'facilities' | 'menus' | 'group_menus' | 'experiences';

const HAIR = '#E6DFCC';
const INK = '#1B1B1B';
const INK_M = '#5A5A5A';
const FOREST = '#084838';

interface Menu { menu_id: number; property_id: number; facility_id: number | null; name: string; meal_period: string | null; is_active: boolean; display_order: number | null; items?: any[]; }
interface Activity { activity_id: number; facility_id: number | null; }

interface Props {
  facilities: any[];
  menus: Menu[];
  activities: Activity[];
  propertyId: number;
}

export default function FnbHubPanel({ facilities, menus, activities, propertyId }: Props) {
  const [sub, setSub] = useState<Sub>('facilities');

  const facilityIds = new Set(facilities.map(f => f.facility_id));
  const fnbActivities = activities.filter(a => a.facility_id != null && facilityIds.has(a.facility_id));

  const isGroup = (m: Menu) => (m.meal_period || '').toLowerCase().includes('group');
  const regularMenus = menus.filter(m => !isGroup(m));
  const groupMenus   = menus.filter(isGroup);

  const TABS: Array<{ key: Sub; label: string; count: number }> = [
    { key: 'facilities',  label: 'Facilities',  count: facilities.length },
    { key: 'menus',       label: 'Menus',       count: regularMenus.length },
    { key: 'group_menus', label: 'Group menus', count: groupMenus.length },
    { key: 'experiences', label: 'Experiences', count: fnbActivities.length },
  ];

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: INK, letterSpacing: '-0.01em' }}>Food & Beverage</div>
        <div style={{ fontSize: 11, color: INK_M, marginTop: 2 }}>
          Restaurant & bar spaces · à-la-carte menus · group / event menus · dining experiences
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid ' + HAIR, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map((t) => {
          const active = sub === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setSub(t.key)}
              style={{
                padding: '8px 14px', fontSize: 11, letterSpacing: '0.06em',
                textTransform: 'uppercase', border: 'none', background: 'transparent',
                color: active ? FOREST : INK_M,
                borderBottom: active ? '2px solid ' + FOREST : '2px solid transparent',
                fontWeight: active ? 700 : 500, cursor: 'pointer', marginBottom: -1,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              {t.label}
              <span style={{ fontSize: 10, opacity: 0.7 }}>· {t.count}</span>
            </button>
          );
        })}
      </div>

      {sub === 'facilities'  && <FacilitiesPanel data={facilities} propertyId={propertyId} />}
      {sub === 'menus'       && <FnbMenusPanel menus={regularMenus} facilities={facilities} propertyId={propertyId} scope="regular" />}
      {sub === 'group_menus' && <FnbMenusPanel menus={groupMenus}   facilities={facilities} propertyId={propertyId} scope="group" />}
      {sub === 'experiences' && (
        <div>
          <div style={{ padding: '0 4px 12px', fontSize: 11, color: INK_M }}>
            Dining experiences hosted at an F&B facility (cooking class · sunset dinner · farmer market brunch, etc.).
            Add via the Activities tab — anything linked to <em>{facilities.map(f=>f.name).join(' or ')}</em> shows here.
          </div>
          <ActivitiesPanel data={fnbActivities} propertyId={propertyId} />
        </div>
      )}
    </div>
  );
}
