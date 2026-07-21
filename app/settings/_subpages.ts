// app/settings/_subpages.ts
// PBS 2026-05-09 #26: only Property stays in settings. Snapshot + Property
// are the canonical pair surfaced via the <Page> sub-pages strip (other
// utility pages — VAT, integrations, DQ — live under /cockpit now).
// PBS 2026-07-03: added Listings — master external-listing URL/handle table.
// PBS 2026-07-21: added Audience — blocklist, groups, sender identity, routing.
// PBS 2026-07-21 pm: Audience v1 files inadvertently deleted upstream by the
// Gmail-DWD commit; restored here alongside re-adding the sub-page entry so
// the property-scoped tab at /h/[property_id]/settings/property/audience can
// import AudienceSettingsClient without duplicating it.

export const SETTINGS_SUBPAGES = [
  { label: 'Snapshot', href: '/settings'                              },
  { label: 'Property', href: '/settings/property'                     },
  { label: 'Audience', href: '/settings/property/audience'            },
  { label: 'Listings', href: '/settings/marketing/listings'           },
];
