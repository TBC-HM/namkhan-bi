'use client';
// components/HoldingThemeOverride.tsx
//
// PBS 2026-06-29 — Force the Beyond Circle (holding) theme for the duration
// of a page mount, regardless of the URL. Used by the agent chat shell when
// a Holding-scoped agent (John, Carla, Sherlock, etc.) is opened from a
// property-scoped URL like /h/260955/it/cockpit/chat/legal_specialist.
//
// PropertyThemeWatcher decides theme from pathname only, so without this
// override the holding agent inherits Namkhan's dark palette. On unmount we
// revert and let PropertyThemeWatcher take back control on the next
// pathname change.

import { useEffect } from 'react';

export default function HoldingThemeOverride() {
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.getAttribute('data-property');
    root.setAttribute('data-property', 'holding');
    return () => {
      // Best-effort revert. If PropertyThemeWatcher re-fires on the next
      // navigation it will set the right value anyway; we only need to
      // avoid leaking 'holding' onto a stale property page if no nav
      // happens before the next mount.
      if (prev && prev !== 'holding') root.setAttribute('data-property', prev);
    };
  }, []);
  return null;
}
