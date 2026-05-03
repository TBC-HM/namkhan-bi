// components/ui/StatusPill.tsx
//
// Locked status pill — one component reused across every list/table/profile
// (B2B contracts, rate plans, agents, guest profiles, reservations, ...).
// Per spec 2026-05-03 + docs/11_BRAND_AND_UI_STANDARDS.md.

import { ReactNode } from 'react';

export type StatusTone = 'active' | 'pending' | 'expired' | 'inactive' | 'info';

interface Props {
  tone: StatusTone;
  /** Optional icon/emoji rendered before the label. */
  icon?: ReactNode;
  children: ReactNode;
}

const TONE_CLS: Record<StatusTone, string> = {
  active:   'pill-active',
  pending:  'pill-pending',
  expired:  'pill-expired',
  inactive: 'pill-inactive',
  info:     'pill-info',
};

export default function StatusPill({ tone, icon, children }: Props) {
  return (
    <span className={`status-pill ${TONE_CLS[tone]}`}>
      {icon && <span className="status-pill-icon">{icon}</span>}
      {children}
    </span>
  );
}
