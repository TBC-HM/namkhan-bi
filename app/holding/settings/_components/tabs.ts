// app/holding/settings/_components/tabs.ts
// Shared tab definitions for /holding/settings/* pages.

export type SettingsTabKey = 'general' | 'links' | 'data';

export interface SettingsTab {
  key: SettingsTabKey;
  label: string;
  href: string;
}

const ALL_TABS: SettingsTab[] = [
  { key: 'general', label: 'General',  href: '/holding/settings' },
  { key: 'links',   label: 'Links',    href: '/holding/settings/links' },
  { key: 'data',    label: 'Data',     href: '/holding/settings/data' },
];

export function settingsTabs(active: SettingsTabKey): SettingsTab[] {
  return ALL_TABS.map((t) => ({ ...t, active: t.key === active })) as any;
}
