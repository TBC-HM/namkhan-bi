// app/settings/_subpages.ts
// PBS 2026-05-09 #26: only Property stays in settings. Snapshot + Property
// are the canonical pair surfaced via the <Page> sub-pages strip (other
// utility pages — VAT, integrations, DQ — live under /cockpit now).
// PBS 2026-07-03: added Listings — master external-listing URL/handle table.

export const SETTINGS_SUBPAGES = [
  { label: 'Snapshot', href: '/settings'                              },
  { label: 'Property', href: '/settings/property'                     },
  { label: 'Listings', href: '/settings/marketing/listings'           },
];
