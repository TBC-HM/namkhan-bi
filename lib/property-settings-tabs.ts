// lib/property-settings-tabs.ts
// SINGLE SOURCE OF TRUTH for the property settings tab list.
// Every settings page MUST import this — never define tabs inline.

export interface SettingsTab {
  key: string;
  label: string;
  href: string;
  active?: boolean;
}

export function getSettingsTabs(propertyId: number, activeKey: string): SettingsTab[] {
  const base = `/h/${propertyId}/settings`;
  const TABS: Array<{ key: string; label: string; path: string }> = [
    { key: 'property',       label: 'Property',       path: `${base}/property`       },
    { key: 'media',          label: 'Media',          path: `${base}/media`          },
    { key: 'rate_plans',     label: 'Rate Plans',     path: `${base}/rate-plans`     },
    // PBS 2026-09-09: /settings/property/audience (renamed Newsletter 2026-07-22) is a
    // real settings page that only ever appeared in its OWN inline tab array — two
    // hand-copied, drifted copies — so it had no entry point from any other settings
    // page. Canonical now; the inline copies are gone.
    { key: 'newsletter',     label: 'Newsletter',     path: `${base}/property/audience` },
    { key: 'guardrails',     label: 'Guardrails',     path: `${base}/guardrails`     },
    { key: 'documents',      label: 'Documents',      path: `${base}/documents`      },
    { key: 'data',           label: 'Data',           path: `${base}/data`           },
    { key: 'send_logs',      label: 'Send Logs',      path: `${base}/send-logs`      },
    { key: 'knowledge',      label: 'Knowledge',      path: `${base}/knowledge`      },
    { key: 'banking',        label: 'Banking & Legal', path: `${base}/banking`       },
    { key: 'communications', label: 'Comms',          path: `${base}/communications` },
    { key: 'sales',          label: 'Sales & Groups', path: `${base}/sales`          },
  ];
  return TABS.map(t => ({ key: t.key, label: t.label, href: t.path, active: t.key === activeKey }));
}
