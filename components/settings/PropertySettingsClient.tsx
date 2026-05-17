// components/settings/PropertySettingsClient.tsx
// v2: Adds Team tab (12th) showing GM + HODs from tenancy.property_users
'use client';

import { useState } from 'react';
import IdentityPanel from './panels/IdentityPanel';
import LocationPanel from './panels/LocationPanel';
import BrandPanel from './panels/BrandPanel';
import PoliciesPanel from './panels/PoliciesPanel';
import RoomsPanel from './panels/RoomsPanel';
import FacilitiesPanel from './panels/FacilitiesPanel';
import ActivitiesPanel from './panels/ActivitiesPanel';
import SeasonsPanel from './panels/SeasonsPanel';
import CertificationsPanel from './panels/CertificationsPanel';
import ContactsPanel from './panels/ContactsPanel';
import SocialPanel from './panels/SocialPanel';
import TeamPanel from './panels/TeamPanel';

type Tab =
  | 'identity'
  | 'location'
  | 'brand'
  | 'policies'
  | 'rooms'
  | 'facilities'
  | 'activities'
  | 'seasons'
  | 'certifications'
  | 'contacts'
  | 'social'
  | 'team';

const TABS: { key: Tab; label: string; subtitle: string; count: (d: any) => number | null }[] = [
  { key: 'identity', label: 'Identity', subtitle: 'Legal & licensing', count: () => null },
  { key: 'location', label: 'Location', subtitle: 'Address, GPS, climate', count: () => null },
  { key: 'brand', label: 'Brand', subtitle: 'Logo, palette, copy', count: () => null },
  { key: 'policies', label: 'Policies', subtitle: 'Bookings & terms', count: () => null },
  { key: 'rooms', label: 'Rooms', subtitle: 'Room type catalog', count: (d) => d.rooms.length },
  { key: 'facilities', label: 'Facilities', subtitle: 'Pool, spa, dining', count: (d) => d.facilities.length },
  { key: 'activities', label: 'Activities', subtitle: 'Wellness, culture, adventure', count: (d) => d.activities.length },
  { key: 'seasons', label: 'Seasons', subtitle: 'High / low calendar', count: (d) => d.seasons.length },
  { key: 'certifications', label: 'Certifications', subtitle: 'SLH, ASEAN Green, etc', count: (d) => d.certifications.length },
  { key: 'contacts', label: 'Contacts', subtitle: 'Reservations, GM, owner', count: (d) => d.contacts.length },
  { key: 'social', label: 'Social', subtitle: 'IG, FB, TripAdvisor, etc', count: (d) => d.social.length },
  { key: 'team', label: 'Team', subtitle: 'GM & department heads', count: (d) => d.team?.length ?? 0 },
];

export default function PropertySettingsClient({ data, propertyId }: { data: any; propertyId: number }) {
  const [active, setActive] = useState<Tab>('identity');

  // PBS 2026-05-13 rev3: replaced Donna-only Tailwind utilities + hardcoded
  // hex fallbacks (#1F3A2E green, #F4EFE2 cream, #B8A878 sand) with brand-
  // aware tokens. Namkhan picks up :root dark defaults, Donna picks up the
  // lightLegacyVars override emitted by ThemeInjector — same component
  // renders correctly in either tenant theme.
  return (
    <div className="grid grid-cols-12 gap-6">
      <aside className="col-span-3">
        <nav className="space-y-1 sticky top-6">
          {TABS.map((tab) => {
            const isActive = active === tab.key;
            const count = tab.count(data);
            return (
              <button
                key={tab.key}
                onClick={() => setActive(tab.key)}
                className="w-full text-left px-4 py-3 rounded-lg transition-all"
                style={{
                  background: isActive ? 'var(--brass)' : 'var(--card)',
                  color: isActive ? 'var(--paper-deep)' : 'var(--ink)',
                  border: '1px solid',
                  borderColor: isActive ? 'var(--brass)' : 'var(--border)',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium" style={{ fontSize: 'var(--t-md)' }}>{tab.label}</span>
                  {count !== null && (
                    <span
                      className="px-2 py-0.5 rounded-full"
                      style={{
                        fontSize: 'var(--t-xs)',
                        background: isActive ? 'rgba(0,0,0,0.18)' : 'var(--paper-deep)',
                        color: isActive ? 'var(--paper-deep)' : 'var(--ink-mute)',
                      }}
                    >
                      {count}
                    </span>
                  )}
                </div>
                <p
                  className="mt-0.5"
                  style={{
                    fontSize: 'var(--t-xs)',
                    color: isActive ? 'var(--paper-deep)' : 'var(--ink-mute)',
                    opacity: isActive ? 0.85 : 1,
                  }}
                >
                  {tab.subtitle}
                </p>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="col-span-9">
        <div
          className="rounded-xl backdrop-blur-sm"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
          }}
        >
          {active === 'identity' && <IdentityPanel data={data.identity} propertyId={propertyId} />}
          {active === 'location' && <LocationPanel data={data.location} />}
          {active === 'brand' && <BrandPanel data={data.brand} />}
          {active === 'policies' && <PoliciesPanel data={data.policies} />}
          {active === 'rooms' && <RoomsPanel data={data.rooms} />}
          {active === 'facilities' && <FacilitiesPanel data={data.facilities} />}
          {active === 'activities' && <ActivitiesPanel data={data.activities} />}
          {active === 'seasons' && <SeasonsPanel data={data.seasons} />}
          {active === 'certifications' && <CertificationsPanel data={data.certifications} />}
          {active === 'contacts' && <ContactsPanel data={data.contacts} />}
          {active === 'social' && <SocialPanel data={data.social} />}
          {active === 'team' && <TeamPanel data={data.team ?? []} />}
        </div>
      </main>
    </div>
  );
}
