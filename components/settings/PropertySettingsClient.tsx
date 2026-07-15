// components/settings/PropertySettingsClient.tsx
// PBS 2026-07-03: paper-white + hairline redesign.
// PBS 2026-07-13: added "Media QA" tab between "Brand & Reality" and "Policies".

'use client';

import { useState } from 'react';
import IdentityPanel from './panels/IdentityPanel';
import LocationPanel from './panels/LocationPanel';
import BrandPanel from './panels/BrandPanel';
import BrandRealityPanel from './panels/BrandRealityPanel';
import MediaQaPanel from './panels/MediaQaPanel';
import PoliciesPanel from './panels/PoliciesPanel';
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

type Tab =
  | 'identity' | 'owner' | 'location' | 'brand' | 'reality' | 'media_qa' | 'policies'
  | 'rooms' | 'facilities' | 'activities' | 'seasons'
  | 'certifications' | 'contacts' | 'social' | 'team' | 'transport' | 'imekong' | 'meeting_spaces';

const TABS: { key: Tab; label: string; subtitle: string; count: (d: any) => number | null }[] = [
  { key: 'identity',       label: 'Identity',       subtitle: 'Legal & licensing',            count: () => null },
  { key: 'owner',          label: 'Owner',          subtitle: 'Company · registration · bank', count: () => null },
  { key: 'location',       label: 'Location',       subtitle: 'Address · GPS · climate',      count: () => null },
  { key: 'brand',          label: 'Brand',          subtitle: 'Logo · palette · copy',        count: () => null },
  { key: 'reality',        label: 'Brand & Reality', subtitle: 'AI grounding · vibe · palette · forbidden', count: () => null },
  { key: 'media_qa',       label: 'Media QA',        subtitle: 'Naming rules · backfill scoring', count: () => null },
  { key: 'policies',       label: 'Policies',       subtitle: 'Bookings & terms',             count: () => null },
  { key: 'rooms',          label: 'Rooms',          subtitle: 'Room type catalog',            count: (d) => d.rooms.length },
  { key: 'facilities',     label: 'Facilities',     subtitle: 'Pool · spa · dining',          count: (d) => d.facilities.length },
  { key: 'activities',     label: 'Activities',     subtitle: 'Wellness · culture · adventure', count: (d) => d.activities.length },
  { key: 'transport',      label: 'Transport',      subtitle: 'Shuttle · private car · boat',   count: (d) => d.transport?.length ?? 0 },
  { key: 'imekong',        label: 'Imekong',        subtitle: 'Boat spec · cruise packages',     count: (d) => (d.boats?.length ?? 0) + (d.boatCruises?.length ?? 0) },
  { key: 'meeting_spaces', label: 'Meeting spaces', subtitle: 'Venues usable for MICE',           count: (d) => d.meetingSpaces?.length ?? 0 },
  { key: 'seasons',        label: 'Seasons',        subtitle: 'High / low calendar',          count: (d) => d.seasons.length },
  { key: 'certifications', label: 'Certifications', subtitle: 'SLH · ASEAN Green · etc',      count: (d) => d.certifications.length },
  { key: 'contacts',       label: 'Contacts',       subtitle: 'Reservations · GM · owner',    count: (d) => d.contacts.length },
  { key: 'social',         label: 'Social',         subtitle: 'IG · FB · TripAdvisor',        count: (d) => d.social.length },
  { key: 'team',           label: 'Team',           subtitle: 'GM & department heads',        count: (d) => d.team?.length ?? 0 },
];

export default function PropertySettingsClient({ data, propertyId }: { data: any; propertyId: number }) {
  const [active, setActive] = useState<Tab>('identity');

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
          {TABS.map((tab) => {
            const isActive = active === tab.key;
            const count = tab.count(data);
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
                  {count !== null && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: '1px 8px',
                        borderRadius: 99,
                        background: isActive ? 'rgba(255,255,255,0.2)' : '#F5F0E1',
                        color: isActive ? '#FFFFFF' : '#5A5A5A',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {count}
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
          {active === 'media_qa'       && <MediaQaPanel        propertyId={propertyId} />}
          {active === 'policies'       && <PoliciesPanel       data={data.policies}       propertyId={propertyId} />}
          {active === 'rooms'          && <RoomsPanel          data={data.rooms}          roomUnits={data.roomUnits ?? []} propertyId={propertyId} />}
          {active === 'facilities'     && <FacilitiesPanel     data={data.facilities}     propertyId={propertyId} />}
          {active === 'activities'     && <ActivitiesPanel     data={data.activities}     propertyId={propertyId} />}
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
