import type { ReactNode } from 'react';

// Pass-through layout — Sales entry page owns its own full-viewport black shell.
// This layout intentionally adds NO chrome (no sidebar, no header wrapper)
// so the black canvas is uninterrupted.
export default function SalesLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
