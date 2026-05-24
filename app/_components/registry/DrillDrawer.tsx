// app/_components/registry/DrillDrawer.tsx
// PBS #145 (2026-05-24) — promote the inline DrillPanel render to a
// right-side Drawer. State remains URL-driven (?expand=<canonical>) so SSR
// + back-button keep working; the drawer just provides the chrome.
// Close → router.push(pathname without ?expand).
//
// Used by ContainerRoomIntel. Drawer primitive lives in @/app/(cockpit)/_design.
'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Drawer } from '@/app/(cockpit)/_design';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function DrillDrawer({ title, subtitle, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const onClose = useCallback(() => {
    const params = new URLSearchParams(sp?.toString() ?? '');
    params.delete('expand');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }, [router, pathname, sp]);

  // Parent only mounts us when activeExpand is truthy, so always open here.
  return (
    <Drawer open={true} onClose={onClose} title={title} subtitle={subtitle} width="lg">
      {children}
    </Drawer>
  );
}
