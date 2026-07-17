// components/settings/PropertySettingsClient.tsx
// PBS 2026-07-18 v2 · category-driven filters + real Jungle Spa/F&B mini-hubs.
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
import TeamFeaturesPanel from './panels/TeamFeaturesPanel';
import OwnerPanel from './panels/OwnerPanel';
import TransportPanel from './panels/TransportPanel';
import ImekongPanel from './panels/ImekongPanel';
import MeetingSpacesPanel from './panels/MeetingSpacesPanel';
import JungleSpaPanel from './panels/JungleSpaPanel';
import FnbHubPanel from './panels/FnbHubPanel';
import RetreatsPanel from './panels/RetreatsPanel';
import { fillScore, fillScoreAll } from './fillScore';

type Tab =
  | 'identity' | 'owner' | 'location' | 'brand' | 'reality' | 'policies' | 'licenses'
  | 'rooms' | 'facilities' | 'jungle_spa' | 'fnb' | 'activities' | 'retreats' | 'seasons'
  | 'certifications' | 'contacts' | 'social' | 'team' | 'transport' | 'imekong' | 'meeting_spaces';

// Category-driven filters (case-insensitive). Any wellness/treatment_room row
// lands in Jungle Spa; any dining/restaurant/bar row lands in F&B.
const WELLNESS_CATS = new Set(['wellness', 'treatment_room']);
const FNB_CATS = new Set(['dining', 'f&b', 'fnb', 'restaurant', 'bar', 'food']);

export const isSpaFacility = (f: any): boolean =>
  !!f?.category && WELLNESS_CATS.has(String(f.category).toLowerCase().trim());
export const isFnbFacility = (f: any): boolean =>
  !!f?.category && FNB_CATS.has(String(f.category).toLowerCase().trim());
export const isExtractedFacility = (f: any): boolean => isSpaFacility(f) || isFnbFacility(f);

function dataFor(tab: Tab, data: any): unknown {
  switch (tab) {
    case 'identity':       return data.identity;
    case 'owner':          return data.owner;
    case 'location':       return data.location;
    case 'brand':          return data.brand;
    case 'reality':        return data.brandReality;
    case 'policies':       return data.policies;
    case 'rooms':          return data.rooms;
    case 'facilities':     return (data.facilities ?? []).filter((f: any) => !isExtractedFacility(f));
    case 'jungle_spa':     return (data.facilities ?? []).filter(isSpaFacility);
    case 'fnb':            return (data.facilities ?? []).filter(isFnbFacility);
    case 'activities':     return data.activities;
    case 'retreats':       return data.retreats;
    case 'seasons':        return data.seasons;
    case 'certifications': return data.certifications;
    case 'contacts':       return data.contacts;
    case 'social':         return data.social;
    case 'team':           return data.teamFeatures;
    case 'transport':      return data.transport;
    case 'imekong':        return { boats: data.boats, cruises: data.boatCruises };
    case 'meeting_spaces': return data.meetingSpaces;
    case 'licenses':       return [];
    default:               return null;
  }
}

const TABS: { key: Tab; label: string; subtitle: string }[] = [
  { key: 'identity',       label: 'Identity',       subtitle: 'Legal · directors · licensing' },
  { key: 'owner',          label: 'Owner',          subtitle: 'Company · registration · bank' },
  { key: 'location',       label: 'Location',       subtitle: 'Address · GPS · climate' },
  { key: 'brand',          label: 'Brand',          subtitle: 'Logo · palette · copy' },
  { key: 'reality',        label: 'Brand & Reality', subtitle: 'AI grounding · vibe · palette · forbidden' },
  { key: 'policies',       label: 'Policies',       subtitle: 'Bookings & terms' },
  { key: 'licenses',       label: 'Licenses',       subtitle: 'Regulatory · insurance · linked docs' },
  { key: 'rooms',          label: 'Rooms',          subtitle: 'Room type catalog' },
  { key: 'facilities',     label: 'Facilities',     subtitle: 'Outdoors · common · non-F&B non-spa' },
  { key: 'jungle_spa',     label: 'Jungle Spa',     subtitle: 'Facilities · experiences · treatments' },
  { key: 'fnb',            label: 'F&B',            subtitle: 'Facilities · menus · group menus · experiences' },
  { key: 'activities',     label: 'Activities',     subtitle: 'Wellness · culture · adventure' },
  { key: 'retreats',       label: 'Retreats',       subtitle: 'Multi-day packages · fixed departures' },
  { key: 'transport',      label: 'Transport',      subtitle: 'Shuttle · private car · boat' },
  { key: 'imekong',        label: 'Imekong',        subtitle: 'Boat spec · cruise packages' },
  { key: 'meeting_spaces', label: 'Meeting spaces', subtitle: 'Venues usable for MICE' },
  { key: 'seasons',        label: 'Seasons',        subtitle: 'High / low calendar' },
  { key: 'certifications', label: 'Certifications', subtitle: 'SLH · ASEAN Green · etc' },
  { key: 'contacts',       label: 'Contacts',       subtitle: 'Reservations · GM · owner' },
  { key: 'social',         label: 'Social',         subtitle: 'IG · FB · TripAdvisor' },
  { key: 'team',           label: 'Team',           subtitle: 'Featured for AI mention' },
];

// PBS 2026-07-18 v3 · sidebar reorg — 5 collapsible groups (Donna-scale).
const GROUPS: { key: string; label: string; keys: Tab[] }[] = [
  { key: 'property',    label: 'Property',              keys: ['identity','owner','location','brand','reality','policies','licenses','certifications','contacts','social','team'] },
  { key: 'accom',       label: 'Accommodation',         keys: ['rooms'] },
  { key: 'facilities',  label: 'Facilities & Outlets',  keys: ['facilities','jungle_spa','fnb','meeting_spaces'] },
  { key: 'experiences', label: 'Experiences',           keys: ['activities','retreats','imekong','transport'] },
  { key: 'calendar',    label: 'Calendar',              keys: ['seasons'] },
];

export default function PropertySettingsClient({ data, propertyId }: { data: any; propertyId: number }) {
  const [active, setActive] = useState<Tab>('identity');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleGroup = (k: string) => setCollapsed(prev => {
    const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n;
  });

  const total = useMemo(() => fillScoreAll(data), [data]);
  const pctComplete = total.tracked > 0 ? Math.round(((total.tracked - total.missing) / total.tracked) * 100) : 100;

  const perTile = useMemo(() => {
    const out: Record<Tab, { missing: number; tracked: number }> = {} as any;
    for (const tab of TABS) out[tab.key] = fillScore(dataFor(tab.key, data));
    return out;
  }, [data]);

  const allFacilities = data.facilities ?? [];
  const spaFacilities = useMemo(() => allFacilities.filter(isSpaFacility), [allFacilities]);
  const fnbFacilities = useMemo(() => allFacilities.filter(isFnbFacility), [allFacilities]);
  const generalFacilities = useMemo(() => allFacilities.filter((f: any) => !isExtractedFacility(f)), [allFacilities]);

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
        .settings-paper-scope textarea { color: #1B1B1B; }
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

          {GROUPS.map((group) => {
            const isCollapsed = collapsed.has(group.key);
            const groupTabs = group.keys.map(k => TABS.find(t => t.key === k)!).filter(Boolean);
            const groupMissing = groupTabs.reduce((s, t) => s + (perTile[t.key]?.missing ?? 0), 0);
            const containsActive = groupTabs.some(t => t.key === active);
            return (
              <div key={group.key} style={{ marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '6px 10px',
                    border: 'none',
                    background: 'transparent',
                    color: containsActive ? '#1F3A2E' : '#5A5A5A',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
                    fontWeight: 700,
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, opacity: 0.65 }}>{isCollapsed ? '▸' : '▾'}</span>
                    {group.label}
                  </span>
                  {groupMissing > 0 && (
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 99, background: '#FBEFD9', color: '#B87F26', fontVariantNumeric: 'tabular-nums', fontWeight: 700, letterSpacing: 0, textTransform: 'none' }}>
                      ⚠ {groupMissing}
                    </span>
                  )}
                </button>
                {!isCollapsed && groupTabs.map((tab) => {
                  const isActive = active === tab.key;
                  const missing = perTile[tab.key]?.missing ?? 0;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActive(tab.key)}
                      style={{
                        width: '100%', textAlign: 'left',
                        padding: '8px 10px 8px 22px',
                        marginTop: 2,
                        border: `1px solid ${isActive ? '#1F3A2E' : '#E6DFCC'}`,
                        background: isActive ? '#1F3A2E' : '#FFFFFF',
                        color: isActive ? '#FFFFFF' : '#1B1B1B',
                        borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'background 120ms',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{tab.label}</span>
                        {missing > 0 && (
                          <span title={`${missing} fields still empty`} style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, background: isActive ? 'rgba(255,255,255,0.2)' : '#FBEFD9', color: isActive ? '#FFFFFF' : '#B87F26', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                            ⚠ {missing}
                          </span>
                        )}
                        {missing === 0 && perTile[tab.key]?.tracked > 0 && (
                          <span title="all fields filled" style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, background: isActive ? 'rgba(255,255,255,0.2)' : '#EBF1EE', color: isActive ? '#FFFFFF' : '#1F5C2C', fontWeight: 600 }}>
                            ✓
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: isActive ? 'rgba(255,255,255,0.75)' : '#5A5A5A', marginTop: 1 }}>
                        {tab.subtitle}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>

      <main>
        <div style={{ background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 6, minHeight: 400 }}>
          {active === 'identity'       && <IdentityPanel       data={data.identity}       propertyId={propertyId} />}
          {active === 'owner'          && <OwnerPanel          data={data.owner}          propertyId={propertyId} />}
          {active === 'location'       && <LocationPanel       data={data.location}       propertyId={propertyId} />}
          {active === 'brand'          && <BrandPanel          data={data.brand}          propertyId={propertyId} />}
          {active === 'reality'        && <BrandRealityPanel   data={data.brandReality}   propertyId={propertyId} />}
          {active === 'policies'       && <PoliciesPanel       data={data.policies}       propertyId={propertyId} />}
          {active === 'licenses'       && <LicensesPanel       propertyId={propertyId} />}
          {active === 'rooms'          && <RoomsPanel          data={data.rooms}          roomUnits={data.roomUnits ?? []} propertyId={propertyId} />}
          {active === 'facilities'     && <FacilitiesPanel     data={generalFacilities} propertyId={propertyId} />}
          {active === 'jungle_spa'     && <JungleSpaPanel      facilities={spaFacilities} treatments={data.spaTreatments ?? []} retreats={data.retreats ?? []} propertyId={propertyId} />}
          {active === 'fnb'            && <FnbHubPanel         facilities={fnbFacilities} menus={data.fnbMenus ?? []} activities={data.activities ?? []} propertyId={propertyId} />}
          {active === 'activities'     && <ActivitiesPanel     data={data.activities}     propertyId={propertyId} />}
          {active === 'retreats'       && <RetreatsPanel       retreats={data.retreats ?? []} propertyId={propertyId} />}
          {active === 'transport'      && <TransportPanel      data={data.transport ?? []}     propertyId={propertyId} />}
          {active === 'imekong'        && <ImekongPanel        boats={data.boats ?? []} cruises={data.boatCruises ?? []} propertyId={propertyId} />}
          {active === 'meeting_spaces' && <MeetingSpacesPanel data={data.meetingSpaces ?? []} />}
          {active === 'seasons'        && <SeasonsPanel        data={data.seasons}        propertyId={propertyId} />}
          {active === 'certifications' && <CertificationsPanel data={data.certifications} propertyId={propertyId} />}
          {active === 'contacts'       && <ContactsPanel       data={data.contacts}       propertyId={propertyId} />}
          {active === 'social'         && <SocialPanel         data={data.social}         propertyId={propertyId} />}
          {active === 'team'           && <TeamFeaturesPanel   features={data.teamFeatures ?? []} directory={data.team ?? []} propertyId={propertyId} />}
        </div>
      </main>
    </div>
  );
}
