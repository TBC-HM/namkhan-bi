// Pass-through layout — Finance pages manage their own chrome (full-viewport black).
// Do NOT wrap children in any sidebar, nav, or shell here.
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Finance — Namkhan BI',
};

export default function FinanceLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
