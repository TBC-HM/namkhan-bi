// app/settings/_subpages.ts
// PBS 2026-05-09 #26: only Property stays in settings. Snapshot + Property
// are the canonical pair surfaced via the <Page> sub-pages strip (other
// utility pages — VAT, integrations, DQ — live under /cockpit now).

export const SETTINGS_SUBPAGES = [
  { label: 'Snapshot', href: '/settings'          },
  { label: 'Property', href: '/settings/property' },
];
