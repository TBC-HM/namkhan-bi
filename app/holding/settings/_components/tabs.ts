// app/holding/settings/_components/tabs.ts
// ADR-237 (finding #75) — ONE definition of the holding settings tab bar.
//
// WHY: this array was hand-copied into 6 page files (page, brain, documents, guardrails,
// integrations, media). They had already DRIFTED: guardrails/, documents/ and media/ listed
// only 4 tabs, so a user standing on Guardrails had no link to Brain or Integrations at all —
// two live pages were unreachable from three of the six settings surfaces. Same defect class
// as finding #66 (duplicated nav arrays), and it is why adding one tab meant editing 6 files.
//
// Every holding settings page now calls settingsTabs('<its own key>'). Adding a tab is one
// edit here and it appears everywhere, correctly, with no chance of a page falling behind.

export type SettingsTab = {
  key: string;
  label: string;
  href: string;
  active?: boolean;
};

const BASE: SettingsTab[] = [
  { key: 'back',         label: '← HoD',        href: '/holding'                       },
  { key: 'platform',     label: 'Platform',     href: '/holding/settings'              },
  { key: 'guardrails',   label: 'Guardrails',   href: '/holding/settings/guardrails'   },
  { key: 'documents',    label: 'Documents',    href: '/holding/settings/documents'    },
  { key: 'media',        label: 'Media',        href: '/holding/settings/media'        },
  { key: 'brain',        label: 'Brain',        href: '/holding/settings/brain'        },
  { key: 'integrations', label: 'Integrations', href: '/holding/settings/integrations' },
  { key: 'links',        label: 'Links',        href: '/holding/settings/links'        },
];

/** Tab bar for a holding settings page. Pass the page's own key to mark it current. */
export function settingsTabs(activeKey: string): SettingsTab[] {
  return BASE.map((t) => (t.key === activeKey ? { ...t, active: true } : t));
}
