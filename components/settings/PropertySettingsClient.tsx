// components/settings/PropertySettingsClient.tsx
// PBS 2026-07-03: paper-white + hairline redesign.
// PBS 2026-07-13: added "Media QA" tab.
// PBS 2026-07-15 (Item 6): added "Licenses" tab.
// PBS 2026-07-15 (Send Logs): added "Send Logs" tab at the end.
// PBS 2026-07-18: refinement pass —
//   · Top KPI tile (fillScoreAll) shows "X of Y fields still empty"
//   · Per-tile badge swapped from row count to "⚠ N missing"
//   · Send Logs removed (moved to /h/[pid]/settings/send-logs sibling tab)
//   · Media QA removed (moved to Media area · Photo Settings sub-tab)
//   · NEW Jungle Spa tab — mini-hub filtering spa facilities out of the Facilities tab
//   · NEW Retreats tab (awaits property.retreats DDL; renders coming-soon banner meanwhile)

'use client';

import { useMemo, useState } from 'react';
import IdentityPanel from './panels/IdentityPanel';
import LocationPanel from './panels/LocationPanel';
import BrandPanel from './panels/BrandPanel';
import BrandRealityPanel from './panels/BrandRealityPanel';
import PoliciesPanel from './panels/PoliciesPanel';
import LicensesPanel from './panels/LicensesPanel';
import RoomsPanel from './panels/RoomsPanel';
import FacilitiesPanel from './panels/FacilitiesPanel';
import ActivitiesPanel from './panels/ActivitiesPanel';
import SeasonsPanel from './panels/SeasonsPanel';
import CertificationsPanel from './panels/CertificationsPanel';
import ContactsPanel from './panels/ContactsPanel';
import SocialPanel from './panels/SocialPanel';
import TeamPanel from './panels/TeamPanel';
import OwnerPanel from './panels/OwnerPanel';
import TransportPanel from './panels/TransportPanel';
import ImekongPanel from './panels/ImekongPanel';
import MeetingSpacesPanel from './panels/MeetingSpacesPanel';
import JungleSpaPanel from './panels/JungleSpaPanel';
import RetreatsPanel from './panels/RetreatsPanel';
import { fillScore, fillScoreAll } from './fillScore';

type Tab =
  | 'identity' | 'owner' | 'location' | 'brand' | 'reality' | 'policies' | 'licenses'
  | 'rooms' | 'facilities' | 'jungle_spa' | 'activities' | 'retreats' | 'seasons'
  | 'certifications' | 'contacts' | 'social' | 'team' | 'transport' | 'imekong' | 'meeting_spaces';

// PBS 2026-07-18 · facility_ids that belong to the new Jungle Spa mini-hub
// (currently: The Jungle Spa + Treatment Rooms 1/2/3 at Namkhan). Filtering
// happens both in the Jungle Spa tab (inclusive) and Facilities tab (exclusive
// via `hideFacilityIds` prop) so rows aren't double-shown.
export const SPA_FACILITY_IDS = new Set<number>([6, 118, 119, 120]);

// dataFor(tab, data) — returns the object/array used for both fillScore + panel render.
function dataFor(tab: Tab, data: any): unknown {
  switch (tab) {
    case 'identity':       return data.identity;
    case 'owner':          return data.owner;
    case 'location':       return data.location;
    case 'brand':          return data.brand;
    case 'reality':        return data.brandReality;
    case 'policies':       return data.policies;
    case 'rooms':          return data.rooms;
    case 'facilities':     return (data.facilities ?? []).filter((f: any) => !SPA_FACILITY_IDS.has(f.facility_id));
    case 'jungle_spa':     return (data.facilities ?? []).filter((f: any) => SPA_FACILITY_IDS.has(f.facility_id));
    case 'activities':     return data.activities;
    case 'retreats':       return [];  // placeholder until property.retreats DDL lands
    case 'seasons':        return data.seasons;
    case 'certifications': return data.certifications;
    case 'contacts':       return data.contacts;
    case 'social':         return data.social;
    case 'team':           return data.team;
    case 'transport':      return data.transport;
    case 'imekong':        return { boats: data.boats, cruises: data.boatCruises };
    case 'meeting_spaces': return data.meetingSpaces;
    case 'licenses':       return [];  // fetched client-side inside LicensesPanel
    default:               return null;
  }
}

const TABS: { key: Tab; label: string; subtitle: string }[] = [
  { key: 'identity',       label: 'Identity',       subtitle: 'Legal & licensing' },
  { key: 'owner',          label: 'Owner',          subtitle: 'Company · registration · bank' },
  { key: 'location',       label: 'Location',       subtitle: 'Address · GPS · climate' },
  { key: 'brand',          label: 'Brand',          subtitle: 'Logo · palette · copy' },
  { key: 'reality',        label: 'Brand & Reality', subtitle: 'AI grounding · vibe · palette · forbidden' },
  { key: 'policies',       label: 'Policies',       subtitle: 'Bookings & terms' },
  { key: 'licenses',       label: 'Licenses',       subtitle: 'Regulatory · insurance · linked docs' },
  { key: 'rooms',          label: 'Rooms',          subtitle: 'Room type catalog' },
  { key: 'facilities',     label: 'Facilities',     subtitle: 'Pool · dining · outdoors' },
  { key: 'jungle_spa',     label: 'Jungle Spa',     subtitle: 'Facilities · experiences · treatments' },
  { key: 'activities',     label: 'Activities',     subtitle: 'Wellness · culture · adventure' },
  { key: 'retreats',       label: 'Retreats',       subtitle: 'Multi-day packages · fixed departures' },
  { key: 'transport',      label: 'Transport',      subtitle: 'Shuttle · private car · boat' },
  { key: 'imekong',        label: 'Imekong',        subtitle: 'Boat spec · cruise packages' },
  { key: 'meeting_spaces', label: 'Meeting spaces', subtitle: 'Venues usable for MICE' },
  { key: 'seasons',        label: 'Seasons',        subtitle: 'High / low calendar' },
  { key: 'certifications', label: 'Certifications', subtitle: 'SLH · ASEAN Green · etc' },
  { key: 'contacts',       label: 'Contacts',       subtitle: 'Reservations · GM · owner' },
  { key: 'social',         label: 'Social',         subtitle: 'IG · FB · TripAdvisor' },
  { key: 'team',           label: 'Team',           subtitle: 'GM & department heads' },
];

export default function PropertySettingsClient({ data, propertyId }: { data: any; propertyId: number }) {
  const [active, setActive] = useState<Tab>('identity');

  // KPI: total missing across every panel that has counted data.
  const total = useMemo(() => fillScoreAll(data), [data]);
  const pctComplete = total.tracked > 0 ? Math.round(((total.tracked - total.missing) / total.tracked) * 100) : 100;

  // Per-tile missing counts (memoised across all tabs).
  const perTile = useMemo(() => {
    const out: Record<Tab, { missing: number; tracked: number }> = {} as any;
    for (const tab of TABS) out[tab.key] = fillScore(dataFor(tab.key, data));
    return out;
  }, [data]);

  const spaFacilities = useMemo(
    () => (data.facilities ?? []).filter((f: any) => SPA_FACILITY_IDS.has(f.facility_id)),
    [data.facilities],
  );

  return (
    <div className="settings-paper-scope" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, alignItems: 'start' }}>
      <style>{`
        .settings-paper-scope,
        .settings-paper-scope * {
          --card:       #FFFFFF;
          --border:     #E6DFCC;
          --paper-deep: #F5F0E1;
          --paper-warm: #FFFFFF;
          --ink:        #1B1B1B;
          --ink-soft:   #3A3A3A;
          --ink-mute:   #5A5A5A;
          --ink-faint:  #8A8A8A;
          --brass:      #1F3A2E;
          --st-good:    #1F5C2C;
        }
        .settings-paper-scope button,
        .settings-paper-scope input,
        .settings-paper-scope select,
        .settings-paper-scope textarea {
          color: #1B1B1B;
        }
        .settings-paper-scope input[type="text"],
        .settings-paper-scope input[type="number"],
        .settings-paper-scope input[type="email"],
        .settings-paper-scope input[type="url"],
        .settings-paper-scope select,
        .settings-paper-scope textarea {
          background: #FFFFFF;
          border: 1px solid #E6DFCC;
        }
      `}</style>
      <aside>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'sticky', top: 12 }}>
          {/* PBS 2026-07-18 · KPI tile at top of the sidebar */}
          <div style={{
            padding: '12px 12px',
            border: '1px solid #E6DFCC',
            background: total.missing === 0 ? '#EBF1EE' : '#FBEFD9',
            borderRadius: 4,
            marginBottom: 6,
          }}>
            <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5A5A5A', marginBottom: 4 }}>
              Completeness
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: total.missing === 0 ? '#1F5C2C' : '#B87F26', fontVariantNumeric: 'tabular-nums' }}>
                {pctComplete}%
              </span>
              <span style={{ fontSize: 11, color: '#5A5A5A' }}>
                {total.missing.toLocaleString()} of {total.tracked.toLocaleString()} fields empty
              </span>
            </div>
          </div>

          {TABS.map((tab) => {
            const isActive = active === tab.key;
            const missing = perTile[tab.key]?.missing ?? 0;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActive(tab.key)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  border: `1px solid ${isActive ? '#1F3A2E' : '#E6DFCC'}`,
                  background: isActive ? '#1F3A2E' : '#FFFFFF',
                  color: isActive ? '#FFFFFF' : '#1B1B1B',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'background 120ms',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{tab.label}</span>
                  {missing > 0 && (
                    <span
                      title={`${missing} fields still empty`}
                      style={{
                        fontSize: 11,
                        padding: '1px 8px',
                        borderRadius: 99,
                        background: isActive ? 'rgba(255,255,255,0.2)' : '#FBEFD9',
                        color: isActive ? '#FFFFFF' : '#B87F26',
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 600,
                      }}
                    >
                      ⚠ {missing}
                    </span>
                  )}
                  {missing === 0 && perTile[tab.key]?.tracked > 0 && (
                    <span
                      title="all fields filled"
                      style={{
                        fontSize: 11,
                        padding: '1px 8px',
                        borderRadius: 99,
                        background: isActive ? 'rgba(255,255,255,0.2)' : '#EBF1EE',
                        color: isActive ? '#FFFFFF' : '#1F5C2C',
                        fontWeight: 600,
                      }}
                    >
                      ✓
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: isActive ? 'rgba(255,255,255,0.75)' : '#5A5A5A',
                    marginTop: 2,
                  }}
                >
                  {tab.subtitle}
                </div>
              </button>
            );
          })}
        </nav>
      </aside>

      <main>
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E6DFCC',
            borderRadius: 6,
            minHeight: 400,
          }}
        >
          {active === 'identity'       && <IdentityPanel       data={data.identity}       propertyId={propertyId} />}
          {active === 'owner'          && <OwnerPanel          data={data.owner}          propertyId={propertyId} />}
          {active === 'location'       && <LocationPanel       data={data.location}       propertyId={propertyId} />}
          {active === 'brand'          && <BrandPanel          data={data.brand}          propertyId={propertyId} />}
          {active === 'reality'        && <BrandRealityPanel   data={data.brandReality}   propertyId={propertyId} />}
          {active === 'policies'       && <PoliciesPanel       data={data.policies}       propertyId={propertyId} />}
          {active === 'licenses'       && <LicensesPanel       propertyId={propertyId} />}
          {active === 'rooms'          && <RoomsPanel          data={data.rooms}          roomUnits={data.roomUnits ?? []} propertyId={propertyId} />}
          {active === 'facilities'     && <FacilitiesPanel     data={(data.facilities ?? []).filter((f: any) => !SPA_FACILITY_IDS.has(f.facility_id))} propertyId={propertyId} />}
          {active === 'jungle_spa'     && <JungleSpaPanel      facilities={spaFacilities} propertyId={propertyId} />}
          {active === 'activities'     && <ActivitiesPanel     data={data.activities}     propertyId={propertyId} />}
          {active === 'retreats'       && <RetreatsPanel       propertyId={propertyId} />}
          {active === 'transport'      && <TransportPanel      data={data.transport ?? []}     propertyId={propertyId} />}
          {active === 'imekong'        && <ImekongPanel        boats={data.boats ?? []} cruises={data.boatCruises ?? []} propertyId={propertyId} />}
          {active === 'meeting_spaces' && <MeetingSpacesPanel data={data.meetingSpaces ?? []} />}
          {active === 'seasons'        && <SeasonsPanel        data={data.seasons}        propertyId={propertyId} />}
          {active === 'certifications' && <CertificationsPanel data={data.certifications} propertyId={propertyId} />}
          {active === 'contacts'       && <ContactsPanel       data={data.contacts}       propertyId={propertyId} />}
          {active === 'social'         && <SocialPanel         data={data.social}         propertyId={propertyId} />}
          {active === 'team'           && <TeamPanel           data={data.team ?? []} propertyId={propertyId} />}
        </div>
      </main>
    </div>
  );
}