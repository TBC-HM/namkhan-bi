// app/marketing/media/_client/ArchiveTab.tsx
// PBS 2026-07-21 · Archive sub-tab · reuses LibraryTab's visual/layout but
// scopes to primary_tier='tier_archive' only. Behaves identically to Library
// (same table, same actions, same filters) — just a different scope of assets.
// LibraryTab reads `scope='archive'` and INVERTS its default exclusion so
// archive rows surface (default 'library' excludes them). One primitive, two
// PhotoHub sub-tabs.
'use client';

import LibraryTab from './LibraryTab';
import type { ComponentProps } from 'react';

type LibraryProps = ComponentProps<typeof LibraryTab>;

export default function ArchiveTab(props: LibraryProps) {
  const archivedOnly = (props.mediaPage ?? []).filter((r: any) => r.primary_tier === 'tier_archive');
  return (
    <LibraryTab {...props} mediaPage={archivedOnly} scope="archive" />
  );
}
