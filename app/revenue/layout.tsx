// Pass-through layout — Revenue entry page owns its own full-viewport black canvas.
// Sub-routes (/pulse, /engine, etc.) carry their own chrome via PageHeader.
import type { ReactNode } from 'react';

export default function RevenueLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
