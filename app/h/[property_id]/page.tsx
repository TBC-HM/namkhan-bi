// app/h/[property_id]/page.tsx
// PBS 2026-07-02: switched from legacy DeptEntry (dark chrome / 2688-line shell)
// to new-design CeoEntry (paper-white · DashboardPage · Container · KpiTile).
// Legacy DeptEntry stays intact -- still used by the 7 dept hubs. This page
// (the property landing = CEO home) is the pilot for the new design.
//
// 2026-07-02b: forward searchParams to CeoEntry so BookingActivity 1-7d day-picker
// (?activityDays=...) round-trips.
//
// 2026-07-08: pass baseCurrency so KpiTile renders EUR on Donna instead of USD.

import CeoEntry, { type CeoConfig } from './_components/CeoEntry';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NAMKHAN_PROPERTY_ID = 260955;
const DONNA_PROPERTY_ID   = 1000001;

const CEO_BY_PROPERTY: Record<number, CeoConfig> = {
  [NAMKHAN_PROPERTY_ID]: {
    propertyId:    NAMKHAN_PROPERTY_ID,
    propertyLabel: 'The Namkhan',
    ceoRole:       'hotel_ceo_namkhan',
    ceoName:       'Nova',
    ceoAvatar:     'N',
    ceoTagline:    'AI Hotel CEO · The Namkhan · Ask anything cross-department.',
    humanPartner:  'Narout',
    baseCurrency:  'USD',
  },
  [DONNA_PROPERTY_ID]: {
    propertyId:    DONNA_PROPERTY_ID,
    propertyLabel: 'Donna Portals',
    ceoRole:       'hotel_ceo_donna',
    ceoName:       'Orion',
    ceoAvatar:     'O',
    ceoTagline:    'AI Hotel CEO · Donna Portals · Ask anything cross-department.',
    humanPartner:  'Maxi',
    baseCurrency:  'EUR',
  },
};

export default async function PropertyHome({
  params,
  searchParams,
}: {
  params: { property_id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const propertyId = Number(params.property_id);
  const cfg = CEO_BY_PROPERTY[propertyId] ?? {
    propertyId,
    propertyLabel: 'Property',
    ceoRole: 'hotel_ceo',
    ceoName: 'CEO',
    ceoAvatar: 'H',
    ceoTagline: 'AI Hotel CEO.',
    humanPartner: '-',
    baseCurrency: 'USD',
  };
  return <CeoEntry cfg={cfg} searchParams={searchParams} />;
}
