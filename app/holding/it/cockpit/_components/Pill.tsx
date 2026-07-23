// app/holding/it/cockpit/_components/Pill.tsx
// Tiny mono-caps pill used throughout the cockpit-v2 surface. Server-safe.

import type { ReactNode } from 'react';
import { TOKENS, MONO } from './tokens';

export function Pill({ children, color, bg }: { children: ReactNode; color?: string; bg?: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        fontFamily: MONO,
        color: color || TOKENS.text2,
        background: bg || TOKENS.bgDeep,
        border: `1px solid ${bg ? 'transparent' : TOKENS.borderSoft}`,
      }}
    >
      {children}
    </span>
  );
}

export function StatusDot({ status, blinking = false }: { status: string; blinking?: boolean }) {
  const map: Record<string, string> = {
    active: TOKENS.moss,
    dormant: TOKENS.sand,
    disabled: TOKENS.text3,
    new: TOKENS.terracotta,
    triaged: TOKENS.ochre,
    working: TOKENS.sky,
    staged: TOKENS.brass,
    deployed: TOKENS.moss,
    completed: TOKENS.moss,
    error: TOKENS.oxblood,
    critical: TOKENS.oxblood,
    high: TOKENS.terracotta,
    medium: TOKENS.ochre,
    low: TOKENS.sand,
    urgent: TOKENS.oxblood,
    normal: TOKENS.sand,
  };
  const color = map[status] || TOKENS.text3;
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        marginRight: 6,
        boxShadow: blinking || status === 'active' || status === 'urgent' ? `0 0 0 3px ${color}22` : 'none',
        animation: blinking ? 'cockpitv2blink 1.4s ease-in-out infinite' : undefined,
      }}
    />
  );
}
